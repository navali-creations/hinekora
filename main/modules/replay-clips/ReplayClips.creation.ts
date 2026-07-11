import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";

import { BookmarksService } from "~/main/modules/bookmarks";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  createSafePathLogFields,
  logError,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

import type { ReplayClip } from "~/types";
import type { ReplayTriggerEvent } from "./ReplayClips.dto";
import { ReplayClipDuplicateTracker } from "./ReplayClips.duplicates";
import type { ReplayClipsRepository } from "./ReplayClips.repository";

interface ReplayClipCreationDependencies {
  persistAndPublish: (clip: ReplayClip) => void;
  preparePreview: (
    clip: ReplayClip,
    sourcePath: string,
    durationSeconds: number | null,
  ) => Promise<void>;
  readDuration: (path: string) => number | null;
  runClipOperation: <T>(
    clipId: string,
    operation: () => Promise<T>,
  ) => Promise<T>;
  repository: Pick<ReplayClipsRepository, "getByTriggerLineHash">;
  resolveStoredPath: (path: string) => string | null;
  updateClip: (clip: ReplayClip, update: Partial<ReplayClip>) => ReplayClip;
}

class ReplayClipCreationService {
  private readonly duplicateTracker = new ReplayClipDuplicateTracker();

  constructor(private readonly dependencies: ReplayClipCreationDependencies) {}

  async execute(event: ReplayTriggerEvent): Promise<ReplayClip | null> {
    logInfo("replay-clips", "Replay trigger received", {
      game: event.game,
      kind: event.kind,
      lineHash: event.lineHash,
    });
    if (this.duplicateTracker.isDuplicate(event.lineHash)) {
      const existing = this.dependencies.repository.getByTriggerLineHash(
        event.lineHash,
      );
      if (existing) {
        logWarn("replay-clips", "Duplicate replay trigger ignored", {
          clipId: existing.id,
          game: event.game,
          kind: event.kind,
          lineHash: event.lineHash,
        });
        return existing;
      }
    }
    if (!this.isManagedReplayBufferActive(event)) {
      return null;
    }

    BookmarksService.getInstance().rememberReplayClipSession({
      game: event.game,
      triggerLineHash: event.lineHash,
    });
    const settings = SettingsStoreService.getInstance().get();
    const clip = this.createClip(event);
    return this.dependencies.runClipOperation(clip.id, () =>
      this.createStoredClip(clip, event, settings.deathClipSeconds),
    );
  }

  private async createStoredClip(
    initialClip: ReplayClip,
    event: ReplayTriggerEvent,
    requestedDurationSeconds: number,
  ): Promise<ReplayClip> {
    let clip = initialClip;
    this.dependencies.persistAndPublish(clip);

    try {
      clip = this.dependencies.updateClip(clip, { status: "saving_replay" });
      this.showClipPreviewOverlay(clip);
      logInfo("replay-clips", "Saving replay for trigger", {
        backend: "managed",
        clipId: clip.id,
        kind: event.kind,
        seconds: requestedDurationSeconds,
      });
      const replayPath = await this.saveManagedReplay(
        requestedDurationSeconds,
        event.kind,
      );
      if (!replayPath) {
        throw new Error("Recorder did not return a saved replay path");
      }
      const storedReplayPath = this.dependencies.resolveStoredPath(replayPath);
      if (!storedReplayPath) {
        throw new Error(
          "Recorder returned a replay path outside managed storage",
        );
      }

      clip = this.dependencies.updateClip(clip, {
        originalObsPath: storedReplayPath,
        processedClipPath: storedReplayPath,
        sizeBytes: (await stat(storedReplayPath)).size,
      });
      logInfo("replay-clips", "Replay source saved", {
        clipId: clip.id,
        ...createSafePathLogFields(storedReplayPath, "recording"),
      });
      const durationSeconds = this.dependencies.readDuration(storedReplayPath);
      await this.dependencies.preparePreview(
        clip,
        storedReplayPath,
        durationSeconds,
      );
      const readyClip = this.dependencies.updateClip(clip, {
        durationSeconds,
        status: "ready",
      });
      logInfo("replay-clips", "Replay clip ready", { clipId: readyClip.id });
      return readyClip;
    } catch (error) {
      logError("replay-clips", "Replay clip creation failed", {
        clipId: clip.id,
        error: safeErrorMessage(error),
      });
      return this.dependencies.updateClip(clip, {
        error: safeErrorMessage(error),
        status: "failed",
      });
    }
  }

  private createClip(event: ReplayTriggerEvent): ReplayClip {
    const now = new Date().toISOString();
    const settings = SettingsStoreService.getInstance().get();
    return {
      createdAt: now,
      deathTimestamp: event.detectedAt,
      durationSeconds: null,
      error: null,
      id: randomUUID(),
      kind: event.kind,
      originalObsPath: null,
      processedClipPath: null,
      sizeBytes: 0,
      sourceGame: event.game,
      sourceLeague: settings.activeLeague,
      status: "death_detected",
      targetDurationSeconds: settings.deathClipSeconds,
      triggerLineHash: event.lineHash,
      updatedAt: now,
    };
  }

  private isManagedReplayBufferActive(event: ReplayTriggerEvent): boolean {
    const status = ManagedRecorderService.getInstance().getStatus();
    if (status.bufferActive && status.gameRunning !== false) {
      return true;
    }
    logInfo("replay-clips", "Replay clip skipped: rewind unavailable", {
      available: status.available,
      game: event.game,
      gameRunning: status.gameRunning ?? null,
      initialized: status.initialized,
      lineHash: event.lineHash,
      recording: status.recording,
      runRecordingActive: status.runRecordingActive,
    });
    return false;
  }

  private async saveManagedReplay(
    durationSeconds: number,
    kind: ReplayTriggerEvent["kind"],
  ): Promise<string | null> {
    const managedRecorder = ManagedRecorderService.getInstance();
    const status = managedRecorder.getStatus();
    if (!status.bufferActive) {
      logWarn("replay-clips", "Managed replay save blocked: buffer inactive", {
        available: status.available,
        initialized: status.initialized,
        recording: status.recording,
        runRecordingActive: status.runRecordingActive,
      });
      throw new Error("Managed replay buffer is not active");
    }
    const result = await managedRecorder.saveReplay(durationSeconds, kind);
    if (!result.ok) {
      throw new Error(result.error ?? "Managed recorder save failed");
    }
    return result.path;
  }

  private showClipPreviewOverlay(clip: ReplayClip): void {
    try {
      void OverlayWindowsService.getInstance()
        .showClipPreviewOverlay(clip)
        .catch((error: unknown) => {
          logWarn("replay-clips", "Replay clip overlay failed", {
            clipId: clip.id,
            error: safeErrorMessage(error),
          });
        });
    } catch (error) {
      logWarn("replay-clips", "Replay clip overlay failed", {
        clipId: clip.id,
        error: safeErrorMessage(error),
      });
    }
  }
}

export { ReplayClipCreationService };
