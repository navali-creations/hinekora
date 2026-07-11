import { createHash } from "node:crypto";
import { basename } from "node:path";

import { BrowserWindow } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window";
import {
  createClipPreviewMediaUrl,
  createReplayClipMediaUrl,
} from "~/main/modules/media-protocol";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { logInfo, logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { getIpcWindowRole } from "~/main/utils/ipc-window-roles";
import { readMp4DurationSeconds } from "~/main/utils/media-metadata";

import type { ReplayClip } from "~/types";
import { ReplayClipsChannel } from "./ReplayClips.channels";
import { ReplayClipCreationService } from "./ReplayClips.creation";
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
  ReplayClipPreviewProgress,
  ReplayClipSourceDetail,
  ReplayClipUpdateInput,
  ReplayClipUpdateResult,
  ReplayClipView,
  ReplayTriggerEvent,
} from "./ReplayClips.dto";
import { ReplayClipFileActionsService } from "./ReplayClips.file-actions";
import { setupReplayClipsIpcHandlers } from "./ReplayClips.ipc";
import {
  type EditorReplayDetailPageInput,
  ReplayClipLibraryService,
} from "./ReplayClips.library";
import { ReplayClipOperationCoordinator } from "./ReplayClips.operations";
import { ReplayClipPreviewService } from "./ReplayClips.preview";
import { ReplayClipsRepository } from "./ReplayClips.repository";
import { ReplayClipStorageService } from "./ReplayClips.storage";
import { ReplayClipTriggerCoordinator } from "./ReplayClips.trigger";

const REPLAY_CLIPS_LOG_SCOPE = "replay-clips";
const replayClipStatusWindowRoles = new Set([
  WindowName.ClipPreviewOverlay,
  WindowName.Main,
  WindowName.RecorderOverlay,
]);
const replayClipPreviewProgressWindowRoles = new Set([
  WindowName.ClipPreviewOverlay,
]);

interface ReplayClipOperationProgressOptions {
  onProgress?: (progress: ReplayClipOperationProgress) => void;
}

class ReplayClipsService {
  private static instance: ReplayClipsService | null = null;

  private readonly creationService: ReplayClipCreationService;
  private readonly fileActionsService: ReplayClipFileActionsService;
  private readonly libraryService: ReplayClipLibraryService;
  private readonly operationCoordinator = new ReplayClipOperationCoordinator();
  private readonly previewService = new ReplayClipPreviewService();
  private readonly repository: ReplayClipsRepository;
  private readonly storageService: ReplayClipStorageService;
  private readonly triggerCoordinator = new ReplayClipTriggerCoordinator();

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
    this.storageService = new ReplayClipStorageService(this.repository);
    this.libraryService = new ReplayClipLibraryService({
      createReplayClipView: (clip) => this.createReplayClipView(clip),
      readReplayClipDuration: (path) => this.readReplayClipDuration(path),
      repository: this.repository,
      resolveClipFilePath: (path, options) =>
        this.storageService.resolveClipFilePath(path, options),
      withClipSize: (clip, persist) =>
        this.storageService.withClipSize(clip, persist),
    });
    this.creationService = new ReplayClipCreationService({
      persistAndPublish: (clip) => this.persistAndPublish(clip),
      preparePreview: (clip, sourcePath, durationSeconds) =>
        this.prepareClipPreview(clip, sourcePath, durationSeconds),
      readDuration: (path) => this.readReplayClipDuration(path),
      runClipOperation: (clipId, operation) =>
        this.operationCoordinator.queueClipOperation(clipId, operation),
      repository: this.repository,
      resolveStoredPath: (path) =>
        this.storageService.resolveClipFilePath(path, {
          requireExistingFile: true,
        }),
      updateClip: (clip, update) => this.updateClip(clip, update),
    });
    this.fileActionsService = new ReplayClipFileActionsService({
      getClipView: (id) => this.getClipView(id),
      operationCoordinator: this.operationCoordinator,
      persistAndPublish: (clip) => this.persistAndPublish(clip),
      prepareClipPreview: (clip, sourcePath, durationSeconds) =>
        this.prepareClipPreview(clip, sourcePath, durationSeconds),
      previewService: this.previewService,
      readDuration: (path) => this.readReplayClipDuration(path),
      repository: this.repository,
      storageService: this.storageService,
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
  }

  async list(filter: ReplayClipListFilter = {}): Promise<ReplayClip[]> {
    return Promise.all(
      this.repository
        .list(filter)
        .map((clip) => this.storageService.withClipSize(clip, true)),
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
    const storedClipPath =
      this.storageService.getStoredClipPathForClip(sizedClip);
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

  getMediaPath(id: string): string | null {
    return this.storageService.getStoredClipMediaPath(id);
  }

  getPreviewMediaPath(id: string): string | null {
    return this.shouldUseClipPreviewProxy()
      ? this.previewService.getPath(id)
      : null;
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
    storageRoot = this.storageService.resolveStorageRoot(),
  ): void {
    this.repository.replaceAll(
      this.storageService.sanitizeClips(clips, storageRoot),
    );
  }

  upsertMany(
    clips: ReplayClip[],
    storageRoot = this.storageService.resolveStorageRoot(),
  ): void {
    this.repository.upsertMany(
      this.storageService.sanitizeClips(clips, storageRoot),
    );
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
    return this.triggerCoordinator.run(event, {
      execute: (firstEvent) => this.creationService.execute(firstEvent),
      onCoalesced: (coalescedEvent) => {
        if (coalescedEvent.kind === "death") {
          BookmarksService.getInstance().rememberReplayClipSession({
            game: coalescedEvent.game,
            triggerLineHash: coalescedEvent.lineHash,
          });
        }
        logInfo(REPLAY_CLIPS_LOG_SCOPE, "Replay trigger coalesced", {
          game: coalescedEvent.game,
          kind: coalescedEvent.kind,
          lineHash: coalescedEvent.lineHash,
        });
      },
      resolveBatch: (clip, events) =>
        this.resolveReplayTriggerBatch(clip, events),
    });
  }

  private async resolveReplayTriggerBatch(
    clip: ReplayClip | null,
    events: ReplayTriggerEvent[],
  ): Promise<ReplayClip | null> {
    if (clip?.status !== "ready") {
      return clip;
    }

    return this.operationCoordinator.queueClipOperation(clip.id, () =>
      this.resolveReplayTriggerBatchQueued(clip.id, events),
    );
  }

  private async resolveReplayTriggerBatchQueued(
    clipId: string,
    events: ReplayTriggerEvent[],
  ): Promise<ReplayClip | null> {
    const clip = this.repository.get(clipId);
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

  async openClip(id: string): Promise<ReplayClipFileActionResult> {
    return this.fileActionsService.openClip(id);
  }

  revealClip(id: string): ReplayClipFileActionResult {
    return this.fileActionsService.revealClip(id);
  }

  async copyClipToClipboard(
    input: string | ReplayClipCopyInput,
    options: ReplayClipOperationProgressOptions = {},
  ): Promise<ReplayClipFileActionResult> {
    return this.fileActionsService.copyClipToClipboard(input, options);
  }

  async updateClipFile(
    input: ReplayClipUpdateInput,
    options: ReplayClipOperationProgressOptions = {},
  ): Promise<ReplayClipUpdateResult> {
    return this.fileActionsService.updateClipFile(input, options);
  }

  async deleteClip(id: string): Promise<ReplayClipFileActionResult> {
    return this.fileActionsService.deleteClip(id);
  }

  async deleteManyClips(
    ids: string[],
  ): Promise<ReplayClipBatchFileActionResult> {
    return this.fileActionsService.deleteManyClips(ids);
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
    this.publishToWindowRoles(
      ReplayClipsChannel.StatusChanged,
      publishedView,
      replayClipStatusWindowRoles,
    );
  }

  private getClipView(id: string): ReplayClipDetail | null {
    const detail = this.getClip(id);
    if (!detail) {
      return null;
    }

    return {
      ...detail,
      clip: this.createReplayClipView(
        detail.clip,
        detail.clip.status === "ready" && Boolean(detail.mediaUrl),
      ),
      previewMediaUrl: this.getPreviewMediaPath(id)
        ? createClipPreviewMediaUrl(id, detail.clip.updatedAt)
        : null,
    };
  }

  private createReplayClipView(
    clip: ReplayClip,
    hasMediaFile = Boolean(
      clip.status === "ready" &&
        (clip.processedClipPath ?? clip.originalObsPath) &&
        clip.sizeBytes > 0,
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

  private async prepareClipPreview(
    clip: ReplayClip,
    sourcePath: string,
    durationSeconds: number | null,
  ): Promise<void> {
    this.publishPreviewProgress({ clipId: clip.id, progress: 0 });
    if (!this.shouldUseClipPreviewProxy()) {
      await this.previewService.remove(clip.id);
      this.publishPreviewProgress({ clipId: clip.id, progress: 1 });
      return;
    }
    if (!durationSeconds || durationSeconds <= 0) {
      this.publishPreviewProgress({ clipId: clip.id, progress: 1 });
      return;
    }

    await this.previewService.prepare({
      clipId: clip.id,
      durationSeconds,
      onProgress: (progress) =>
        this.publishPreviewProgress({ clipId: clip.id, progress }),
      sourcePath,
      version: clip.updatedAt,
    });
    this.publishPreviewProgress({ clipId: clip.id, progress: 1 });
  }

  private publishPreviewProgress(progress: ReplayClipPreviewProgress): void {
    const payload = {
      ...progress,
      progress: Math.min(Math.max(progress.progress, 0), 1),
    };
    this.publishToWindowRoles(
      ReplayClipsChannel.PreviewProgress,
      payload,
      replayClipPreviewProgressWindowRoles,
    );
  }

  private publishToWindowRoles(
    channel: ReplayClipsChannel,
    payload: unknown,
    roles: ReadonlySet<WindowName>,
  ): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) {
        continue;
      }
      const role = getIpcWindowRole({ sender: window.webContents });
      if (role && roles.has(role)) {
        window.webContents.send(channel, payload);
      }
    }
  }

  private shouldUseClipPreviewProxy(): boolean {
    return (
      SettingsStoreService.getInstance().get().replayClipPreviewResolution !==
      "1080p"
    );
  }

  private hashLine(line: string): string {
    return createHash("sha256").update(line).digest("hex").slice(0, 32);
  }
}

export { ReplayClipsService };
