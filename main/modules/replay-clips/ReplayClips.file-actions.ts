import { stat } from "node:fs/promises";

import { shell } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import {
  createSafePathLogFields,
  logError,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import * as FileClipboard from "~/main/utils/file-clipboard";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

import {
  quickClipTrimMaximumSeconds,
  quickClipTrimMinimumSeconds,
  type ReplayClip,
} from "~/types";
import type {
  ReplayClipBatchFileActionResult,
  ReplayClipCopyInput,
  ReplayClipDetail,
  ReplayClipFileActionResult,
  ReplayClipOperationProgress,
  ReplayClipTrimInput,
  ReplayClipUpdateInput,
  ReplayClipUpdateResult,
} from "./ReplayClips.dto";
import {
  areReplayClipPathsEqual as arePathsEqual,
  commitReplayClipFileUpdate,
  resolveReplayClipRenameTarget,
} from "./ReplayClips.file-operations";
import type { ReplayClipOperationCoordinator } from "./ReplayClips.operations";
import type { ReplayClipPreviewService } from "./ReplayClips.preview";
import {
  copyTrimmedReplayClipToClipboard,
  renderReplayClipQuickTrim,
} from "./ReplayClips.render";
import type { ReplayClipsRepository } from "./ReplayClips.repository";
import type { ReplayClipStorageService } from "./ReplayClips.storage";
import { roundReplayClipSeconds } from "./ReplayClips.utils";

const REPLAY_CLIPS_LOG_SCOPE = "replay-clips";

interface ReplayClipOperationProgressOptions {
  onProgress?: (progress: ReplayClipOperationProgress) => void;
}

interface ReplayClipFileActionsDependencies {
  getClipView: (id: string) => ReplayClipDetail | null;
  operationCoordinator: ReplayClipOperationCoordinator;
  persistAndPublish: (clip: ReplayClip) => void;
  prepareClipPreview: (
    clip: ReplayClip,
    sourcePath: string,
    durationSeconds: number | null,
  ) => Promise<void>;
  previewService: ReplayClipPreviewService;
  readDuration: (path: string | null) => number | null;
  repository: ReplayClipsRepository;
  storageService: ReplayClipStorageService;
}

class ReplayClipFileActionsService {
  constructor(
    private readonly dependencies: ReplayClipFileActionsDependencies,
  ) {}

  async openClip(id: string): Promise<ReplayClipFileActionResult> {
    try {
      const clipPath = this.dependencies.storageService.getStoredClipPath(id);
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
      const clipPath = this.dependencies.storageService.getStoredClipPath(id);
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
    return this.dependencies.operationCoordinator.runIdempotent(
      createReplayClipOperationRequestKey(
        "copy",
        copyInput.id,
        copyInput.operationRequestId,
      ),
      () =>
        this.queueClipFileOperation(copyInput.id, () =>
          this.copyClipToClipboardQueued(copyInput, options),
        ),
    );
  }

  async updateClipFile(
    input: ReplayClipUpdateInput,
    options: ReplayClipOperationProgressOptions = {},
  ): Promise<ReplayClipUpdateResult> {
    return this.dependencies.operationCoordinator.runIdempotent(
      createReplayClipOperationRequestKey(
        "update",
        input.id,
        input.operationRequestId,
      ),
      () =>
        this.queueClipFileOperation(input.id, () =>
          this.queueStoredFileMutation(() =>
            this.updateClipFileQueued(input, options),
          ),
        ),
    );
  }

  async deleteClip(id: string): Promise<ReplayClipFileActionResult> {
    return this.queueClipFileOperation(id, () =>
      this.queueStoredFileMutation(() => this.deleteClipQueued(id)),
    );
  }

  async deleteManyClips(
    ids: string[],
  ): Promise<ReplayClipBatchFileActionResult> {
    return this.dependencies.operationCoordinator.queueClipOperations(ids, () =>
      this.queueStoredFileMutation(() => this.deleteManyClipsQueued(ids)),
    );
  }

  private async copyClipToClipboardQueued(
    copyInput: ReplayClipCopyInput,
    options: ReplayClipOperationProgressOptions,
  ): Promise<ReplayClipFileActionResult> {
    try {
      const clip = this.dependencies.repository.get(copyInput.id);
      if (!clip) {
        return { ok: false, error: "Clip was not found" };
      }

      const clipPath =
        this.dependencies.storageService.getStoredClipPathForClip(clip);
      if (!clipPath) {
        return { ok: false, error: "Clip file path is not available" };
      }

      const durationSeconds =
        this.dependencies.readDuration(clipPath) ??
        clip.durationSeconds ??
        clip.targetDurationSeconds;
      const muteAudio = copyInput.muteAudio === true;
      const trim = copyInput.trim
        ? resolveReplayClipQuickTrim(copyInput.trim, durationSeconds)
        : null;
      const fullRangeTrim = resolveReplayClipQuickTrim(
        { inSeconds: 0, outSeconds: durationSeconds },
        durationSeconds,
      );
      const didTrim = trim
        ? !isReplayClipFullRangeTrim(trim, durationSeconds)
        : false;

      if ((didTrim || muteAudio) && trim) {
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

      if (muteAudio) {
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

  private async updateClipFileQueued(
    input: ReplayClipUpdateInput,
    options: ReplayClipOperationProgressOptions,
  ): Promise<ReplayClipUpdateResult> {
    try {
      const clip = this.dependencies.repository.get(input.id);
      if (!clip) {
        return { ok: false, detail: null, error: "Clip was not found" };
      }

      const sourcePath =
        this.dependencies.storageService.getStoredClipPathForClip(clip);
      if (!sourcePath) {
        return {
          ok: false,
          detail: null,
          error: "Clip file path is not available",
        };
      }

      const knownDurationSeconds =
        this.dependencies.readDuration(sourcePath) ?? clip.durationSeconds;
      const durationSeconds =
        knownDurationSeconds ?? clip.targetDurationSeconds;
      const muteAudio = input.muteAudio === true;
      const trim = input.trim
        ? resolveReplayClipQuickTrim(input.trim, durationSeconds)
        : null;
      const fullRangeTrim = resolveReplayClipQuickTrim(
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
      const shouldRender = didTrim || muteAudio;
      const renderTrim = trim ?? fullRangeTrim;

      if (!shouldRender && !didRename) {
        return {
          ok: true,
          detail: this.dependencies.getClipView(clip.id),
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
          let nextClip = createUpdatedClipForStoredPath({
            clip,
            durationSeconds:
              this.dependencies.readDuration(committedPath) ??
              (didTrim && trim
                ? roundReplayClipSeconds(trim.outSeconds - trim.inSeconds)
                : clip.durationSeconds),
            path: committedPath,
            sizeBytes: fileStats.size,
          });
          nextClip =
            await this.dependencies.storageService.withClipSize(nextClip);
          if (nextClip.sizeBytes <= 0) {
            nextClip = { ...nextClip, sizeBytes: fileStats.size };
          }
          this.dependencies.persistAndPublish(nextClip);
          return nextClip;
        },
        ...(shouldRender
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
      await this.dependencies.prepareClipPreview(
        updatedClip,
        finalPath,
        updatedClip.durationSeconds,
      );
      if (mutation.obsoleteSourcePath) {
        await this.dependencies.storageService.deleteStoredPathIfUnreferenced(
          mutation.obsoleteSourcePath,
        );
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
        detail: this.dependencies.getClipView(updatedClip.id),
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

  private async deleteClipQueued(
    id: string,
    pathReferenceCounts?: Map<string, number>,
  ): Promise<ReplayClipFileActionResult> {
    try {
      const clip = this.dependencies.repository.get(id);
      if (!clip) {
        return { ok: false, error: "Clip was not found" };
      }

      BookmarksService.getInstance().deleteReplayClipLinks(id);
      this.dependencies.repository.delete(id);
      await this.dependencies.previewService.remove(id);
      if (pathReferenceCounts) {
        this.dependencies.storageService.removeClipPathReferences(
          clip,
          pathReferenceCounts,
        );
      }
      try {
        await this.dependencies.storageService.deleteStoredClipFiles(
          clip,
          pathReferenceCounts
            ? (path) =>
                this.dependencies.storageService.isPathReferencedInCounts(
                  path,
                  pathReferenceCounts,
                )
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

  private async deleteManyClipsQueued(
    ids: string[],
  ): Promise<ReplayClipBatchFileActionResult> {
    const deletedIds: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    const cleanupErrors: Array<{ id: string; error: string }> = [];
    const pathReferenceCounts =
      this.dependencies.storageService.createStoredPathReferenceCounts();

    for (const id of ids) {
      const result = await this.deleteClipQueued(id, pathReferenceCounts);
      if (result.ok) {
        deletedIds.push(id);
        if (result.cleanupError) {
          cleanupErrors.push({ id, error: result.cleanupError });
        }
      } else {
        failed.push({ id, error: result.error ?? "Clip delete failed" });
      }
    }

    return {
      ok: failed.length === 0,
      error: failed.length === 0 ? null : "Some clips could not be deleted",
      deletedIds,
      failed,
      ...(cleanupErrors.length > 0 ? { cleanupErrors } : {}),
    };
  }

  private async renderReplayClipQuickTrim(input: {
    muteAudio?: boolean;
    onProgress?: (progress: number) => void;
    outputPath: string;
    sourcePath: string;
    trim: ReplayClipTrimInput;
  }): Promise<void> {
    await renderReplayClipQuickTrim(input);
  }

  private async copyTrimmedClipToClipboard(input: {
    muteAudio?: boolean;
    onProgress?: (progress: number) => void;
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
    return this.dependencies.operationCoordinator.queueClipOperation(
      clipId,
      operation,
    );
  }

  private async queueStoredFileMutation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.dependencies.operationCoordinator.queueStoredFileMutation(
      operation,
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

function resolveReplayClipQuickTrim(
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

function clampReplayClipSeconds(
  value: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) {
    return roundReplayClipSeconds(min);
  }

  return roundReplayClipSeconds(Math.min(Math.max(value, min), max));
}

function createUpdatedClipForStoredPath(input: {
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

function createReplayClipOperationRequestKey(
  operation: "copy" | "update",
  clipId: string,
  requestId: string | null | undefined,
): string | null {
  return requestId ? `${operation}:${clipId}:${requestId}` : null;
}

export {
  createUpdatedClipForStoredPath,
  ReplayClipFileActionsService,
  resolveReplayClipQuickTrim,
};
