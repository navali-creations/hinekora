import { createHash, randomUUID } from "node:crypto";
import { rm, stat, unlink } from "node:fs/promises";
import { basename } from "node:path";

import { app, BrowserWindow, shell } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { DatabaseService } from "~/main/modules/database";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import type { ManagedReplayKind } from "~/main/modules/managed-recorder/ManagedRecorder.dto";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { resolveRecordingStorageRoot } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  createSafePathLogFields,
  logError,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import * as FileClipboard from "~/main/utils/file-clipboard";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { readMp4DurationSeconds } from "~/main/utils/media-metadata";

import {
  quickClipTrimMaximumSeconds,
  quickClipTrimMinimumSeconds,
  type ReplayClip,
  type ReplayClipKind,
} from "~/types";
import { ReplayClipsChannel } from "./ReplayClips.channels";
import type {
  DeathEvent,
  ReplayClipBatchFileActionResult,
  ReplayClipCopyInput,
  ReplayClipDetail,
  ReplayClipFileActionResult,
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
  ReplayClipListFilter,
  ReplayClipOperationProgress,
  ReplayClipSourceDetail,
  ReplayClipTrimInput,
  ReplayClipUpdateInput,
  ReplayClipUpdateResult,
  ReplayClipView,
  ReplayTriggerEvent,
} from "./ReplayClips.dto";
import { ReplayClipDuplicateTracker } from "./ReplayClips.duplicates";
import {
  areReplayClipPathsEqual as arePathsEqual,
  commitReplayClipFileUpdate,
  createReplayClipPathKey,
  resolveReplayClipRenameTarget,
} from "./ReplayClips.file-operations";
import {
  resolveReplayClipFilePath,
  sanitizeReplayClipStoragePathList,
} from "./ReplayClips.files";
import { setupReplayClipsIpcHandlers } from "./ReplayClips.ipc";
import {
  type EditorReplayDetailPageInput,
  ReplayClipLibraryService,
} from "./ReplayClips.library";
import { createReplayClipMediaUrl } from "./ReplayClips.media";
import { setupReplayClipMediaProtocol } from "./ReplayClips.protocol";
import {
  copyTrimmedReplayClipToClipboard,
  renderReplayClipQuickTrim,
} from "./ReplayClips.render";
import { ReplayClipsRepository } from "./ReplayClips.repository";
import { roundReplayClipSeconds } from "./ReplayClips.utils";

const REPLAY_CLIPS_LOG_SCOPE = "replay-clips";

interface ReplayClipOperationProgressOptions {
  onProgress?: (progress: ReplayClipOperationProgress) => void;
}

class ReplayClipsService {
  private static instance: ReplayClipsService | null = null;

  private readonly clipFileOperationQueues = new Map<string, Promise<void>>();
  private readonly duplicateTracker = new ReplayClipDuplicateTracker();
  private readonly libraryService: ReplayClipLibraryService;
  private readonly repository: ReplayClipsRepository;
  private activeReplayTriggerEvents: ReplayTriggerEvent[] | null = null;
  private activeReplayTriggerRequest: Promise<ReplayClip | null> | null = null;
  private storedFileMutationQueue: Promise<void> = Promise.resolve();

  static getInstance(): ReplayClipsService {
    if (!ReplayClipsService.instance) {
      ReplayClipsService.instance = new ReplayClipsService();
    }

    return ReplayClipsService.instance;
  }

  static resetForTests(): void {
    ReplayClipsService.instance = null;
  }

  constructor() {
    this.repository = new ReplayClipsRepository(DatabaseService.getInstance());
    this.libraryService = new ReplayClipLibraryService({
      createReplayClipView: (clip) => this.createReplayClipView(clip),
      readReplayClipDuration: (path) => this.readReplayClipDuration(path),
      repository: this.repository,
      resolveClipFilePath: (path, options) =>
        this.resolveClipFilePath(path, options),
      withClipSize: (clip, persist) => this.withClipSizeAsync(clip, persist),
    });
    setupReplayClipsIpcHandlers({
      copyClipToClipboard: (input, options) =>
        this.copyClipToClipboard(input, options),
      createReplayClipView: (clip) => this.createReplayClipView(clip),
      deleteClip: (id) => this.deleteClip(id),
      deleteManyClips: (ids) => this.deleteManyClips(ids),
      getClipView: (id) => this.getClipView(id),
      listLibrary: (query) => this.listLibrary(query),
      openClip: (id) => this.openClip(id),
      revealClip: (id) => this.revealClip(id),
      saveManualReplay: () => this.saveManualReplay(),
      updateClipFile: (input, options) => this.updateClipFile(input, options),
    });
    setupReplayClipMediaProtocol({
      resolveReplayClipPath: (id) => this.getStoredClipMediaPath(id),
      resolveRunRecordingPath: (id) =>
        RecordingStorageService.getInstance().getRecordingMediaPath(id),
    });
  }

  async list(filter: ReplayClipListFilter = {}): Promise<ReplayClip[]> {
    return Promise.all(
      this.repository
        .list(filter)
        .map((clip) => this.withClipSizeAsync(clip, true)),
    );
  }

  getClip(id: string): ReplayClipSourceDetail | null {
    const startedAt = Date.now();
    const clip = this.repository.get(id);
    if (!clip) {
      logWarn(REPLAY_CLIPS_LOG_SCOPE, "Replay preview detail missing", {
        clipId: id,
        elapsedMs: Date.now() - startedAt,
      });
      return null;
    }
    const sizedClip = clip;
    const storedClipPath = this.getStoredClipPathForClip(sizedClip);
    const durationSeconds =
      sizedClip.durationSeconds ?? this.readReplayClipDuration(storedClipPath);

    logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay preview detail resolved", {
      clipId: id,
      durationSeconds,
      elapsedMs: Date.now() - startedAt,
      hasMedia: Boolean(storedClipPath),
      status: sizedClip.status,
    });

    return {
      clip: sizedClip,
      durationSeconds,
      mediaUrl: storedClipPath
        ? createReplayClipMediaUrl(id, sizedClip.updatedAt)
        : null,
    };
  }

  async listEditorReplayDetailPage(
    input: EditorReplayDetailPageInput,
  ): Promise<{ items: ReplayClipSourceDetail[]; totalCount: number }> {
    return this.libraryService.listEditorReplayDetailPage(input);
  }

  async listLibrary(
    query: ReplayClipLibraryQuery = {},
  ): Promise<ReplayClipLibraryPage> {
    return this.libraryService.listLibrary(query);
  }

  replaceAll(
    clips: ReplayClip[],
    storageRoot = this.resolveStorageRoot(),
  ): void {
    this.repository.replaceAll(this.sanitizeClips(clips, storageRoot));
  }

  upsertMany(
    clips: ReplayClip[],
    storageRoot = this.resolveStorageRoot(),
  ): void {
    this.repository.upsertMany(this.sanitizeClips(clips, storageRoot));
  }

  async saveManualReplay(): Promise<ReplayClip | null> {
    const settings = SettingsStoreService.getInstance().get();
    return this.handleReplayTrigger({
      kind: "manual",
      game: settings.activeGame,
      line: "Manual replay save",
      lineHash: this.hashLine(`manual:${Date.now()}`),
      detectedAt: new Date().toISOString(),
    });
  }

  async handleDeathEvent(event: DeathEvent): Promise<ReplayClip | null> {
    return this.handleReplayTrigger({ ...event, kind: "death" });
  }

  async handleReplayTrigger(
    event: ReplayTriggerEvent,
  ): Promise<ReplayClip | null> {
    if (this.activeReplayTriggerRequest) {
      this.activeReplayTriggerEvents!.push(event);
      if (event.kind === "death") {
        BookmarksService.getInstance().rememberReplayClipSession({
          game: event.game,
          triggerLineHash: event.lineHash,
        });
      }
      logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay trigger coalesced", {
        game: event.game,
        kind: event.kind,
        lineHash: event.lineHash,
      });
      return this.activeReplayTriggerRequest;
    }

    const events = [event];
    this.activeReplayTriggerEvents = events;
    const request = this.handleReplayTriggerBatch(event, events).finally(() => {
      if (this.activeReplayTriggerRequest === request) {
        this.activeReplayTriggerRequest = null;
        this.activeReplayTriggerEvents = null;
      }
    });
    this.activeReplayTriggerRequest = request;

    return request;
  }

  private async handleReplayTriggerBatch(
    firstEvent: ReplayTriggerEvent,
    events: ReplayTriggerEvent[],
  ): Promise<ReplayClip | null> {
    const clip = await this.handleReplayTriggerExclusive(firstEvent);
    if (clip?.status !== "ready") {
      return clip;
    }

    const deathEvent = events.find((event) => event.kind === "death");
    const resolvedClip =
      deathEvent && clip.kind !== "death"
        ? this.updateClip(clip, {
            deathTimestamp: deathEvent.detectedAt,
            kind: "death",
            sourceGame: deathEvent.game,
            triggerLineHash: deathEvent.lineHash,
          })
        : clip;

    BookmarksService.getInstance().linkReplayClip(resolvedClip);
    this.cleanupRecordingStorageForClip(resolvedClip);
    return resolvedClip;
  }

  private async handleReplayTriggerExclusive(
    event: ReplayTriggerEvent,
  ): Promise<ReplayClip | null> {
    logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay trigger received", {
      game: event.game,
      kind: event.kind,
      lineHash: event.lineHash,
    });

    if (this.duplicateTracker.isDuplicate(event.lineHash)) {
      const existing = this.repository.getByTriggerLineHash(event.lineHash);
      if (existing) {
        logWarn(REPLAY_CLIPS_LOG_SCOPE, "Duplicate replay trigger ignored", {
          game: event.game,
          kind: event.kind,
          lineHash: event.lineHash,
          clipId: existing.id,
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
    const replayKind = event.kind;
    let clip = this.createClip(
      event.game,
      replayKind,
      event.lineHash,
      event.detectedAt,
    );
    this.persistAndPublish(clip);

    try {
      clip = this.updateClip(clip, { status: "saving_replay" });
      this.showClipPreviewOverlay(clip);
      logInfo(REPLAY_CLIPS_LOG_SCOPE, "Saving replay for trigger", {
        clipId: clip.id,
        backend: "managed",
        kind: replayKind,
        seconds: settings.deathClipSeconds,
      });
      const replayPath = await this.saveManagedReplay(
        settings.deathClipSeconds,
        replayKind,
      );
      if (!replayPath) {
        throw new Error("Recorder did not return a saved replay path");
      }
      const storedReplayPath = this.resolveClipFilePath(replayPath, {
        requireExistingFile: true,
      });
      if (!storedReplayPath) {
        throw new Error(
          "Recorder returned a replay path outside managed storage",
        );
      }

      clip = this.updateClip(clip, {
        originalObsPath: storedReplayPath,
        processedClipPath: storedReplayPath,
        sizeBytes: (await stat(storedReplayPath)).size,
      });
      logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay source saved", {
        clipId: clip.id,
        ...createSafePathLogFields(storedReplayPath, "recording"),
      });

      const readyClip = this.updateClip(clip, {
        status: "ready",
        durationSeconds: this.readReplayClipDuration(storedReplayPath),
      });
      logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay clip ready", {
        clipId: readyClip.id,
      });
      return readyClip;
    } catch (error) {
      logError(REPLAY_CLIPS_LOG_SCOPE, "Replay clip creation failed", {
        clipId: clip.id,
        error: safeErrorMessage(error),
      });
      return this.updateClip(clip, {
        status: "failed",
        error: safeErrorMessage(error),
      });
    }
  }

  private isManagedReplayBufferActive(event: ReplayTriggerEvent): boolean {
    const status = ManagedRecorderService.getInstance().getStatus();
    if (status.bufferActive && status.gameRunning !== false) {
      return true;
    }

    logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay clip skipped: rewind unavailable", {
      game: event.game,
      lineHash: event.lineHash,
      available: status.available,
      gameRunning: status.gameRunning ?? null,
      initialized: status.initialized,
      recording: status.recording,
      runRecordingActive: status.runRecordingActive,
    });

    return false;
  }

  private async saveManagedReplay(
    durationSeconds: number,
    kind: ManagedReplayKind = "death",
  ): Promise<string | null> {
    const managedRecorder = ManagedRecorderService.getInstance();
    const status = managedRecorder.getStatus();
    if (!status.bufferActive) {
      logWarn(
        REPLAY_CLIPS_LOG_SCOPE,
        "Managed replay save blocked: buffer inactive",
        {
          available: status.available,
          initialized: status.initialized,
          recording: status.recording,
          runRecordingActive: status.runRecordingActive,
        },
      );
      throw new Error("Managed replay buffer is not active");
    }

    const result = await managedRecorder.saveReplay(durationSeconds, kind);
    if (!result.ok) {
      throw new Error(result.error ?? "Managed recorder save failed");
    }

    return result.path;
  }

  async openClip(id: string): Promise<ReplayClipFileActionResult> {
    try {
      const clipPath = this.getStoredClipPath(id);
      if (!clipPath) {
        return { ok: false, error: "Clip file path is not available" };
      }

      const error = await shell.openPath(clipPath);

      return { ok: error.length === 0, error: error.length > 0 ? error : null };
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  revealClip(id: string): ReplayClipFileActionResult {
    try {
      const clipPath = this.getStoredClipPath(id);
      if (!clipPath) {
        return { ok: false, error: "Clip file path is not available" };
      }

      shell.showItemInFolder(clipPath);

      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  async copyClipToClipboard(
    input: string | ReplayClipCopyInput,
    options: ReplayClipOperationProgressOptions = {},
  ): Promise<ReplayClipFileActionResult> {
    const copyInput = typeof input === "string" ? { id: input } : input;

    return this.queueClipFileOperation(copyInput.id, () =>
      this.copyClipToClipboardQueued(copyInput, options),
    );
  }

  private async copyClipToClipboardQueued(
    copyInput: ReplayClipCopyInput,
    options: ReplayClipOperationProgressOptions,
  ): Promise<ReplayClipFileActionResult> {
    try {
      const clip = this.repository.get(copyInput.id);
      if (!clip) {
        return { ok: false, error: "Clip was not found" };
      }

      const clipPath = this.getStoredClipPathForClip(clip);
      if (!clipPath) {
        return { ok: false, error: "Clip file path is not available" };
      }

      const durationSeconds =
        this.readReplayClipDuration(clipPath) ??
        clip.durationSeconds ??
        clip.targetDurationSeconds;
      const muteAudio = copyInput.muteAudio === true;
      const trim = copyInput.trim
        ? this.resolveReplayClipQuickTrim(copyInput.trim, durationSeconds)
        : null;
      const fullRangeTrim = this.resolveReplayClipQuickTrim(
        { inSeconds: 0, outSeconds: durationSeconds },
        durationSeconds,
      );
      const didTrim = trim
        ? !isReplayClipFullRangeTrim(trim, durationSeconds)
        : false;
      const shouldRenderTrimmedCopy = didTrim || muteAudio;

      if (shouldRenderTrimmedCopy && trim) {
        const onProgress = createReplayClipOperationProgressHandler(
          copyInput.operationRequestId,
          options,
        );

        return await this.copyTrimmedClipToClipboard({
          ...(onProgress ? { onProgress } : {}),
          sourcePath: clipPath,
          trim,
          ...(muteAudio ? { muteAudio } : {}),
        });
      }

      if (shouldRenderTrimmedCopy && !trim) {
        const onProgress = createReplayClipOperationProgressHandler(
          copyInput.operationRequestId,
          options,
        );

        return await this.copyTrimmedClipToClipboard({
          ...(onProgress ? { onProgress } : {}),
          sourcePath: clipPath,
          trim: fullRangeTrim,
          muteAudio: true,
        });
      }

      return await FileClipboard.copyFileToClipboard(clipPath);
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  async updateClipFile(
    input: ReplayClipUpdateInput,
    options: ReplayClipOperationProgressOptions = {},
  ): Promise<ReplayClipUpdateResult> {
    return this.queueClipFileOperation(input.id, () =>
      this.queueStoredFileMutation(() =>
        this.updateClipFileQueued(input, options),
      ),
    );
  }

  private async updateClipFileQueued(
    input: ReplayClipUpdateInput,
    options: ReplayClipOperationProgressOptions,
  ): Promise<ReplayClipUpdateResult> {
    try {
      const clip = this.repository.get(input.id);
      if (!clip) {
        return { ok: false, detail: null, error: "Clip was not found" };
      }

      const sourcePath = this.getStoredClipPathForClip(clip);
      if (!sourcePath) {
        return {
          ok: false,
          detail: null,
          error: "Clip file path is not available",
        };
      }

      const knownDurationSeconds =
        this.readReplayClipDuration(sourcePath) ?? clip.durationSeconds;
      const durationSeconds =
        knownDurationSeconds ?? clip.targetDurationSeconds;
      const muteAudio = input.muteAudio === true;
      const trim = input.trim
        ? this.resolveReplayClipQuickTrim(input.trim, durationSeconds)
        : null;
      const fullRangeTrim = this.resolveReplayClipQuickTrim(
        { inSeconds: 0, outSeconds: durationSeconds },
        durationSeconds,
      );
      const targetPath = await resolveReplayClipRenameTarget(
        sourcePath,
        input.name ?? null,
      );
      const finalPath = targetPath ?? sourcePath;
      const didRename =
        targetPath !== null && !arePathsEqual(sourcePath, targetPath);
      const didTrim = trim
        ? !isReplayClipFullRangeTrim(trim, durationSeconds)
        : false;
      const shouldRenderTrimmedUpdate = didTrim || muteAudio;
      const renderTrim = trim ?? {
        inSeconds: fullRangeTrim.inSeconds,
        outSeconds: fullRangeTrim.outSeconds,
      };

      if (!shouldRenderTrimmedUpdate && !didTrim && !didRename) {
        return {
          ok: true,
          detail: this.getClipView(clip.id),
          error: null,
        };
      }

      const onProgress = createReplayClipOperationProgressHandler(
        input.operationRequestId,
        options,
      );
      const mutation = await commitReplayClipFileUpdate({
        finalPath,
        onCleanupError: (error, path) => {
          logWarn(REPLAY_CLIPS_LOG_SCOPE, "Replay update cleanup failed", {
            error: safeErrorMessage(error),
            ...createSafePathLogFields(path, "cleanup"),
          });
        },
        persist: async (committedPath) => {
          const fileStats = await stat(committedPath);
          let nextClip = this.createUpdatedClipForStoredPath({
            clip,
            durationSeconds:
              this.readReplayClipDuration(committedPath) ??
              (didTrim && trim
                ? roundReplayClipSeconds(trim.outSeconds - trim.inSeconds)
                : clip.durationSeconds),
            path: committedPath,
            sizeBytes: fileStats.size,
          });
          nextClip = await this.withClipSizeAsync(nextClip);
          if (nextClip.sizeBytes <= 0) {
            nextClip = { ...nextClip, sizeBytes: fileStats.size };
          }
          this.persistAndPublish(nextClip);
          return nextClip;
        },
        ...(shouldRenderTrimmedUpdate && renderTrim
          ? {
              render: (outputPath: string) =>
                this.renderReplayClipQuickTrim({
                  ...(onProgress ? { onProgress } : {}),
                  outputPath,
                  sourcePath,
                  trim: renderTrim,
                  ...(muteAudio ? { muteAudio } : {}),
                }),
            }
          : {}),
        sourcePath,
      });
      const updatedClip = mutation.committedValue;
      if (mutation.obsoleteSourcePath) {
        await this.deleteStoredPathIfUnreferenced(mutation.obsoleteSourcePath);
      }
      logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay clip updated from overlay", {
        clipId: updatedClip.id,
        didRename,
        didTrim,
        durationSeconds: updatedClip.durationSeconds,
        sizeBytes: updatedClip.sizeBytes,
        ...createSafePathLogFields(finalPath, "clip"),
      });

      return {
        ok: true,
        detail: this.getClipView(updatedClip.id),
        error: null,
      };
    } catch (error) {
      logError(REPLAY_CLIPS_LOG_SCOPE, "Replay clip update failed", {
        clipId: input.id,
        error: safeErrorMessage(error),
      });

      return { ok: false, detail: null, error: safeErrorMessage(error) };
    }
  }

  async deleteClip(id: string): Promise<ReplayClipFileActionResult> {
    return this.queueClipFileOperation(id, () =>
      this.queueStoredFileMutation(() => this.deleteClipQueued(id)),
    );
  }

  private async deleteClipQueued(
    id: string,
    pathReferenceCounts?: Map<string, number>,
  ): Promise<ReplayClipFileActionResult> {
    try {
      const clip = this.repository.get(id);
      if (!clip) {
        return { ok: false, error: "Clip was not found" };
      }

      BookmarksService.getInstance().deleteReplayClipLinks(id);
      this.repository.delete(id);
      if (pathReferenceCounts) {
        this.removeClipPathReferences(clip, pathReferenceCounts);
      }
      try {
        await this.deleteStoredClipFiles(
          clip,
          pathReferenceCounts
            ? (path) =>
                (pathReferenceCounts.get(createReplayClipPathKey(path)) ?? 0) >
                0
            : undefined,
        );
      } catch (error) {
        const cleanupError = safeErrorMessage(error);
        logWarn(REPLAY_CLIPS_LOG_SCOPE, "Replay clip file cleanup failed", {
          clipId: clip.id,
          error: cleanupError,
        });

        return { ok: true, error: null, cleanupError };
      }

      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  async deleteManyClips(
    ids: string[],
  ): Promise<ReplayClipBatchFileActionResult> {
    return this.queueStoredFileMutation(() => this.deleteManyClipsQueued(ids));
  }

  private async deleteManyClipsQueued(
    ids: string[],
  ): Promise<ReplayClipBatchFileActionResult> {
    const deletedIds: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    const cleanupErrors: Array<{ id: string; error: string }> = [];

    const pathReferenceCounts = this.createStoredPathReferenceCounts();
    for (const id of ids) {
      const result = await this.deleteClipQueued(id, pathReferenceCounts);
      if (result.ok) {
        deletedIds.push(id);
        if (result.cleanupError) {
          cleanupErrors.push({ id, error: result.cleanupError });
        }
        continue;
      }

      failed.push({ id, error: result.error ?? "Clip delete failed" });
    }

    return {
      ok: failed.length === 0,
      error: failed.length === 0 ? null : "Some clips could not be deleted",
      deletedIds,
      failed,
      ...(cleanupErrors.length > 0 ? { cleanupErrors } : {}),
    };
  }

  private createClip(
    game: ReplayClip["sourceGame"],
    kind: ReplayClipKind,
    lineHash: string,
    detectedAt: string,
  ): ReplayClip {
    const now = new Date().toISOString();
    const settings = SettingsStoreService.getInstance().get();

    return {
      id: randomUUID(),
      kind,
      status: "death_detected",
      sourceGame: game,
      sourceLeague: settings.activeLeague,
      deathTimestamp: detectedAt,
      triggerLineHash: lineHash,
      originalObsPath: null,
      processedClipPath: null,
      targetDurationSeconds: settings.deathClipSeconds,
      durationSeconds: null,
      sizeBytes: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private updateClip(
    clip: ReplayClip,
    update: Partial<ReplayClip>,
  ): ReplayClip {
    const updated: ReplayClip = {
      ...clip,
      ...update,
      updatedAt: new Date().toISOString(),
    };
    this.persistAndPublish(updated);

    return updated;
  }

  private showClipPreviewOverlay(clip: ReplayClip): void {
    try {
      void OverlayWindowsService.getInstance()
        .showClipPreviewOverlay(clip)
        .catch((error: unknown) => {
          logWarn(REPLAY_CLIPS_LOG_SCOPE, "Replay clip overlay failed", {
            clipId: clip.id,
            error: safeErrorMessage(error),
          });
        });
    } catch (error) {
      logWarn(REPLAY_CLIPS_LOG_SCOPE, "Replay clip overlay failed", {
        clipId: clip.id,
        error: safeErrorMessage(error),
      });
    }
  }

  private cleanupRecordingStorageForClip(clip: ReplayClip): void {
    try {
      RecordingStorageService.getInstance().cleanup({
        protectedPaths: [clip.processedClipPath, clip.originalObsPath].filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        ),
      });
    } catch (error) {
      logWarn(REPLAY_CLIPS_LOG_SCOPE, "Recording storage cleanup failed", {
        clipId: clip.id,
        error: safeErrorMessage(error),
      });
    }
  }

  private persistAndPublish(clip: ReplayClip): void {
    const publishedClip = clip;
    this.repository.upsert(publishedClip);
    const publishedView = this.createReplayClipView(publishedClip);
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(
          ReplayClipsChannel.StatusChanged,
          publishedView,
        );
      }
    }
  }

  private getStoredClipPath(id: string): string | null {
    const clip = this.repository.get(id);
    if (!clip) {
      return null;
    }

    return this.getStoredClipPathForClip(clip);
  }

  private getStoredClipMediaPath(id: string): string | null {
    const clip = this.repository.get(id);
    if (!clip) {
      return null;
    }

    return this.resolveClipFilePath(
      clip.processedClipPath ?? clip.originalObsPath,
      { requireExistingFile: false },
    );
  }

  private getStoredClipPathForClip(clip: ReplayClip): string | null {
    return this.resolveClipFilePath(
      clip.processedClipPath ?? clip.originalObsPath,
      {
        requireExistingFile: true,
        requireNonEmptyFile: true,
      },
    );
  }

  private getClipView(id: string): ReplayClipDetail | null {
    const detail = this.getClip(id);
    if (!detail) {
      return null;
    }

    return {
      ...detail,
      clip: this.createReplayClipView(detail.clip, Boolean(detail.mediaUrl)),
    };
  }

  private createReplayClipView(
    clip: ReplayClip,
    hasMediaFile = Boolean(
      (clip.processedClipPath ?? clip.originalObsPath) && clip.sizeBytes > 0,
    ),
  ): ReplayClipView {
    const { originalObsPath, processedClipPath, ...view } = clip;
    const mediaPath = processedClipPath ?? originalObsPath;

    return {
      ...view,
      fileName: mediaPath ? basename(mediaPath) : null,
      hasMediaFile: Boolean(mediaPath && hasMediaFile),
    };
  }

  private readReplayClipDuration(path: string | null): number | null {
    return path ? readMp4DurationSeconds(path) : null;
  }

  private async renderReplayClipQuickTrim(input: {
    onProgress?: (progress: number) => void;
    muteAudio?: boolean;
    outputPath: string;
    sourcePath: string;
    trim: ReplayClipTrimInput;
  }): Promise<void> {
    await renderReplayClipQuickTrim(input);
  }

  private async copyTrimmedClipToClipboard(input: {
    onProgress?: (progress: number) => void;
    muteAudio?: boolean;
    sourcePath: string;
    trim: ReplayClipTrimInput;
  }): Promise<ReplayClipFileActionResult> {
    return copyTrimmedReplayClipToClipboard({
      ...input,
      render: (outputPath) =>
        this.renderReplayClipQuickTrim({ ...input, outputPath }),
    });
  }

  private async queueClipFileOperation<T>(
    clipId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous =
      this.clipFileOperationQueues.get(clipId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(operation);
    const queued = run.then(
      () => undefined,
      () => {
        /* v8 ignore next */
        return undefined;
      },
    );
    this.clipFileOperationQueues.set(clipId, queued);

    try {
      return await run;
    } finally {
      if (this.clipFileOperationQueues.get(clipId) === queued) {
        this.clipFileOperationQueues.delete(clipId);
      }
    }
  }

  private async queueStoredFileMutation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const run = this.storedFileMutationQueue
      .catch(() => undefined)
      .then(operation);
    this.storedFileMutationQueue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  private resolveReplayClipQuickTrim(
    trim: ReplayClipTrimInput,
    durationSeconds: number,
  ): ReplayClipTrimInput {
    const duration = Number.isFinite(durationSeconds)
      ? Math.max(
          roundReplayClipSeconds(durationSeconds),
          quickClipTrimMinimumSeconds,
        )
      : quickClipTrimMaximumSeconds;
    const minimumTrimSeconds = Math.min(quickClipTrimMinimumSeconds, duration);
    const inSeconds = clampReplayClipSeconds(
      trim.inSeconds,
      0,
      Math.max(0, duration - minimumTrimSeconds),
    );
    const outSeconds = clampReplayClipSeconds(
      trim.outSeconds,
      inSeconds + minimumTrimSeconds,
      duration,
    );

    return { inSeconds, outSeconds };
  }

  private createUpdatedClipForStoredPath(input: {
    clip: ReplayClip;
    durationSeconds: number | null;
    path: string;
    sizeBytes: number;
  }): ReplayClip {
    const hasProcessedPath =
      typeof input.clip.processedClipPath === "string" &&
      input.clip.processedClipPath.length > 0;
    const originalMatchesProcessed =
      input.clip.originalObsPath !== null &&
      input.clip.processedClipPath !== null &&
      arePathsEqual(input.clip.originalObsPath, input.clip.processedClipPath);

    return {
      ...input.clip,
      durationSeconds: input.durationSeconds,
      error: null,
      originalObsPath:
        !hasProcessedPath || originalMatchesProcessed
          ? input.path
          : input.clip.originalObsPath,
      processedClipPath: hasProcessedPath ? input.path : null,
      sizeBytes: input.sizeBytes,
      status: "ready",
      updatedAt: new Date().toISOString(),
    };
  }

  private async deleteStoredClipFiles(
    clip: ReplayClip,
    isReferenced: (path: string) => boolean = (path) =>
      this.isStoredPathReferenced(path),
  ): Promise<void> {
    const paths = new Set(
      [clip.processedClipPath, clip.originalObsPath].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      ),
    );

    for (const path of paths) {
      const storedPath = this.resolveClipFilePath(path, {
        requireExistingFile: true,
      });
      if (!storedPath) {
        continue;
      }

      if (isReferenced(storedPath)) {
        logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay clip file retained", {
          clipId: clip.id,
          reason: "shared-path",
          ...createSafePathLogFields(storedPath, "recording"),
        });
        continue;
      }

      await unlink(storedPath);
    }
  }

  private async deleteStoredPathIfUnreferenced(path: string): Promise<void> {
    if (this.isStoredPathReferenced(path)) {
      return;
    }

    try {
      await rm(path, { force: true });
    } catch (error) {
      logWarn(REPLAY_CLIPS_LOG_SCOPE, "Obsolete replay file cleanup failed", {
        error: safeErrorMessage(error),
        ...createSafePathLogFields(path, "recording"),
      });
    }
  }

  private isStoredPathReferenced(path: string): boolean {
    return this.repository
      .listStoragePaths()
      .some((clip) =>
        [clip.processedClipPath, clip.originalObsPath].some(
          (candidate) => candidate !== null && arePathsEqual(candidate, path),
        ),
      );
  }

  private createStoredPathReferenceCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const clip of this.repository.listStoragePaths()) {
      const paths = new Set(
        [clip.processedClipPath, clip.originalObsPath]
          .filter((path): path is string => path !== null)
          .map(createReplayClipPathKey),
      );
      for (const path of paths) {
        counts.set(path, (counts.get(path) ?? 0) + 1);
      }
    }
    return counts;
  }

  private removeClipPathReferences(
    clip: ReplayClip,
    counts: Map<string, number>,
  ): void {
    const paths = new Set(
      [clip.processedClipPath, clip.originalObsPath]
        .filter((path): path is string => path !== null)
        .map(createReplayClipPathKey),
    );
    for (const path of paths) {
      const nextCount = Math.max(0, counts.get(path)! - 1);
      if (nextCount === 0) {
        counts.delete(path);
      } else {
        counts.set(path, nextCount);
      }
    }
  }

  private hashLine(line: string): string {
    return createHash("sha256").update(line).digest("hex").slice(0, 32);
  }

  private sanitizeClips(
    clips: ReplayClip[],
    storageRoot: string,
  ): ReplayClip[] {
    return sanitizeReplayClipStoragePathList(clips, storageRoot);
  }

  private async withClipSizeAsync(
    clip: ReplayClip,
    persist = false,
  ): Promise<ReplayClip> {
    const paths = new Set(
      [clip.processedClipPath, clip.originalObsPath].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      ),
    );
    const sizes = await Promise.all(
      Array.from(paths, async (path) => {
        const storedPath = this.resolveClipFilePath(path, {
          requireExistingFile: false,
        });
        if (!storedPath) {
          return 0;
        }

        try {
          const fileStats = await stat(storedPath);
          return fileStats.isFile() ? fileStats.size : 0;
        } catch {
          return 0;
        }
      }),
    );

    const sizeBytes = sizes.reduce((total, size) => total + size, 0);
    if (persist && sizeBytes !== clip.sizeBytes) {
      this.repository.updateSize(clip.id, sizeBytes);
    }

    return sizeBytes === clip.sizeBytes ? clip : { ...clip, sizeBytes };
  }

  private resolveClipFilePath(
    path: string | null | undefined,
    options: { requireExistingFile?: boolean; requireNonEmptyFile?: boolean },
  ): string | null {
    return resolveReplayClipFilePath(path, {
      storageRoot: this.resolveStorageRoot(),
      ...options,
    });
  }

  private resolveStorageRoot(): string {
    const settings = SettingsStoreService.getInstance().get();
    return resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      app.getPath("videos"),
    );
  }
}

function isReplayClipFullRangeTrim(
  trim: ReplayClipTrimInput,
  durationSeconds: number,
): boolean {
  return (
    trim.inSeconds <= 0.001 &&
    Math.abs(trim.outSeconds - durationSeconds) <= 0.001
  );
}

function createReplayClipOperationProgressHandler(
  operationRequestId: string | null | undefined,
  options: ReplayClipOperationProgressOptions,
): ((progress: number) => void) | undefined {
  if (!operationRequestId || !options.onProgress) {
    return undefined;
  }

  return (progress) => {
    options.onProgress?.({
      operationRequestId,
      progress: Math.min(Math.max(progress, 0), 1),
    });
  };
}

function clampReplayClipSeconds(
  value: number,
  min: number,
  max: number,
): number {
  /* c8 ignore next 1 */
  if (max < min) {
    return roundReplayClipSeconds(min);
  }

  if (!Number.isFinite(value)) {
    return roundReplayClipSeconds(min);
  }

  return roundReplayClipSeconds(Math.min(Math.max(value, min), max));
}

export { ReplayClipsService };
