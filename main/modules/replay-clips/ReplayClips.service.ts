import { createHash, randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { unlink } from "node:fs/promises";

import { app, BrowserWindow, protocol, shell } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import type { ManagedReplayKind } from "~/main/modules/managed-recorder/ManagedRecorder.dto";
import { normalizeMediaLibraryPageQuery } from "~/main/modules/media-library/MediaLibrary.utils";
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
import {
  assertNumber,
  assertObject,
  assertString,
  handleValidationError,
  IpcValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";
import { readMp4DurationSeconds } from "~/main/utils/media-metadata";

import {
  type GameId,
  GameIdSchema,
  type ReplayClip,
  type ReplayClipKind,
  ReplayClipKindSchema,
} from "~/types";
import { ReplayClipsChannel } from "./ReplayClips.channels";
import type {
  DeathEvent,
  ReplayClipBatchFileActionResult,
  ReplayClipDetail,
  ReplayClipFileActionResult,
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
  ReplayClipLibrarySortDirection,
  ReplayClipLibrarySortKey,
  ReplayClipListFilter,
} from "./ReplayClips.dto";
import { ReplayClipDuplicateTracker } from "./ReplayClips.duplicates";
import {
  resolveReplayClipFilePath,
  sanitizeReplayClipStoragePathList,
} from "./ReplayClips.files";
import {
  createReplayClipMediaFileResponse,
  createReplayClipMediaUrl,
  resolveHinekoraMediaRequestTarget,
} from "./ReplayClips.media";
import { ReplayClipsRepository } from "./ReplayClips.repository";

const REPLAY_CLIPS_LOG_SCOPE = "replay-clips";
const REPLAY_CLIP_MEDIA_SCHEME = "hinekora-media";
const defaultLibraryPageSize = 20;
const maxEditorReplayPageValidationCandidates = 500;
const maxLibraryPageSize = 100;
const librarySortKeys: ReplayClipLibrarySortKey[] = [
  "createdAt",
  "name",
  "sourceLeague",
  "targetDurationSeconds",
  "sizeBytes",
];
const librarySortDirections: ReplayClipLibrarySortDirection[] = ["asc", "desc"];

interface AvailableReplayClip {
  clip: ReplayClip;
  storedClipPath: string;
}

class ReplayClipsService {
  private static instance: ReplayClipsService | null = null;

  private readonly duplicateTracker = new ReplayClipDuplicateTracker();
  private readonly repository: ReplayClipsRepository;

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
    this.setupHandlers();
    this.setupMediaProtocol();
  }

  list(filter: ReplayClipListFilter = {}): ReplayClip[] {
    return this.repository.list(filter).map((clip) => this.withClipSize(clip));
  }

  getClip(id: string): ReplayClipDetail | null {
    const clip = this.repository.get(id);
    if (!clip) {
      return null;
    }
    const sizedClip = this.withClipSize(clip);
    const storedClipPath = this.getStoredClipPathForClip(sizedClip);

    return {
      clip: sizedClip,
      durationSeconds:
        sizedClip.durationSeconds ??
        this.readReplayClipDuration(storedClipPath),
      mediaUrl: storedClipPath ? createReplayClipMediaUrl(id) : null,
    };
  }

  listEditorReplayDetailPage(input: {
    createdAfter?: string;
    excludeIds?: string[];
    game?: GameId;
    includeIds?: string[];
    kind: ReplayClipKind;
    league?: string;
    pageIndex: number;
    pageSize: number;
  }): { items: ReplayClipDetail[]; totalCount: number } {
    const filter: ReplayClipListFilter & {
      createdAfter?: string;
      excludeIds?: string[];
      includeIds?: string[];
      mediaPathOnly?: boolean;
      positiveMediaOnly?: boolean;
    } = {
      kind: input.kind,
      ...(input.createdAfter ? { createdAfter: input.createdAfter } : {}),
      ...(input.excludeIds && input.excludeIds.length > 0
        ? { excludeIds: input.excludeIds }
        : {}),
      ...(input.includeIds && input.includeIds.length > 0
        ? { includeIds: input.includeIds }
        : {}),
    };
    if (input.game) {
      filter.game = input.game;
    }
    if (input.league) {
      filter.league = input.league;
    }

    const candidateFilter = {
      ...filter,
      mediaPathOnly: true,
      positiveMediaOnly: true,
    };
    const items: ReplayClipDetail[] = [];
    const seenAvailableClipIds = new Set<string>();
    let validatedCandidates = 0;

    while (
      items.length < input.pageSize &&
      validatedCandidates < maxEditorReplayPageValidationCandidates
    ) {
      const page = this.repository.listLibraryPage({
        filter: candidateFilter,
        pageIndex: input.pageIndex,
        pageSize: input.pageSize,
        sortBy: "createdAt",
        sortDirection: "desc",
      });
      if (page.items.length === 0) {
        break;
      }

      let removedMissingCandidate = false;
      let inspectedCandidate = false;
      for (const clip of page.items) {
        if (seenAvailableClipIds.has(clip.id)) {
          continue;
        }
        if (validatedCandidates >= maxEditorReplayPageValidationCandidates) {
          break;
        }
        inspectedCandidate = true;
        validatedCandidates += 1;
        const availableClip = this.resolveAvailableReplayClip(clip);
        if (!availableClip) {
          removedMissingCandidate = true;
          continue;
        }

        seenAvailableClipIds.add(availableClip.clip.id);
        items.push(this.createAvailableReplayClipDetail(availableClip));
        if (items.length >= input.pageSize) {
          break;
        }
      }

      if (
        !removedMissingCandidate ||
        !inspectedCandidate ||
        page.items.length < input.pageSize
      ) {
        break;
      }
    }
    const knownAvailableCount = this.repository.count({
      ...candidateFilter,
    });

    return {
      items,
      totalCount: knownAvailableCount,
    };
  }

  listLibrary(query: ReplayClipLibraryQuery = {}): ReplayClipLibraryPage {
    const normalizedQuery = this.normalizeLibraryQuery(query);
    const filter = this.libraryQueryToListFilter(normalizedQuery);
    if (normalizedQuery.sortBy === "sizeBytes") {
      this.refreshMissingClipSizes(filter);
    }
    const page = this.repository.listLibraryPage({
      filter,
      pageIndex: normalizedQuery.pageIndex,
      pageSize: normalizedQuery.pageSize,
      sortBy: normalizedQuery.sortBy,
      sortDirection: normalizedQuery.sortDirection,
    });

    return {
      items: page.items.map((clip) => this.withClipSize(clip, true)),
      availableLeagues: this.listLibraryLeagues(normalizedQuery),
      pageIndex: normalizedQuery.pageIndex,
      pageSize: normalizedQuery.pageSize,
      pageCount: Math.max(
        1,
        Math.ceil(page.totalCount / normalizedQuery.pageSize),
      ),
      totalCount: page.totalCount,
      sortBy: normalizedQuery.sortBy,
      sortDirection: normalizedQuery.sortDirection,
    };
  }

  replaceAll(
    clips: ReplayClip[],
    storageRoot = this.resolveStorageRoot(),
  ): void {
    this.repository.replaceAll(
      this.sanitizeClips(clips, storageRoot).map((clip) =>
        this.withClipSize(clip),
      ),
    );
  }

  upsertMany(
    clips: ReplayClip[],
    storageRoot = this.resolveStorageRoot(),
  ): void {
    this.repository.upsertMany(
      this.sanitizeClips(clips, storageRoot).map((clip) =>
        this.withClipSize(clip),
      ),
    );
  }

  async saveManualReplay(): Promise<ReplayClip | null> {
    const settings = SettingsStoreService.getInstance().get();
    return this.handleDeathEvent({
      kind: "manual",
      game: settings.activeGame,
      line: "Manual replay save",
      lineHash: this.hashLine(`manual:${Date.now()}`),
      detectedAt: new Date().toISOString(),
    });
  }

  async handleDeathEvent(event: DeathEvent): Promise<ReplayClip | null> {
    logInfo(REPLAY_CLIPS_LOG_SCOPE, "Death event received", {
      game: event.game,
      lineHash: event.lineHash,
    });

    if (this.duplicateTracker.isDuplicate(event.lineHash)) {
      const existing = this.repository.getByTriggerLineHash(event.lineHash);
      if (existing) {
        logWarn(REPLAY_CLIPS_LOG_SCOPE, "Duplicate death event ignored", {
          game: event.game,
          lineHash: event.lineHash,
          clipId: existing.id,
        });
        BookmarksService.getInstance().linkReplayClip(existing);
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
    const replayKind = event.kind ?? "death";
    let clip = this.createClip(
      event.game,
      replayKind,
      event.lineHash,
      event.detectedAt,
    );
    this.persistAndPublish(clip);

    try {
      clip = this.updateClip(clip, { status: "saving_replay" });
      logInfo(REPLAY_CLIPS_LOG_SCOPE, "Saving replay for death event", {
        clipId: clip.id,
        backend: "managed",
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
      BookmarksService.getInstance().linkReplayClip(readyClip);
      this.cleanupRecordingStorageForClip(readyClip);

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

  private isManagedReplayBufferActive(event: DeathEvent): boolean {
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

  private setupMediaProtocol(): void {
    try {
      if (protocol.isProtocolHandled(REPLAY_CLIP_MEDIA_SCHEME)) {
        return;
      }

      protocol.handle(REPLAY_CLIP_MEDIA_SCHEME, (request) =>
        this.handleMediaRequest(request),
      );
    } catch (error) {
      logWarn(REPLAY_CLIPS_LOG_SCOPE, "Replay media protocol setup failed", {
        error: safeErrorMessage(error),
      });
    }
  }

  private handleMediaRequest(request: GlobalRequest): Response {
    const target = resolveHinekoraMediaRequestTarget(request.url);
    if (!target) {
      return new Response(null, { status: 404 });
    }

    const mediaPath =
      target.kind === "replay-clip"
        ? this.getStoredClipPath(target.id)
        : RecordingStorageService.getInstance().getRecordingMediaPath(
            target.id,
          );
    if (!mediaPath) {
      logWarn(REPLAY_CLIPS_LOG_SCOPE, "Replay preview media missing", {
        mediaId: target.id,
        mediaKind: target.kind,
      });

      return new Response(null, { status: 404 });
    }

    try {
      return createReplayClipMediaFileResponse(mediaPath, request);
    } catch (error) {
      logWarn(REPLAY_CLIPS_LOG_SCOPE, "Replay preview media failed", {
        mediaId: target.id,
        mediaKind: target.kind,
        error: safeErrorMessage(error),
      });

      return new Response(null, { status: 500 });
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

  async copyClipToClipboard(id: string): Promise<ReplayClipFileActionResult> {
    try {
      const clipPath = this.getStoredClipPath(id);
      if (!clipPath) {
        return { ok: false, error: "Clip file path is not available" };
      }

      return await FileClipboard.copyFileToClipboard(clipPath);
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  async deleteClip(id: string): Promise<ReplayClipFileActionResult> {
    try {
      const clip = this.repository.get(id);
      if (!clip) {
        return { ok: false, error: "Clip was not found" };
      }

      BookmarksService.getInstance().deleteReplayClipLinks(id);
      this.repository.delete(id);
      try {
        await this.deleteStoredClipFiles(clip);
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
    const deletedIds: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    const cleanupErrors: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      const result = await this.deleteClip(id);
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
    this.showReadyClipPreview(updated);

    return updated;
  }

  private showReadyClipPreview(clip: ReplayClip): void {
    if (clip.status !== "ready") {
      return;
    }

    void OverlayWindowsService.getInstance().showClipPreviewOverlay(clip);
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
    const publishedClip = this.withClipSize(clip);
    this.repository.upsert(publishedClip);
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(
          ReplayClipsChannel.StatusChanged,
          publishedClip,
        );
      }
    }
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      ReplayClipsChannel.Get,
      [WindowName.Main],
      (_event, id: unknown) => {
        try {
          assertString(id, "id", ReplayClipsChannel.Get, {
            min: 1,
            max: 128,
          });
          return this.getClip(id);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ReplayClipsChannel.List,
      [
        WindowName.Main,
        WindowName.RecorderOverlay,
        WindowName.ClipPreviewOverlay,
      ],
      (_event, filter: unknown) => {
        try {
          return this.list(this.validateListFilter(filter));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ReplayClipsChannel.ListLibrary,
      [WindowName.Main],
      (_event, query: unknown) => {
        try {
          return this.listLibrary(this.validateLibraryQuery(query));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ReplayClipsChannel.SaveManualReplay,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.saveManualReplay(),
    );
    registerGuardedIpcHandler(
      ReplayClipsChannel.Open,
      [WindowName.Main, WindowName.ClipPreviewOverlay],
      (_event, id: unknown) => {
        try {
          assertString(id, "id", ReplayClipsChannel.Open, {
            min: 1,
            max: 128,
          });
          return this.openClip(id);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ReplayClipsChannel.Reveal,
      [WindowName.Main, WindowName.ClipPreviewOverlay],
      (_event, id: unknown) => {
        try {
          assertString(id, "id", ReplayClipsChannel.Reveal, {
            min: 1,
            max: 128,
          });
          return this.revealClip(id);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ReplayClipsChannel.Copy,
      [WindowName.Main],
      (_event, id: unknown) => {
        try {
          assertString(id, "id", ReplayClipsChannel.Copy, {
            min: 1,
            max: 128,
          });
          return this.copyClipToClipboard(id);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ReplayClipsChannel.Delete,
      [WindowName.Main],
      (_event, id: unknown) => {
        try {
          assertString(id, "id", ReplayClipsChannel.Delete, {
            min: 1,
            max: 128,
          });
          return this.deleteClip(id);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ReplayClipsChannel.DeleteMany,
      [WindowName.Main],
      (_event, ids: unknown) => {
        try {
          return this.deleteManyClips(this.validateIdList(ids));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }

  private getStoredClipPath(id: string): string | null {
    const clip = this.repository.get(id);
    if (!clip) {
      return null;
    }

    return this.getStoredClipPathForClip(clip);
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

  private resolveAvailableReplayClip(
    clip: ReplayClip,
  ): AvailableReplayClip | null {
    const storedClipPath = this.getStoredClipPathForClip(clip);
    if (!storedClipPath) {
      this.repository.updateSize(clip.id, 0);

      return null;
    }

    return {
      clip,
      storedClipPath,
    };
  }

  private createAvailableReplayClipDetail({
    clip,
    storedClipPath,
  }: AvailableReplayClip): ReplayClipDetail {
    return {
      clip,
      durationSeconds:
        clip.durationSeconds ?? this.readReplayClipDuration(storedClipPath),
      mediaUrl: createReplayClipMediaUrl(clip.id),
    };
  }

  private readReplayClipDuration(path: string | null): number | null {
    return path ? readMp4DurationSeconds(path) : null;
  }

  private async deleteStoredClipFiles(clip: ReplayClip): Promise<void> {
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

      await unlink(storedPath);
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

  private validateListFilter(value: unknown): ReplayClipListFilter {
    if (value === undefined) {
      return {};
    }

    assertObject(value, "clip list filter", ReplayClipsChannel.List);
    const filter: ReplayClipListFilter = {};
    if (value.game !== undefined) {
      assertString(value.game, "game", ReplayClipsChannel.List, {
        min: 1,
        max: 16,
      });
      const game = GameIdSchema.safeParse(value.game);
      if (!game.success) {
        throw new IpcValidationError(
          ReplayClipsChannel.List,
          "game is invalid",
        );
      }
      filter.game = game.data;
    }
    if (value.kind !== undefined) {
      assertString(value.kind, "clip kind", ReplayClipsChannel.List, {
        min: 1,
        max: 16,
      });
      const kind = ReplayClipKindSchema.safeParse(value.kind);
      if (!kind.success) {
        throw new IpcValidationError(
          ReplayClipsChannel.List,
          "clip kind is invalid",
        );
      }
      filter.kind = kind.data;
    }
    if (value.league !== undefined) {
      assertString(value.league, "league", ReplayClipsChannel.List, {
        min: 1,
        max: 80,
      });
      filter.league = value.league;
    }

    return filter;
  }

  private validateLibraryQuery(value: unknown): ReplayClipLibraryQuery {
    if (value === undefined) {
      return {};
    }

    assertObject(value, "clip library query", ReplayClipsChannel.ListLibrary);
    const filter = this.validateListFilterForChannel(
      value,
      ReplayClipsChannel.ListLibrary,
    );
    const query: ReplayClipLibraryQuery = { ...filter };

    if (value.pageIndex !== undefined) {
      assertNumber(
        value.pageIndex,
        "page index",
        ReplayClipsChannel.ListLibrary,
        {
          integer: true,
          min: 0,
          max: 10_000,
        },
      );
      query.pageIndex = value.pageIndex;
    }
    if (value.pageSize !== undefined) {
      assertNumber(
        value.pageSize,
        "page size",
        ReplayClipsChannel.ListLibrary,
        {
          integer: true,
          min: 1,
          max: maxLibraryPageSize,
        },
      );
      query.pageSize = value.pageSize;
    }
    if (value.sortBy !== undefined) {
      assertString(value.sortBy, "sort field", ReplayClipsChannel.ListLibrary, {
        min: 1,
        max: 32,
      });
      if (!librarySortKeys.includes(value.sortBy as ReplayClipLibrarySortKey)) {
        throw new IpcValidationError(
          ReplayClipsChannel.ListLibrary,
          "sort field is invalid",
        );
      }
      query.sortBy = value.sortBy as ReplayClipLibrarySortKey;
    }
    if (value.sortDirection !== undefined) {
      assertString(
        value.sortDirection,
        "sort direction",
        ReplayClipsChannel.ListLibrary,
        { min: 1, max: 8 },
      );
      if (
        !librarySortDirections.includes(
          value.sortDirection as ReplayClipLibrarySortDirection,
        )
      ) {
        throw new IpcValidationError(
          ReplayClipsChannel.ListLibrary,
          "sort direction is invalid",
        );
      }
      query.sortDirection =
        value.sortDirection as ReplayClipLibrarySortDirection;
    }

    return query;
  }

  private validateListFilterForChannel(
    value: Record<string, unknown>,
    channel: ReplayClipsChannel,
  ): ReplayClipListFilter {
    const filter: ReplayClipListFilter = {};
    if (value.game !== undefined) {
      assertString(value.game, "game", channel, {
        min: 1,
        max: 16,
      });
      const game = GameIdSchema.safeParse(value.game);
      if (!game.success) {
        throw new IpcValidationError(channel, "game is invalid");
      }
      filter.game = game.data;
    }
    if (value.kind !== undefined) {
      assertString(value.kind, "clip kind", channel, {
        min: 1,
        max: 16,
      });
      const kind = ReplayClipKindSchema.safeParse(value.kind);
      if (!kind.success) {
        throw new IpcValidationError(channel, "clip kind is invalid");
      }
      filter.kind = kind.data;
    }
    if (value.league !== undefined) {
      assertString(value.league, "league", channel, {
        min: 1,
        max: 80,
      });
      filter.league = value.league;
    }

    return filter;
  }

  private validateIdList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      throw new IpcValidationError(
        ReplayClipsChannel.DeleteMany,
        "ids must be an array",
      );
    }
    if (value.length > 100) {
      throw new IpcValidationError(
        ReplayClipsChannel.DeleteMany,
        "ids is too large",
      );
    }

    return value.map((id) => {
      assertString(id, "id", ReplayClipsChannel.DeleteMany, {
        min: 1,
        max: 128,
      });

      return id;
    });
  }

  private normalizeLibraryQuery(
    query: ReplayClipLibraryQuery,
  ): Required<ReplayClipLibraryQuery> {
    const pageQuery = normalizeMediaLibraryPageQuery(query, {
      pageIndex: 0,
      pageSize: defaultLibraryPageSize,
      sortBy: "createdAt",
      sortDirection: "desc",
    });

    return {
      game: query.game ?? "poe1",
      kind: query.kind ?? "death",
      league: query.league ?? "",
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
      sortBy: pageQuery.sortBy,
      sortDirection: pageQuery.sortDirection,
    };
  }

  private libraryQueryToListFilter(
    query: Required<ReplayClipLibraryQuery>,
  ): ReplayClipListFilter {
    const filter: ReplayClipListFilter = {
      game: query.game,
      kind: query.kind,
    };
    if (query.league.length > 0) {
      filter.league = query.league;
    }

    return filter;
  }

  private listLibraryLeagues(
    query: Required<ReplayClipLibraryQuery>,
  ): string[] {
    return this.repository.listLeagues({ game: query.game, kind: query.kind });
  }

  private withClipSize(clip: ReplayClip, persist = false): ReplayClip {
    if (!this.getStoredClipPathForClip(clip)) {
      if (persist && clip.sizeBytes !== 0) {
        this.repository.updateSize(clip.id, 0);
      }

      return {
        ...clip,
        sizeBytes: 0,
      };
    }

    if (clip.sizeBytes > 0) {
      return clip;
    }

    const sizeBytes = this.calculateClipSizeBytes(clip);
    if (persist && sizeBytes !== clip.sizeBytes) {
      this.repository.updateSize(clip.id, sizeBytes);
    }

    return {
      ...clip,
      sizeBytes,
    };
  }

  private refreshMissingClipSizes(filter: ReplayClipListFilter): void {
    for (const clip of this.repository.listMissingSizeClips(filter)) {
      this.withClipSize(clip, true);
    }
  }

  private calculateClipSizeBytes(clip: ReplayClip): number {
    const paths = new Set(
      [clip.processedClipPath, clip.originalObsPath].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      ),
    );
    let sizeBytes = 0;

    for (const path of paths) {
      const storedPath = this.resolveClipFilePath(path, {
        requireExistingFile: true,
        requireNonEmptyFile: true,
      });
      if (!storedPath) {
        continue;
      }

      try {
        sizeBytes += statSync(storedPath).size;
      } catch {}
    }

    return sizeBytes;
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

export { ReplayClipsService };
