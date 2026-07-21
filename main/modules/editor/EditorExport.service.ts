import { randomUUID } from "node:crypto";
import { link, rename, rm, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";

import { app } from "electron";

import {
  createSafePathLogFields,
  logError,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

import type {
  EditorCancelExportInput,
  EditorCancelExportResult,
  EditorExportClipInput,
  EditorExportInput,
  EditorExportLifecycle,
  EditorExportLifecycleUpdate,
  EditorExportPreviewClip,
  EditorExportProgress,
  EditorExportResult,
  EditorMediaReference,
  EditorProject,
  EditorTimelineClip,
} from "./Editor.dto";
import {
  calculateEditorExportDuration,
  createEditorExportSegments,
  createEditorSegmentDiagnostics,
  type EditorResolvedExportClip,
} from "./Editor.export";
import type { renderEditorExportWithFfmpeg } from "./Editor.ffmpeg";
import {
  commitEditorExportOutputPath,
  createEditorExportOutputPath,
  createEditorExportStagingOutputPath,
  EditorTemporaryFileCleanupError,
} from "./Editor.files";

const editorExportProgressIntervalMs = 100;
const maxEditorExportPathEntries = 20;
const editorLogScope = "editor";

const idleEditorExportLifecycle: EditorExportLifecycle = {
  canCancel: false,
  error: null,
  exportRequestId: null,
  fileName: null,
  previewClips: [],
  progress: 0,
  projectId: null,
  result: null,
  startedAt: null,
  status: "idle",
};

type EditorExportRenderer = typeof renderEditorExportWithFfmpeg;

interface EditorExportServiceDependencies {
  createExportClips: (
    clips: EditorExportClipInput[],
  ) => EditorResolvedExportClip[];
  createMediaUrl: (exportId: string) => string;
  linkExportFile?: typeof link;
  persistProjectSnapshot: (project: EditorProject) => EditorProject;
  removeExportFile?: typeof rm;
  renameExportFile?: typeof rename;
  renderExportWithFfmpeg: EditorExportRenderer;
  resolveExportSource: (source: EditorMediaReference) => {
    path: string;
    storageRoot?: string;
  };
  shutdownTimeoutMs: number;
  statExportFile?: (path: string) => Promise<{ size: number }>;
}

interface EditorExportProjectOptions {
  onLifecycleChanged?: (lifecycle: EditorExportLifecycleUpdate) => void;
  onProgress?: (progress: EditorExportProgress) => void;
}

interface ActiveEditorExport {
  abortController: AbortController;
  cleanupError: EditorTemporaryFileCleanupError | null;
  completion: Promise<void>;
  phase: "rendering" | "committing";
  projectId: string | null;
  resolveCompletion: () => void;
}

class EditorExportService {
  private readonly activeExports = new Map<string, ActiveEditorExport>();
  private readonly dependencies: EditorExportServiceDependencies;
  private readonly exportPaths = new Map<string, string>();
  private exportLifecycle: EditorExportLifecycle = idleEditorExportLifecycle;
  private isShuttingDown = false;

  constructor(dependencies: EditorExportServiceDependencies) {
    this.dependencies = dependencies;
  }

  async cancelExport(
    input: EditorCancelExportInput,
  ): Promise<EditorCancelExportResult> {
    const activeExport = this.activeExports.get(input.exportRequestId);
    if (activeExport?.phase !== "rendering") {
      return { cancelled: false };
    }

    logInfo(editorLogScope, "Editor export cancellation requested", {
      exportRequestId: input.exportRequestId,
    });
    activeExport.abortController.abort(
      new DOMException("Editor export cancelled", "AbortError"),
    );

    await activeExport.completion;
    if (activeExport.cleanupError) {
      throw activeExport.cleanupError;
    }

    return { cancelled: true };
  }

  private createActiveExport(
    exportRequestId: string,
    projectId: string | null = null,
  ): ActiveEditorExport {
    if (this.activeExports.has(exportRequestId)) {
      throw new Error("Editor export request is already active");
    }

    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    const activeExport: ActiveEditorExport = {
      abortController: new AbortController(),
      cleanupError: null,
      completion,
      phase: "rendering",
      projectId,
      resolveCompletion,
    };
    this.activeExports.set(exportRequestId, activeExport);

    return activeExport;
  }

  dismissExport(): void {
    if (this.exportLifecycle.status !== "exporting") {
      this.exportLifecycle = idleEditorExportLifecycle;
    }
  }

  async exportProject(
    input: EditorExportInput,
    options: EditorExportProjectOptions = {},
  ): Promise<EditorExportResult> {
    if (this.isShuttingDown) {
      throw new Error("Editor is shutting down");
    }
    if (this.activeExports.size > 0) {
      throw new Error("Another editor video is already processing");
    }

    const activeExport = this.createActiveExport(
      input.exportRequestId,
      input.project.id,
    );
    const startedAt = new Date().toISOString();
    let exportFileName = input.fileName;
    let outputPath: string | null = null;
    let stagingDirectoryPath: string | null = null;
    let tempOutputPath: string | null = null;
    let project = input.project;
    let previewClips: EditorExportPreviewClip[] = [];
    const videosPath = app.getPath("videos");

    try {
      project = this.dependencies.persistProjectSnapshot(project);
      activeExport.projectId = project.id;
      previewClips = createEditorExportPreviewClips(project);
      this.updateExportLifecycle(
        {
          canCancel: true,
          error: null,
          exportRequestId: input.exportRequestId,
          fileName: exportFileName,
          previewClips,
          progress: 0.02,
          projectId: project.id,
          result: null,
          startedAt,
          status: "exporting",
        },
        options.onLifecycleChanged,
        true,
      );

      const inputClips = createEditorProjectExportClipInputs(project);
      const overwriteReference =
        input.mode === "overwrite"
          ? resolveEditorOverwriteSource(project)
          : null;
      if (input.mode === "overwrite" && !overwriteReference) {
        throw new Error("No overwrite source is available to export");
      }
      const clips = this.dependencies.createExportClips(inputClips);
      if (clips.length === 0) {
        logWarn(editorLogScope, "Editor export has no timeline clips", {
          exportRequestId: input.exportRequestId,
          inputClipCount: inputClips.length,
          mode: input.mode,
        });
        throw new Error("No timeline clips are available to export");
      }
      const segments = createEditorExportSegments(
        clips,
        project.durationSeconds,
      );
      const overwriteSource = overwriteReference
        ? this.dependencies.resolveExportSource(overwriteReference)
        : null;

      outputPath = overwriteSource
        ? overwriteSource.path
        : await createEditorExportOutputPath({
            fileName: input.fileName,
            videosPath,
          });
      activeExport.abortController.signal.throwIfAborted();
      const stagingOutput = await createEditorExportStagingOutputPath({
        outputPath,
        storageRoot:
          overwriteSource?.storageRoot ??
          (overwriteSource ? dirname(outputPath) : videosPath),
      });
      stagingDirectoryPath = stagingOutput.directoryPath;
      tempOutputPath = stagingOutput.outputPath;
      exportFileName = basename(outputPath);
      this.updateExportLifecycle(
        {
          ...this.exportLifecycle,
          fileName: exportFileName,
          projectId: project.id,
        },
        options.onLifecycleChanged,
      );

      logInfo(editorLogScope, "Editor export started", {
        exportRequestId: input.exportRequestId,
        inputClipCount: inputClips.length,
        mode: input.mode,
        overwrite: overwriteSource !== null,
        resolution: input.resolution,
        timelineDurationSeconds: project.durationSeconds,
        ...createEditorSegmentDiagnostics(segments),
        ...createSafePathLogFields(outputPath, "export"),
        ...createSafePathLogFields(tempOutputPath, "temporaryExport"),
      });
      let lastProgressSentAt = 0;
      let lastSentProgress = 0;
      await this.dependencies.renderExportWithFfmpeg({
        muteAudio: project.isAudioMuted === true,
        onProgress: (progress) => {
          const exportProgress = {
            exportRequestId: input.exportRequestId,
            progress: Math.min(Math.max(progress, 0), 1),
          };
          this.exportLifecycle.progress = Math.min(
            Math.max(this.exportLifecycle.progress, exportProgress.progress),
            0.98,
          );
          const now = Date.now();
          if (
            exportProgress.progress <= lastSentProgress ||
            (exportProgress.progress < 1 &&
              now - lastProgressSentAt < editorExportProgressIntervalMs)
          ) {
            return;
          }
          lastProgressSentAt = now;
          lastSentProgress = exportProgress.progress;
          options.onProgress?.(exportProgress);
        },
        outputPath: tempOutputPath,
        queueOptions: { signal: activeExport.abortController.signal },
        resolution: input.resolution,
        segments,
        signal: activeExport.abortController.signal,
      });

      activeExport.abortController.signal.throwIfAborted();
      const stats = await (this.dependencies.statExportFile ?? stat)(
        tempOutputPath,
      );
      activeExport.abortController.signal.throwIfAborted();
      activeExport.phase = "committing";
      this.updateExportLifecycle(
        {
          ...this.exportLifecycle,
          canCancel: false,
          progress: Math.max(this.exportLifecycle.progress, 0.98),
        },
        options.onLifecycleChanged,
      );

      if (overwriteSource) {
        await (this.dependencies.renameExportFile ?? rename)(
          tempOutputPath,
          outputPath,
        );
      } else {
        outputPath = await commitEditorExportOutputPath(
          {
            fileName: input.fileName,
            temporaryPath: tempOutputPath,
            videosPath,
          },
          this.dependencies.linkExportFile ?? link,
        );
      }
      tempOutputPath = null;
      const completedStagingDirectory = stagingDirectoryPath;
      stagingDirectoryPath = null;
      try {
        await (this.dependencies.removeExportFile ?? rm)(
          completedStagingDirectory,
          { force: true, recursive: true },
        );
      } catch (cleanupFailure) {
        logWarn(editorLogScope, "Temporary editor export cleanup deferred", {
          error: safeErrorMessage(cleanupFailure),
          ...createSafePathLogFields(
            completedStagingDirectory,
            "temporaryExportDirectory",
          ),
        });
      }
      const exportId = randomUUID();
      this.rememberExportPath(exportId, outputPath);
      const result: EditorExportResult = {
        createdAt: new Date().toISOString(),
        durationSeconds: calculateEditorExportDuration(segments),
        exportId,
        fileName: basename(outputPath),
        mediaUrl: this.dependencies.createMediaUrl(exportId),
        mode: input.mode,
        resolution: input.resolution,
        sizeBytes: stats.size,
      };
      this.updateExportLifecycle(
        {
          canCancel: false,
          error: null,
          exportRequestId: input.exportRequestId,
          fileName: result.fileName,
          previewClips: [],
          progress: 1,
          projectId: project.id,
          result,
          startedAt,
          status: "ready",
        },
        options.onLifecycleChanged,
      );
      logInfo(editorLogScope, "Editor export completed", {
        durationSeconds: calculateEditorExportDuration(segments),
        exportId,
        exportRequestId: input.exportRequestId,
        mode: input.mode,
        resolution: input.resolution,
        sizeBytes: stats.size,
        ...createSafePathLogFields(outputPath, "export"),
      });

      return result;
    } catch (error) {
      const exportLogFields = {
        exportRequestId: input.exportRequestId,
        mode: input.mode,
        ...(outputPath ? createSafePathLogFields(outputPath, "export") : {}),
        ...(tempOutputPath
          ? createSafePathLogFields(tempOutputPath, "temporaryExport")
          : {}),
      };
      let cleanupError =
        error instanceof EditorTemporaryFileCleanupError ? error : null;
      if (stagingDirectoryPath) {
        try {
          await (this.dependencies.removeExportFile ?? rm)(
            stagingDirectoryPath,
            { force: true, recursive: true },
          );
        } catch (cleanupFailure) {
          cleanupError = new EditorTemporaryFileCleanupError(
            "Temporary video files could not be removed",
          );
          logWarn(editorLogScope, "Temporary editor export cleanup failed", {
            error: safeErrorMessage(cleanupFailure),
            ...exportLogFields,
          });
        }
      }
      const isCancelled = activeExport.abortController.signal.aborted;
      activeExport.cleanupError = cleanupError;
      const terminalError = cleanupError
        ? isCancelled
          ? "Video processing stopped, but temporary files could not be removed"
          : "Video saving failed, and temporary files could not be removed"
        : safeErrorMessage(error);
      if (isCancelled) {
        logInfo(editorLogScope, "Editor export cancelled", exportLogFields);
      } else {
        logError(editorLogScope, "Editor export failed", {
          error: safeErrorMessage(error),
          ...exportLogFields,
        });
      }
      this.updateExportLifecycle(
        isCancelled && !cleanupError
          ? idleEditorExportLifecycle
          : {
              canCancel: false,
              error: terminalError,
              exportRequestId: input.exportRequestId,
              fileName: exportFileName,
              previewClips: [],
              progress: 0,
              projectId: project.id,
              result: null,
              startedAt,
              status: "failed",
            },
        options.onLifecycleChanged,
      );
      throw cleanupError ?? error;
    } finally {
      this.activeExports.delete(input.exportRequestId);
      activeExport.resolveCompletion();
    }
  }

  getActiveProjectIds(): string[] {
    return Array.from(
      new Set(
        Array.from(this.activeExports.values())
          .map((activeExport) => activeExport.projectId)
          .filter(
            (projectId): projectId is string => typeof projectId === "string",
          ),
      ),
    );
  }

  getExportLifecycle(): EditorExportLifecycle {
    return this.exportLifecycle;
  }

  getExportPath(exportId: string): string | null {
    return this.exportPaths.get(exportId) ?? null;
  }

  hasActiveExport(): boolean {
    return this.activeExports.size > 0;
  }

  private rememberExportPath(exportId: string, outputPath: string): void {
    this.exportPaths.set(exportId, outputPath);
    while (this.exportPaths.size > maxEditorExportPathEntries) {
      const oldestExportId = this.exportPaths.keys().next().value as
        | string
        | undefined;
      /* v8 ignore next -- Map size check guarantees an oldest key exists. */
      if (!oldestExportId) {
        return;
      }
      this.exportPaths.delete(oldestExportId);
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    const activeExports = [...this.activeExports.values()];
    for (const activeExport of activeExports) {
      if (activeExport.phase === "rendering") {
        activeExport.abortController.abort(
          new DOMException("Application is shutting down", "AbortError"),
        );
      }
    }

    const didFinish = await waitForEditorExportCompletions(
      activeExports.map((activeExport) => activeExport.completion),
      this.dependencies.shutdownTimeoutMs,
    );
    if (!didFinish) {
      logWarn(editorLogScope, "Editor export shutdown timed out", {
        activeExportCount: activeExports.length,
      });
    }
  }

  private updateExportLifecycle(
    lifecycle: EditorExportLifecycle,
    onLifecycleChanged: EditorExportProjectOptions["onLifecycleChanged"],
    includePreview = false,
  ): void {
    this.exportLifecycle = lifecycle;
    if (!onLifecycleChanged) {
      return;
    }
    const { previewClips, ...update } = lifecycle;
    onLifecycleChanged(includePreview ? { ...update, previewClips } : update);
  }
}

function createEditorProjectExportClipInputs(
  project: EditorProject,
): EditorExportClipInput[] {
  const assetByKey = new Map(
    project.assets.map((asset) => [asset.assetKey, asset] as const),
  );
  const videoTrack = project.tracks.find((track) => track.kind === "video");
  if (!videoTrack) {
    return [];
  }

  const clips: EditorExportClipInput[] = [];
  for (const clip of [...videoTrack.clips].sort(
    (first, second) => first.startSeconds - second.startSeconds,
  )) {
    const asset = assetByKey.get(clip.assetKey);
    if (!asset) {
      return [];
    }
    clips.push({
      durationSeconds: clip.durationSeconds,
      inSeconds: clip.inSeconds,
      outSeconds: clip.outSeconds,
      playbackRate: clip.playbackRate,
      source: { id: asset.id, kind: asset.kind },
      startSeconds: clip.startSeconds,
    });
  }

  return clips;
}

function createEditorExportPreviewClips(
  project: EditorProject,
): EditorExportPreviewClip[] {
  return project.tracks
    .flatMap((track) => track.clips)
    .filter(
      (clip): clip is EditorTimelineClip & { mediaUrl: string } =>
        typeof clip.mediaUrl === "string" && clip.mediaUrl.length > 0,
    )
    .sort((first, second) => first.startSeconds - second.startSeconds)
    .map((clip) => ({
      durationSeconds: clip.durationSeconds,
      id: clip.id,
      inSeconds: clip.inSeconds,
      mediaUrl: clip.mediaUrl,
      name: clip.name,
      outSeconds: clip.outSeconds,
      playbackRate: clip.playbackRate,
      startSeconds: clip.startSeconds,
    }));
}

function resolveEditorOverwriteSource(
  project: EditorProject,
): EditorMediaReference | null {
  const videoTrack = project.tracks.find((track) => track.kind === "video");
  const activeClip = videoTrack?.clips.find(
    (clip) => clip.id === project.activeClipId,
  );
  const activeAsset = project.assets.find(
    (asset) => asset.assetKey === activeClip?.assetKey,
  );

  return activeAsset ? { id: activeAsset.id, kind: activeAsset.kind } : null;
}

async function waitForEditorExportCompletions(
  completions: Promise<void>[],
  timeoutMs: number,
): Promise<boolean> {
  if (completions.length === 0) {
    return true;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const completed = Promise.allSettled(completions).then(() => true);
  const timedOut = new Promise<false>((resolve) => {
    timeoutId = setTimeout(() => resolve(false), timeoutMs);
  });
  const didFinish = await Promise.race([completed, timedOut]);
  clearTimeout(timeoutId);

  return didFinish;
}

export type { EditorExportProjectOptions };
export {
  createEditorProjectExportClipInputs,
  EditorExportService,
  waitForEditorExportCompletions,
};
