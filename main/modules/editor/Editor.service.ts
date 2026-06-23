import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, rename, rm, stat } from "node:fs/promises";
import { basename } from "node:path";

import type { WebContents } from "electron";
import { app, protocol, shell } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { resolveRecordingStorageRoot } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { resolveReplayClipFilePath } from "~/main/modules/replay-clips/ReplayClips.files";
import { createReplayClipMediaFileResponse } from "~/main/modules/replay-clips/ReplayClips.media";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  createSafePathLogFields,
  createTextHash,
  logError,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import * as FileClipboard from "~/main/utils/file-clipboard";
import {
  assertString,
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import { EditorChannel } from "./Editor.channels";
import type {
  EditorCopyToClipboardInput,
  EditorCreateProjectInput,
  EditorExportClipInput,
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportProgress,
  EditorExportResult,
  EditorMediaAsset,
  EditorMediaReference,
  EditorProject,
  EditorSaveProjectInput,
  EditorTimelineClip,
  EditorWorkspace,
  EditorWorkspaceQuery,
} from "./Editor.dto";
import {
  calculateEditorExportDuration,
  createEditorExportSegments,
  type EditorExportSegment,
  type EditorResolvedExportClip,
} from "./Editor.export";
import { renderEditorExportWithFfmpeg } from "./Editor.ffmpeg";
import {
  cleanupEditorClipboardOutputDirectory,
  createEditorClipboardOutputPath,
  createEditorExportOutputPath,
  createEditorExportTempOutputPath,
} from "./Editor.files";
import {
  createEditorAssetFromRecording,
  createEditorAssetFromReplayClip,
  createEditorProjectFromAssets,
  normalizeAssetDuration,
  sortEditorAssets,
} from "./Editor.mapper";
import {
  validateEditorCopyToClipboardInput,
  validateEditorCreateProjectInput,
  validateEditorExportInput,
  validateEditorSaveProjectInput,
  validateEditorWorkspaceQuery,
} from "./Editor.validation";
import { EditorProjectRepository } from "./EditorProject.repository";

const recentAssetPageSize = 50;
const defaultEditorProjectListLimit = 5;
const maxEditorExportPathEntries = 20;
const editorExportMediaScheme = "hinekora-editor-export";
const editorLogScope = "editor";

type EditorExportRenderer = typeof renderEditorExportWithFfmpeg;

interface EditorServiceDependencies {
  projectRepository?: EditorProjectRepository;
  renderExportWithFfmpeg?: EditorExportRenderer;
}

interface EditorExportProjectOptions {
  onProgress?: (progress: EditorExportProgress) => void;
}

class EditorService {
  private static instance: EditorService | null = null;
  private readonly exportPaths = new Map<string, string>();
  private readonly projectRepository: EditorProjectRepository;
  private readonly renderExportWithFfmpeg: EditorExportRenderer;

  static getInstance(): EditorService {
    if (!EditorService.instance) {
      EditorService.instance = new EditorService();
    }

    return EditorService.instance;
  }

  static resetForTests(): void {
    EditorService.instance = null;
  }

  constructor(dependencies: EditorServiceDependencies = {}) {
    this.projectRepository =
      dependencies.projectRepository ??
      new EditorProjectRepository(DatabaseService.getInstance());
    this.renderExportWithFfmpeg =
      dependencies.renderExportWithFfmpeg ?? renderEditorExportWithFfmpeg;
    this.setupHandlers();
    this.setupExportMediaProtocol();
  }

  getWorkspace(query: EditorWorkspaceQuery = {}): EditorWorkspace {
    const assets = this.listEditorAssets();
    const project = this.resolveWorkspaceProject(assets, query);
    const projectList = this.projectRepository.list({
      limit: query.projectLimit ?? defaultEditorProjectListLimit,
    });

    logInfo(editorLogScope, "Editor workspace loaded", {
      assetCount: assets.length,
      hasMoreProjects: projectList.hasMore,
      projectCount: projectList.projects.length,
      projectDurationSeconds: project.durationSeconds,
      queryProjectIdHash: query.projectId
        ? createTextHash(query.projectId)
        : null,
      querySourceIdHash: query.source ? createTextHash(query.source.id) : null,
      querySourceKind: query.source?.kind ?? null,
      ...createEditorAssetDiagnostics(assets),
      ...createEditorProjectDiagnostics(project),
    });

    return {
      assets,
      hasMoreProjects: projectList.hasMore,
      project,
      projects: projectList.projects,
    };
  }

  createProject(input: EditorCreateProjectInput = {}): EditorProject {
    const project = this.createProjectFromAssetList(
      this.listEditorAssets(),
      input,
    );
    this.projectRepository.upsert(project);
    logInfo(editorLogScope, "Editor project created", {
      projectIdHash: createTextHash(project.id),
      titleHash: createTextHash(project.title),
      ...createEditorAssetDiagnostics(project.assets),
      ...createEditorProjectDiagnostics(project),
    });

    return project;
  }

  saveProject(input: EditorSaveProjectInput): EditorProject {
    const refreshedProject = this.refreshEditorProjectMedia(
      input.project,
      this.listEditorAssets(),
    );
    const project = {
      ...refreshedProject,
      updatedAt: new Date().toISOString(),
    };
    this.projectRepository.upsert(project);
    logInfo(editorLogScope, "Editor project saved", {
      projectIdHash: createTextHash(project.id),
      titleHash: createTextHash(project.title),
      ...createEditorAssetDiagnostics(project.assets),
      ...createEditorProjectDiagnostics(project),
    });

    return project;
  }

  deleteProject(projectId: string): EditorWorkspace {
    this.projectRepository.delete(projectId);
    logInfo(editorLogScope, "Editor project deleted", {
      projectIdHash: createTextHash(projectId),
    });

    return this.getWorkspace();
  }

  async exportProject(
    input: EditorExportInput,
    options: EditorExportProjectOptions = {},
  ): Promise<EditorExportResult> {
    const clips = this.createExportClips(input.clips);
    if (clips.length === 0) {
      logWarn(editorLogScope, "Editor export has no timeline clips", {
        exportRequestId: input.exportRequestId,
        inputClipCount: input.clips.length,
        mode: input.mode,
      });
      throw new Error("No timeline clips are available to export");
    }
    const segments = createEditorExportSegments(clips, input.durationSeconds);

    const overwriteSource =
      input.mode === "overwrite" && input.overwriteSource
        ? this.resolveExportSource(input.overwriteSource)
        : null;
    if (input.mode === "overwrite" && !overwriteSource) {
      throw new Error("No overwrite source is available to export");
    }

    const outputPath = overwriteSource
      ? overwriteSource.path
      : await createEditorExportOutputPath({
          fileName: input.fileName,
          videosPath: app.getPath("videos"),
        });
    const tempOutputPath = createEditorExportTempOutputPath(outputPath);

    try {
      logInfo(editorLogScope, "Editor export started", {
        exportRequestId: input.exportRequestId,
        inputClipCount: input.clips.length,
        mode: input.mode,
        overwrite: overwriteSource !== null,
        resolution: input.resolution,
        timelineDurationSeconds: input.durationSeconds,
        ...createEditorSegmentDiagnostics(segments),
        ...createSafePathLogFields(outputPath, "export"),
        ...createSafePathLogFields(tempOutputPath, "temporaryExport"),
      });
      await this.renderExportWithFfmpeg({
        onProgress: (progress) => {
          options.onProgress?.({
            exportRequestId: input.exportRequestId,
            progress: Math.min(Math.max(progress, 0), 1),
          });
        },
        outputPath: tempOutputPath,
        resolution: input.resolution,
        segments,
      });

      if (overwriteSource) {
        await copyFile(tempOutputPath, outputPath);
        await rm(tempOutputPath, { force: true });
      } else {
        await rename(tempOutputPath, outputPath);
      }
    } catch (error) {
      logError(editorLogScope, "Editor export failed", {
        error: safeErrorMessage(error),
        exportRequestId: input.exportRequestId,
        mode: input.mode,
        ...createSafePathLogFields(outputPath, "export"),
        ...createSafePathLogFields(tempOutputPath, "temporaryExport"),
      });
      await rm(tempOutputPath, { force: true });
      throw error;
    }

    const stats = await stat(outputPath);
    const exportId = randomUUID();
    this.rememberExportPath(exportId, outputPath);

    const result: EditorExportResult = {
      createdAt: new Date().toISOString(),
      durationSeconds: calculateEditorExportDuration(segments),
      exportId,
      fileName: basename(outputPath),
      mediaUrl: this.createExportMediaUrl(exportId),
      mode: input.mode,
      resolution: input.resolution,
      sizeBytes: stats.size,
    };
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
  }

  revealExport(exportId: string): EditorExportFileActionResult {
    try {
      const exportPath = this.exportPaths.get(exportId);
      if (!exportPath || !existsSync(exportPath)) {
        return { ok: false, error: "Exported file is not available" };
      }

      shell.showItemInFolder(exportPath);

      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  async copyExport(exportId: string): Promise<EditorExportFileActionResult> {
    try {
      const exportPath = this.exportPaths.get(exportId);
      if (!exportPath || !existsSync(exportPath)) {
        logWarn(editorLogScope, "Export clipboard copy unavailable", {
          exportId,
        });

        return { ok: false, error: "Exported file is not available" };
      }

      logInfo(editorLogScope, "Copying exported video to clipboard", {
        exportId,
        ...createSafePathLogFields(exportPath, "export"),
      });

      const result = await FileClipboard.copyFileToClipboard(exportPath);
      if (result.ok) {
        logInfo(editorLogScope, "Exported video copied to clipboard", {
          exportId,
          ...createSafePathLogFields(exportPath, "export"),
        });
      } else {
        logWarn(editorLogScope, "Export clipboard copy failed", {
          error: result.error,
          exportId,
          ...createSafePathLogFields(exportPath, "export"),
        });
      }

      return result;
    } catch (error) {
      logError(editorLogScope, "Export clipboard copy crashed", {
        error: safeErrorMessage(error),
        exportId,
      });

      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  async copyProjectToClipboard(
    input: EditorCopyToClipboardInput,
  ): Promise<EditorExportFileActionResult> {
    const clips = this.createExportClips(input.clips);
    if (clips.length === 0) {
      logWarn(editorLogScope, "Editor clipboard copy has no timeline clips");

      return { ok: false, error: "No timeline clips are available to copy" };
    }

    const segments = createEditorExportSegments(clips, input.durationSeconds);
    const outputPath = await createEditorClipboardOutputPath({
      fileName: input.fileName,
      tempPath: app.getPath("temp"),
    });

    try {
      logInfo(editorLogScope, "Rendering editor clipboard video", {
        clipCount: clips.length,
        durationSeconds: calculateEditorExportDuration(segments),
        resolution: input.resolution,
        ...createEditorSegmentDiagnostics(segments),
        ...createSafePathLogFields(outputPath, "clipboard"),
      });

      await this.renderExportWithFfmpeg({
        outputPath,
        resolution: input.resolution,
        segments,
      });

      const result = await FileClipboard.copyFileToClipboard(outputPath);
      if (!result.ok) {
        logWarn(editorLogScope, "Editor clipboard copy failed", {
          error: result.error,
          ...createSafePathLogFields(outputPath, "clipboard"),
        });
        await rm(outputPath, { force: true });
      } else {
        logInfo(editorLogScope, "Editor clipboard video copied", {
          ...createSafePathLogFields(outputPath, "clipboard"),
        });
        await cleanupEditorClipboardOutputDirectory({
          protectedPath: outputPath,
          tempPath: app.getPath("temp"),
        }).catch((error) => {
          logWarn(editorLogScope, "Editor clipboard cleanup failed", {
            error: safeErrorMessage(error),
            ...createSafePathLogFields(outputPath, "clipboard"),
          });
        });
      }

      return result;
    } catch (error) {
      logError(editorLogScope, "Editor clipboard copy crashed", {
        error: safeErrorMessage(error),
        ...createSafePathLogFields(outputPath, "clipboard"),
      });
      await rm(outputPath, { force: true });

      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  private listEditorAssets(): EditorMediaAsset[] {
    const replayClips = ReplayClipsService.getInstance();
    const recordings = RecordingStorageService.getInstance();
    const deathClips = replayClips.listRecentEditorReplayDetails({
      kind: "death",
      limit: recentAssetPageSize,
    });
    const manualClips = replayClips.listRecentEditorReplayDetails({
      kind: "manual",
      limit: recentAssetPageSize,
    });
    const runRecordings =
      recordings.listRecentEditorRecordingDetails(recentAssetPageSize);
    const clipAssets = [...deathClips, ...manualClips].map((detail) =>
      createEditorAssetFromReplayClip(detail),
    );
    const recordingAssets = runRecordings.map((detail) =>
      createEditorAssetFromRecording(detail),
    );

    return sortEditorAssets([...clipAssets, ...recordingAssets]).slice(
      0,
      recentAssetPageSize * 2,
    );
  }

  private createProjectFromAssetList(
    assets: EditorMediaAsset[],
    input: EditorCreateProjectInput | EditorWorkspaceQuery,
  ): EditorProject {
    const selectedAssets = this.resolveProjectAssets(assets, input);
    const projectInput = {
      assets: selectedAssets,
      id: randomUUID(),
      now: new Date().toISOString(),
    };

    return "title" in input && input.title
      ? createEditorProjectFromAssets({ ...projectInput, title: input.title })
      : createEditorProjectFromAssets(projectInput);
  }

  private resolveProjectAssets(
    assets: EditorMediaAsset[],
    input: EditorCreateProjectInput | EditorWorkspaceQuery,
  ): EditorMediaAsset[] {
    if ("assetKeys" in input && input.assetKeys && input.assetKeys.length > 0) {
      const assetByKey = new Map(
        assets.map((asset) => [asset.assetKey, asset] as const),
      );
      const missingAssetKeys = input.assetKeys.filter(
        (assetKey) => !assetByKey.has(assetKey),
      );
      if (missingAssetKeys.length > 0) {
        logWarn(editorLogScope, "Editor project requested missing assets", {
          firstMissingAssetKeyHash: createTextHash(
            missingAssetKeys[0] as string,
          ),
          missingAssetCount: missingAssetKeys.length,
          requestedAssetCount: input.assetKeys.length,
        });
      }

      return input.assetKeys
        .map((assetKey) => assetByKey.get(assetKey))
        .filter((asset): asset is EditorMediaAsset => asset !== undefined);
    }

    if (input.source) {
      const selectedAsset = assets.find(
        (asset) =>
          asset.kind === input.source?.kind && asset.id === input.source.id,
      );
      if (!selectedAsset) {
        logWarn(editorLogScope, "Editor project source was not found", {
          sourceIdHash: createTextHash(input.source.id),
          sourceKind: input.source.kind,
        });
      }

      return selectedAsset ? [selectedAsset] : [];
    }

    return [];
  }

  private resolveWorkspaceProject(
    assets: EditorMediaAsset[],
    query: EditorWorkspaceQuery,
  ): EditorProject {
    if (query.projectId) {
      const project = this.projectRepository.get(query.projectId);
      if (project) {
        return this.refreshEditorProjectMedia(project, assets);
      }
    }

    return this.createProjectFromAssetList(assets, query);
  }

  private refreshEditorProjectMedia(
    project: EditorProject,
    refreshedAssets: EditorMediaAsset[],
  ): EditorProject {
    const currentAssetByKey = new Map(
      project.assets.map((asset) => [asset.assetKey, asset] as const),
    );
    const refreshedAssetByKey = new Map(
      refreshedAssets.map((asset) => [asset.assetKey, asset] as const),
    );
    const assetKeys = new Set([
      ...project.assets.map((asset) => asset.assetKey),
      ...project.tracks.flatMap((track) =>
        track.clips.map((clip) => clip.assetKey),
      ),
    ]);
    const assets = Array.from(assetKeys)
      .map(
        (assetKey) =>
          refreshedAssetByKey.get(assetKey) ?? currentAssetByKey.get(assetKey),
      )
      .filter((asset): asset is EditorMediaAsset => asset !== undefined);
    const staleAssetKeys = Array.from(assetKeys).filter(
      (assetKey) =>
        currentAssetByKey.has(assetKey) && !refreshedAssetByKey.has(assetKey),
    );
    if (staleAssetKeys.length > 0) {
      logWarn(editorLogScope, "Editor project kept stale media metadata", {
        firstStaleAssetKeyHash: createTextHash(staleAssetKeys[0] as string),
        projectIdHash: createTextHash(project.id),
        staleAssetCount: staleAssetKeys.length,
      });
    }
    let recoveredClipDurationCount = 0;
    const tracks = project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        const refreshedAsset = refreshedAssetByKey.get(clip.assetKey);
        if (!refreshedAsset) {
          return clip;
        }

        const currentAsset = currentAssetByKey.get(clip.assetKey);
        const recoveredDurationSeconds =
          resolveRecoveredPlaceholderClipDuration({
            clip,
            currentAsset,
            refreshedAsset,
          });
        if (recoveredDurationSeconds !== null) {
          recoveredClipDurationCount += 1;
        }

        return {
          ...clip,
          ...(recoveredDurationSeconds !== null
            ? {
                durationSeconds: recoveredDurationSeconds,
                outSeconds: recoveredDurationSeconds,
                sourceOutSeconds: recoveredDurationSeconds,
              }
            : {}),
          mediaUrl: refreshedAsset.mediaUrl,
          name: refreshedAsset.name,
        };
      }),
    }));
    if (recoveredClipDurationCount > 0) {
      logInfo(editorLogScope, "Editor project recovered media durations", {
        projectIdHash: createTextHash(project.id),
        recoveredClipDurationCount,
      });
    }

    return {
      ...project,
      assets,
      durationSeconds: calculateEditorProjectTimelineDuration(tracks),
      tracks,
    };
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      EditorChannel.CopyExport,
      [WindowName.Main],
      async (_event, exportId: unknown) => {
        try {
          assertString(exportId, "export id", EditorChannel.CopyExport, {
            min: 1,
            max: 128,
          });

          return await this.copyExport(exportId);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      EditorChannel.CopyProjectToClipboard,
      [WindowName.Main],
      async (_event, input: unknown) => {
        try {
          return await this.copyProjectToClipboard(
            validateEditorCopyToClipboardInput(input),
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      EditorChannel.GetWorkspace,
      [WindowName.Main],
      (_event, query: unknown) => {
        try {
          return this.getWorkspace(validateEditorWorkspaceQuery(query));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      EditorChannel.CreateProject,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          return this.createProject(validateEditorCreateProjectInput(input));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      EditorChannel.DeleteProject,
      [WindowName.Main],
      (_event, projectId: unknown) => {
        try {
          assertString(projectId, "project id", EditorChannel.DeleteProject, {
            min: 1,
            max: 128,
          });

          return this.deleteProject(projectId);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      EditorChannel.ExportProject,
      [WindowName.Main],
      async (event, input: unknown) => {
        try {
          const sender = (event as { sender?: WebContents }).sender;

          return await this.exportProject(validateEditorExportInput(input), {
            onProgress: (progress) => {
              this.sendExportProgress(sender, progress);
            },
          });
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      EditorChannel.RevealExport,
      [WindowName.Main],
      (_event, exportId: unknown) => {
        try {
          assertString(exportId, "export id", EditorChannel.RevealExport, {
            min: 1,
            max: 128,
          });

          return this.revealExport(exportId);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      EditorChannel.SaveProject,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          return this.saveProject(validateEditorSaveProjectInput(input));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }

  private setupExportMediaProtocol(): void {
    try {
      if (protocol.isProtocolHandled(editorExportMediaScheme)) {
        return;
      }

      protocol.handle(editorExportMediaScheme, (request) =>
        this.handleExportMediaRequest(request),
      );
    } catch (error) {
      logWarn(editorLogScope, "Export media protocol registration failed", {
        error: safeErrorMessage(error),
      });
    }
  }

  private handleExportMediaRequest(request: Request): Response {
    const exportId = this.resolveExportMediaRequestId(request.url);
    if (!exportId) {
      return new Response(null, { status: 404 });
    }

    const exportPath = this.exportPaths.get(exportId);
    if (!exportPath || !existsSync(exportPath)) {
      return new Response(null, { status: 404 });
    }

    try {
      return createReplayClipMediaFileResponse(exportPath, request);
    } catch {
      /* v8 ignore next -- Race where file disappears after existsSync and before statSync. */
      return new Response(null, { status: 500 });
    }
  }

  private resolveExportMediaRequestId(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== `${editorExportMediaScheme}:`) {
        return null;
      }

      const exportId = decodeURIComponent(
        parsedUrl.pathname.replace(/^\/+/, ""),
      );

      return exportId.length > 0 && exportId.length <= 128 ? exportId : null;
    } catch {
      return null;
    }
  }

  private createExportMediaUrl(exportId: string): string {
    return `${editorExportMediaScheme}://export/${encodeURIComponent(exportId)}`;
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

  private sendExportProgress(
    sender: WebContents | undefined,
    progress: EditorExportProgress,
  ): void {
    try {
      if (!sender || sender.isDestroyed()) {
        return;
      }

      sender.send(EditorChannel.ExportProgress, progress);
    } catch (error) {
      logWarn(editorLogScope, "Failed to send editor export progress", {
        error: safeErrorMessage(error),
      });
    }
  }

  private createExportClips(
    clips: EditorExportClipInput[],
  ): EditorResolvedExportClip[] {
    return clips
      .filter((clip) => clip.outSeconds > clip.inSeconds)
      .sort(
        (first, second) =>
          first.startSeconds - second.startSeconds ||
          first.inSeconds - second.inSeconds,
      )
      .map((clip) => ({
        durationSeconds: Math.min(
          clip.durationSeconds,
          clip.outSeconds - clip.inSeconds,
        ),
        inSeconds: clip.inSeconds,
        outSeconds: clip.outSeconds,
        source: this.resolveExportSource(clip.source),
        startSeconds: clip.startSeconds,
      }));
  }

  private resolveExportSource(source: EditorMediaReference): {
    mediaUrl: string | null;
    path: string;
  } {
    if (source.kind === "recording") {
      const recordingStorage = RecordingStorageService.getInstance();
      const detail = recordingStorage.getRecording(source.id);
      const path = recordingStorage.getRecordingMediaPath(source.id);
      if (!detail || !path) {
        logWarn(editorLogScope, "Editor export recording source unavailable", {
          hasDetail: detail !== null,
          hasPath: path !== null,
          sourceIdHash: createTextHash(source.id),
        });
        throw new Error("Recording file is not available");
      }

      return { mediaUrl: detail.mediaUrl, path };
    }

    const detail = ReplayClipsService.getInstance().getClip(source.id);
    if (!detail) {
      logWarn(editorLogScope, "Editor export clip source unavailable", {
        hasDetail: false,
        sourceIdHash: createTextHash(source.id),
      });
      throw new Error("Clip file is not available");
    }

    const settings = SettingsStoreService.getInstance().get();
    const storageRoot = resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      app.getPath("videos"),
    );
    const path = resolveReplayClipFilePath(
      detail.clip.processedClipPath ?? detail.clip.originalObsPath,
      {
        requireExistingFile: true,
        requireNonEmptyFile: true,
        storageRoot,
      },
    );
    if (!path) {
      logWarn(editorLogScope, "Editor export clip file unavailable", {
        hasDetail: true,
        sourceIdHash: createTextHash(source.id),
      });
      throw new Error("Clip file is not available");
    }

    return { mediaUrl: detail.mediaUrl, path };
  }
}

function calculateEditorProjectTimelineDuration(
  tracks: EditorProject["tracks"],
): number {
  return tracks
    .flatMap((track) => track.clips)
    .reduce(
      (duration, clip) =>
        Math.max(duration, clip.startSeconds + clip.durationSeconds),
      0,
    );
}

function hasPositiveMediaDuration(
  durationSeconds: number | null | undefined,
): durationSeconds is number {
  return (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
  );
}

function resolveRecoveredPlaceholderClipDuration({
  clip,
  currentAsset,
  refreshedAsset,
}: {
  clip: EditorTimelineClip;
  currentAsset: EditorMediaAsset | undefined;
  refreshedAsset: EditorMediaAsset;
}): number | null {
  if (
    hasPositiveMediaDuration(currentAsset?.durationSeconds) ||
    !hasPositiveMediaDuration(refreshedAsset.durationSeconds)
  ) {
    return null;
  }

  const placeholderDurationSeconds = normalizeAssetDuration(
    currentAsset?.durationSeconds ?? null,
  );
  if (
    clip.inSeconds !== 0 ||
    clip.durationSeconds !== placeholderDurationSeconds ||
    clip.outSeconds !== placeholderDurationSeconds ||
    clip.sourceOutSeconds !== placeholderDurationSeconds
  ) {
    return null;
  }

  return normalizeAssetDuration(refreshedAsset.durationSeconds);
}

function createEditorAssetDiagnostics(assets: EditorMediaAsset[]) {
  const invalidDurationAssets = assets.filter(
    (asset) =>
      typeof asset.durationSeconds !== "number" ||
      !Number.isFinite(asset.durationSeconds) ||
      asset.durationSeconds <= 0,
  );
  const firstInvalidDurationAsset = invalidDurationAssets[0] ?? null;

  return {
    assetClipCount: assets.filter((asset) => asset.kind === "clip").length,
    assetInvalidDurationCount: invalidDurationAssets.length,
    assetMissingCount: assets.filter((asset) => !asset.exists).length,
    assetRecordingCount: assets.filter((asset) => asset.kind === "recording")
      .length,
    firstInvalidDurationAssetFile: firstInvalidDurationAsset?.name ?? null,
    firstInvalidDurationAssetKeyHash: firstInvalidDurationAsset
      ? createTextHash(firstInvalidDurationAsset.assetKey)
      : null,
    firstInvalidDurationAssetKind: firstInvalidDurationAsset?.kind ?? null,
    firstInvalidDurationSeconds:
      firstInvalidDurationAsset?.durationSeconds ?? null,
  };
}

function createEditorProjectDiagnostics(project: EditorProject) {
  const clips = project.tracks.flatMap((track) => track.clips);

  return {
    projectAssetCount: project.assets.length,
    projectClipCount: clips.length,
    projectSelectedAssetKeyHash: project.selectedAssetKey
      ? createTextHash(project.selectedAssetKey)
      : null,
  };
}

function createEditorSegmentDiagnostics(segments: EditorExportSegment[]) {
  return {
    exportClipSegmentCount: segments.filter(
      (segment) => segment.kind === "clip",
    ).length,
    exportDurationSeconds: calculateEditorExportDuration(segments),
    exportGapSegmentCount: segments.filter((segment) => segment.kind === "gap")
      .length,
    exportSegmentCount: segments.length,
  };
}

export { EditorService };
