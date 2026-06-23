import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

import { app, shell } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { normalizeMediaLibraryPageQuery } from "~/main/modules/media-library/MediaLibrary.utils";
import { createRunRecordingMediaUrl } from "~/main/modules/replay-clips/ReplayClips.media";
import { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  createSafePathLogFields,
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
import { isPathInsideOrEqual } from "~/main/utils/storage-files";

import { GameIdSchema } from "~/types";
import { RecordingStorageChannel } from "./RecordingStorage.channels";
import type {
  RecordingStorageBatchFileActionResult,
  RecordingStorageFileActionResult,
  RecordingStorageUsage,
  RunRecordingCreateInput,
  RunRecordingDetail,
  RunRecordingItem,
  RunRecordingLibraryPage,
  RunRecordingLibraryQuery,
  RunRecordingLibrarySortDirection,
  RunRecordingLibrarySortKey,
  RunRecordingMetadata,
} from "./RecordingStorage.dto";
import {
  calculateDatabaseSize,
  calculateDiskUsage,
  collectRecordingFiles,
  removeEmptyParentDirectories,
} from "./RecordingStorage.files";
import { RecordingStorageRepository } from "./RecordingStorage.repository";
import {
  isManagedRecordingFilePath,
  resolveRecordingStorageMediaDirectory,
  resolveRecordingStorageRoot,
} from "./RecordingStorage.utils";

const RECORDING_STORAGE_LOG_SCOPE = "recording-storage";
const storageLimitSafetyFactor = 1024 ** 3;
const lowDiskSpaceWarningThresholdBytes = 1024 ** 3;
const defaultLibraryPageSize = 20;
const maxLibraryPageSize = 100;
const recordingLibrarySyncCacheMs = 2_000;
const librarySortKeys: RunRecordingLibrarySortKey[] = [
  "createdAt",
  "durationSeconds",
  "fileName",
  "sizeBytes",
  "sourceLeague",
];
const librarySortDirections: RunRecordingLibrarySortDirection[] = [
  "asc",
  "desc",
];

interface RecordingStorageCleanupOptions {
  protectedDirectories?: string[];
  protectedPaths?: string[];
}

interface RecordingStorageCleanupResult {
  deletedCount: number;
  freedBytes: number;
  limitBytes: number;
  usageBytes: number;
}

interface RecordingLibrarySyncCache {
  root: string;
  settingsKey: string;
  syncedAtMs: number;
}

interface ExistingFileStats {
  mtimeMs: number;
  sizeBytes: number;
}

class RecordingStorageService {
  private static instance: RecordingStorageService | null = null;

  private readonly durationProbeFailureLoggedPaths = new Set<string>();
  private recordingLibrarySyncCache: RecordingLibrarySyncCache | null = null;
  private readonly replayClipsRepository: ReplayClipsRepository;
  private readonly repository: RecordingStorageRepository;

  static getInstance(): RecordingStorageService {
    if (!RecordingStorageService.instance) {
      RecordingStorageService.instance = new RecordingStorageService();
    }

    return RecordingStorageService.instance;
  }

  static resetForTests(): void {
    RecordingStorageService.instance = null;
  }

  constructor() {
    const database = DatabaseService.getInstance();
    this.replayClipsRepository = new ReplayClipsRepository(database);
    this.repository = new RecordingStorageRepository(database);
    this.setupHandlers();
  }

  getUsage(): RecordingStorageUsage {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.ensureStorageRoot(root);
    this.syncRecordingLibrary(root, settings);

    const clipsSizeBytes = this.replayClipsRepository
      .listStorageUsage()
      .reduce((sum, bucket) => sum + bucket.sizeBytes, 0);
    const recordingsSizeBytes = this.repository
      .listStorageUsage()
      .reduce((sum, bucket) => sum + bucket.sizeBytes, 0);
    const databasePath = DatabaseService.getInstance().path;
    const databaseSizeBytes = calculateDatabaseSize(databasePath);
    const disk = calculateDiskUsage(root);

    return {
      storageDirectory: root,
      databasePath,
      clipsSizeBytes,
      recordingsSizeBytes,
      databaseSizeBytes,
      totalTrackedSizeBytes:
        clipsSizeBytes + recordingsSizeBytes + databaseSizeBytes,
      diskTotalBytes: disk.totalBytes,
      diskFreeBytes: disk.freeBytes,
      diskWarningThresholdBytes: lowDiskSpaceWarningThresholdBytes,
      lowDiskSpace:
        disk.freeBytes > 0 &&
        disk.freeBytes < lowDiskSpaceWarningThresholdBytes,
      calculatedAt: new Date().toISOString(),
    };
  }

  listRecordings(): RunRecordingItem[] {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.syncRecordingLibrary(root, settings);

    return this.repository.listRunRecordingItems();
  }

  refreshLibrary(): void {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.syncRecordingLibrary(root, settings);
  }

  listRecordingLibrary(
    query: RunRecordingLibraryQuery = {},
  ): RunRecordingLibraryPage {
    const normalizedQuery = this.normalizeLibraryQuery(query);
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.syncRecordingLibrary(root, settings);
    const filter = {
      game: normalizedQuery.game,
      ...(normalizedQuery.league.length > 0
        ? { league: normalizedQuery.league }
        : {}),
    };
    const page = this.repository.listLibraryPage({
      filter,
      pageIndex: normalizedQuery.pageIndex,
      pageSize: normalizedQuery.pageSize,
      sortBy: normalizedQuery.sortBy,
      sortDirection: normalizedQuery.sortDirection,
    });

    return {
      items: page.items,
      availableLeagues: this.repository.listLeagues({
        game: normalizedQuery.game,
      }),
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

  getRecording(id: string): RunRecordingDetail | null {
    const recording = this.resolveRecordingById(id);
    if (!recording) {
      return null;
    }

    return {
      mediaUrl: this.resolveRecordingActionPath(recording.path)
        ? createRunRecordingMediaUrl(id)
        : null,
      recording,
    };
  }

  listRecentEditorRecordingDetails(limit: number): RunRecordingDetail[] {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.syncRecordingLibrary(root, settings);
    const page = this.repository.listLibraryPage({
      pageIndex: 0,
      pageSize: limit,
      sortBy: "createdAt",
      sortDirection: "desc",
    });

    return page.items.map((recording) => ({
      mediaUrl: this.resolveRecordingActionPath(recording.path)
        ? createRunRecordingMediaUrl(recording.id)
        : null,
      recording,
    }));
  }

  getRecordingMediaPath(id: string): string | null {
    const recording = this.resolveRecordingById(id);

    return recording ? this.resolveRecordingActionPath(recording.path) : null;
  }

  registerRunRecording(input: RunRecordingCreateInput): RunRecordingMetadata {
    const resolvedPath = resolve(input.path);
    const fileStats = this.getExistingFileStats(resolvedPath);
    const recording = this.repository.upsertRunRecording({
      ...input,
      path: resolvedPath,
      exists: fileStats.sizeBytes > 0,
      mtimeMs: fileStats.mtimeMs,
      sizeBytes: fileStats.sizeBytes,
    });
    this.invalidateRecordingLibrarySyncCache();
    logInfo(RECORDING_STORAGE_LOG_SCOPE, "Run recording registered", {
      game: recording.sourceGame,
      league: recording.sourceLeague,
      ...createSafePathLogFields(recording.path, "recording"),
    });

    return recording;
  }

  async openRecording(path: string): Promise<RecordingStorageFileActionResult> {
    try {
      const recordingPath = this.resolveRecordingActionPath(path);
      if (!recordingPath) {
        return { ok: false, error: "Recording file is not available" };
      }

      const error = await shell.openPath(recordingPath);

      return { ok: error.length === 0, error: error.length > 0 ? error : null };
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  revealRecording(path: string): RecordingStorageFileActionResult {
    try {
      const recordingPath = this.resolveRecordingActionPath(path);
      if (!recordingPath) {
        return { ok: false, error: "Recording file is not available" };
      }

      shell.showItemInFolder(recordingPath);

      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  async copyRecordingToClipboard(
    path: string,
  ): Promise<RecordingStorageFileActionResult> {
    try {
      const recordingPath = this.resolveRecordingActionPath(path);
      if (!recordingPath) {
        return { ok: false, error: "Recording file is not available" };
      }

      return await FileClipboard.copyFileToClipboard(recordingPath);
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  deleteRecording(path: string): RecordingStorageFileActionResult {
    try {
      const recordingPath = this.resolveManagedRecordingPath(path);
      if (!recordingPath) {
        return { ok: false, error: "Recording file is not available" };
      }

      const fileExists = existsSync(recordingPath);
      const deletedMetadata =
        this.repository.deleteRunRecordingByPath(recordingPath);
      if (!fileExists && !deletedMetadata) {
        return { ok: false, error: "Recording file is not available" };
      }

      if (fileExists) {
        try {
          unlinkSync(recordingPath);
          this.invalidateRecordingLibrarySyncCache();
          const settings = SettingsStoreService.getInstance().get();
          const root = this.resolveStorageRoot(settings.recordingStoragePath);
          removeEmptyParentDirectories(recordingPath, root);
        } catch (error) {
          const cleanupError = safeErrorMessage(error);
          logWarn(
            RECORDING_STORAGE_LOG_SCOPE,
            "Run recording file cleanup failed",
            {
              ...createSafePathLogFields(recordingPath, "recording"),
              error: cleanupError,
            },
          );

          return { ok: true, error: null, cleanupError };
        }
      }

      logInfo(RECORDING_STORAGE_LOG_SCOPE, "Run recording deleted", {
        deletedMetadata,
        ...createSafePathLogFields(recordingPath, "recording"),
      });
      this.invalidateRecordingLibrarySyncCache();

      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  deleteManyRecordings(paths: string[]): RecordingStorageBatchFileActionResult {
    const deletedPaths: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    const cleanupErrors: Array<{ path: string; error: string }> = [];

    for (const path of paths) {
      const result = this.deleteRecording(path);
      if (result.ok) {
        deletedPaths.push(path);
        if (result.cleanupError) {
          cleanupErrors.push({ path, error: result.cleanupError });
        }
        continue;
      }

      failed.push({ path, error: result.error ?? "Recording delete failed" });
    }

    return {
      ok: failed.length === 0,
      error:
        failed.length === 0 ? null : "Some recordings could not be deleted",
      deletedPaths,
      failed,
      ...(cleanupErrors.length > 0 ? { cleanupErrors } : {}),
    };
  }

  cleanup(
    options: RecordingStorageCleanupOptions = {},
  ): RecordingStorageCleanupResult {
    const settings = SettingsStoreService.getInstance().get();
    const limitBytes =
      settings.recordingMaxStorageGb * storageLimitSafetyFactor;
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.syncRecordingLibrary(root, settings);
    const selection = this.repository.selectCleanupCandidates({
      limitBytes,
      ...(options.protectedDirectories
        ? { protectedDirectories: options.protectedDirectories }
        : {}),
      ...(options.protectedPaths
        ? { protectedPaths: options.protectedPaths }
        : {}),
    });

    if (selection.files.length === 0) {
      logInfo(RECORDING_STORAGE_LOG_SCOPE, "Storage cleanup skipped", {
        usageBytes: selection.usageBytes,
        limitBytes,
      });

      return {
        deletedCount: 0,
        freedBytes: 0,
        limitBytes,
        usageBytes: selection.usageBytes,
      };
    }

    const deletedPaths: string[] = [];
    let actualFreedBytes = 0;
    for (const file of selection.files) {
      try {
        unlinkSync(file.path);
        deletedPaths.push(file.path);
        actualFreedBytes += file.size;
        this.repository.updateFileState(file.path, {
          exists: false,
          sizeBytes: 0,
        });
        removeEmptyParentDirectories(file.path, root);
      } catch (error) {
        logWarn(
          RECORDING_STORAGE_LOG_SCOPE,
          "Failed to delete recording file",
          {
            ...createSafePathLogFields(file.path, "recording"),
            error: safeErrorMessage(error),
          },
        );
      }
    }

    const deletedClipRows = this.deleteMissingReplayClipRows();
    this.invalidateRecordingLibrarySyncCache();
    logInfo(RECORDING_STORAGE_LOG_SCOPE, "Storage cleanup completed", {
      deletedCount: deletedPaths.length,
      deletedClipRows,
      freedBytes: actualFreedBytes,
      usageBytes: selection.usageBytes,
      limitBytes,
      targetUsageBytes: selection.targetUsageBytes,
    });

    return {
      deletedCount: deletedPaths.length,
      freedBytes: actualFreedBytes,
      limitBytes,
      usageBytes: selection.usageBytes,
    };
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      RecordingStorageChannel.GetRecording,
      [WindowName.Main],
      (_event, id: unknown) => {
        try {
          assertString(
            id,
            "recording id",
            RecordingStorageChannel.GetRecording,
            {
              min: 1,
              max: 2_048,
            },
          );

          return this.getRecording(id);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      RecordingStorageChannel.GetUsage,
      [WindowName.Main],
      () => this.getUsage(),
    );
    registerGuardedIpcHandler(
      RecordingStorageChannel.ListRecordings,
      [WindowName.Main],
      () => this.listRecordings(),
    );
    registerGuardedIpcHandler(
      RecordingStorageChannel.ListRecordingLibrary,
      [WindowName.Main],
      (_event, query: unknown) => {
        try {
          return this.listRecordingLibrary(
            this.validateRecordingLibraryQuery(query),
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      RecordingStorageChannel.OpenRecording,
      [WindowName.Main],
      (_event, path: unknown) => {
        try {
          assertString(
            path,
            "recording path",
            RecordingStorageChannel.OpenRecording,
            { min: 1, max: 2_048 },
          );

          return this.openRecording(path);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      RecordingStorageChannel.RevealRecording,
      [WindowName.Main],
      (_event, path: unknown) => {
        try {
          assertString(
            path,
            "recording path",
            RecordingStorageChannel.RevealRecording,
            { min: 1, max: 2_048 },
          );

          return this.revealRecording(path);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      RecordingStorageChannel.CopyRecording,
      [WindowName.Main],
      (_event, path: unknown) => {
        try {
          assertString(
            path,
            "recording path",
            RecordingStorageChannel.CopyRecording,
            { min: 1, max: 2_048 },
          );

          return this.copyRecordingToClipboard(path);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      RecordingStorageChannel.DeleteRecording,
      [WindowName.Main],
      (_event, path: unknown) => {
        try {
          assertString(
            path,
            "recording path",
            RecordingStorageChannel.DeleteRecording,
            { min: 1, max: 2_048 },
          );

          return this.deleteRecording(path);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      RecordingStorageChannel.DeleteManyRecordings,
      [WindowName.Main],
      (_event, paths: unknown) => {
        try {
          return this.deleteManyRecordings(
            this.validateRecordingPathList(paths),
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }

  private validateRecordingLibraryQuery(
    value: unknown,
  ): RunRecordingLibraryQuery {
    if (value === undefined) {
      return {};
    }

    assertObject(
      value,
      "recording library query",
      RecordingStorageChannel.ListRecordingLibrary,
    );
    const query: RunRecordingLibraryQuery = {};
    if (value.game !== undefined) {
      assertString(
        value.game,
        "game",
        RecordingStorageChannel.ListRecordingLibrary,
        {
          min: 1,
          max: 16,
        },
      );
      const game = GameIdSchema.safeParse(value.game);
      if (!game.success) {
        throw new IpcValidationError(
          RecordingStorageChannel.ListRecordingLibrary,
          "game is invalid",
        );
      }
      query.game = game.data;
    }
    if (value.league !== undefined) {
      assertString(
        value.league,
        "league",
        RecordingStorageChannel.ListRecordingLibrary,
        { min: 1, max: 80 },
      );
      query.league = value.league;
    }
    if (value.pageIndex !== undefined) {
      assertNumber(
        value.pageIndex,
        "page index",
        RecordingStorageChannel.ListRecordingLibrary,
        { integer: true, min: 0, max: 10_000 },
      );
      query.pageIndex = value.pageIndex;
    }
    if (value.pageSize !== undefined) {
      assertNumber(
        value.pageSize,
        "page size",
        RecordingStorageChannel.ListRecordingLibrary,
        { integer: true, min: 1, max: maxLibraryPageSize },
      );
      query.pageSize = value.pageSize;
    }
    if (value.sortBy !== undefined) {
      assertString(
        value.sortBy,
        "sort field",
        RecordingStorageChannel.ListRecordingLibrary,
        { min: 1, max: 32 },
      );
      if (
        !librarySortKeys.includes(value.sortBy as RunRecordingLibrarySortKey)
      ) {
        throw new IpcValidationError(
          RecordingStorageChannel.ListRecordingLibrary,
          "sort field is invalid",
        );
      }
      query.sortBy = value.sortBy as RunRecordingLibrarySortKey;
    }
    if (value.sortDirection !== undefined) {
      assertString(
        value.sortDirection,
        "sort direction",
        RecordingStorageChannel.ListRecordingLibrary,
        { min: 1, max: 8 },
      );
      if (
        !librarySortDirections.includes(
          value.sortDirection as RunRecordingLibrarySortDirection,
        )
      ) {
        throw new IpcValidationError(
          RecordingStorageChannel.ListRecordingLibrary,
          "sort direction is invalid",
        );
      }
      query.sortDirection =
        value.sortDirection as RunRecordingLibrarySortDirection;
    }

    return query;
  }

  private validateRecordingPathList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      throw new IpcValidationError(
        RecordingStorageChannel.DeleteManyRecordings,
        "recording paths must be an array",
      );
    }
    if (value.length > 100) {
      throw new IpcValidationError(
        RecordingStorageChannel.DeleteManyRecordings,
        "recording paths is too large",
      );
    }

    return value.map((path) => {
      assertString(
        path,
        "recording path",
        RecordingStorageChannel.DeleteManyRecordings,
        { min: 1, max: 2_048 },
      );

      return path;
    });
  }

  private normalizeLibraryQuery(
    query: RunRecordingLibraryQuery,
  ): Required<RunRecordingLibraryQuery> {
    const pageQuery = normalizeMediaLibraryPageQuery(query, {
      pageIndex: 0,
      pageSize: defaultLibraryPageSize,
      sortBy: "createdAt",
      sortDirection: "desc",
    });

    return {
      game: query.game ?? "poe1",
      league: query.league ?? "",
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
      sortBy: pageQuery.sortBy,
      sortDirection: pageQuery.sortDirection,
    };
  }

  private resolveRecordingActionPath(path: string): string | null {
    const resolvedPath = this.resolveManagedRecordingPath(path);
    if (!resolvedPath || !existsSync(resolvedPath)) {
      return null;
    }

    return resolvedPath;
  }

  private resolveRecordingById(id: string): RunRecordingItem | null {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.syncRecordingLibrary(root, settings);

    return this.repository.getItemById(id);
  }

  private resolveManagedRecordingPath(path: string): string | null {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    const resolvedPath = resolve(path);
    if (
      !isPathInsideOrEqual(root, resolvedPath) ||
      !isManagedRecordingFilePath(root, resolvedPath)
    ) {
      return null;
    }

    return resolvedPath;
  }

  private createFallbackRecordingId(path: string): string {
    return `file-${createHash("sha256").update(resolve(path)).digest("hex").slice(0, 32)}`;
  }

  private getExistingClipPaths(): Set<string> {
    return new Set(
      this.replayClipsRepository
        .listStoragePaths()
        .flatMap((clip) => [clip.processedClipPath, clip.originalObsPath])
        .filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        )
        .map((path) => resolve(path))
        .filter((path) => existsSync(path)),
    );
  }

  private ensureStorageRoot(root: string): void {
    try {
      mkdirSync(root, { recursive: true });
    } catch {}
  }

  private resolveStorageRoot(configuredPath: string | null): string {
    return resolveRecordingStorageRoot(configuredPath, app.getPath("videos"));
  }

  private syncRecordingLibrary(
    root: string,
    settings: ReturnType<SettingsStoreService["get"]>,
  ): void {
    const settingsKey = `${settings.activeGame}:${settings.activeLeague}`;
    const now = Date.now();
    if (
      this.recordingLibrarySyncCache?.root === root &&
      this.recordingLibrarySyncCache.settingsKey === settingsKey &&
      now - this.recordingLibrarySyncCache.syncedAtMs <
        recordingLibrarySyncCacheMs
    ) {
      return;
    }

    this.ensureStorageRoot(root);
    const clipPaths = this.getExistingClipPaths();
    const metadataByPath = new Map(
      this.repository
        .listRunRecordingSyncItems()
        .map((recording) => [resolve(recording.path), recording]),
    );
    const seenRecordingPaths = new Set<string>();

    for (const file of collectRecordingFiles(root)) {
      if (!this.isRunRecordingLibraryPath(file.path, root, clipPaths)) {
        continue;
      }

      seenRecordingPaths.add(file.path);
      const existing = metadataByPath.get(file.path);
      if (existing) {
        const fileChanged =
          !existing.exists ||
          existing.sizeBytes !== file.size ||
          existing.mtimeMs !== file.mtimeMs;
        const recoveredDurationSeconds =
          existing.durationSeconds === null || fileChanged
            ? this.readRecordingFileDuration(file.path)
            : null;
        if (
          fileChanged ||
          (existing.durationSeconds === null &&
            recoveredDurationSeconds !== null)
        ) {
          this.repository.updateFileState(file.path, {
            ...(fileChanged || recoveredDurationSeconds !== null
              ? { durationSeconds: recoveredDurationSeconds }
              : {}),
            exists: true,
            mtimeMs: file.mtimeMs,
            sizeBytes: file.size,
          });
        }
        continue;
      }

      const fallbackDate = new Date(file.mtimeMs).toISOString();
      const durationSeconds = this.readRecordingFileDuration(file.path);
      this.repository.upsertRunRecording({
        id: this.createFallbackRecordingId(file.path),
        path: file.path,
        sourceGame: settings.activeGame,
        sourceLeague: settings.activeLeague,
        createdAt: fallbackDate,
        startedAt: fallbackDate,
        stoppedAt: fallbackDate,
        durationSeconds,
        exists: true,
        mtimeMs: file.mtimeMs,
        sizeBytes: file.size,
      });
    }

    for (const metadata of metadataByPath.values()) {
      const path = resolve(metadata.path);
      if (seenRecordingPaths.has(path)) {
        continue;
      }

      if (metadata.exists || metadata.sizeBytes !== 0) {
        this.repository.updateFileState(path, { exists: false, sizeBytes: 0 });
      }
    }

    this.recordingLibrarySyncCache = {
      root,
      settingsKey,
      syncedAtMs: now,
    };
  }

  private invalidateRecordingLibrarySyncCache(): void {
    this.recordingLibrarySyncCache = null;
  }

  private isRunRecordingLibraryPath(
    path: string,
    root: string,
    clipPaths: Set<string>,
  ): boolean {
    const resolvedPath = resolve(path);

    return (
      !clipPaths.has(resolvedPath) &&
      !isPathInsideOrEqual(
        resolveRecordingStorageMediaDirectory(root, "deathClips"),
        resolvedPath,
      ) &&
      !isPathInsideOrEqual(
        resolveRecordingStorageMediaDirectory(root, "manualClips"),
        resolvedPath,
      )
    );
  }

  private readRecordingFileDuration(path: string): number | null {
    const durationSeconds = readMp4DurationSeconds(path);
    if (durationSeconds !== null) {
      logInfo(
        RECORDING_STORAGE_LOG_SCOPE,
        "Run recording duration recovered from media metadata",
        {
          durationSeconds,
          ...createSafePathLogFields(path, "recording"),
        },
      );
    } else {
      const resolvedPath = resolve(path);
      if (!this.durationProbeFailureLoggedPaths.has(resolvedPath)) {
        this.durationProbeFailureLoggedPaths.add(resolvedPath);
        logWarn(
          RECORDING_STORAGE_LOG_SCOPE,
          "Run recording duration metadata unavailable",
          createSafePathLogFields(path, "recording"),
        );
      }
    }

    return durationSeconds;
  }

  private getExistingFileStats(path: string): ExistingFileStats {
    try {
      const stats = statSync(path);

      return stats.isFile()
        ? { mtimeMs: stats.mtimeMs, sizeBytes: stats.size }
        : { mtimeMs: 0, sizeBytes: 0 };
    } catch {
      return { mtimeMs: 0, sizeBytes: 0 };
    }
  }

  private deleteMissingReplayClipRows(): number {
    let deletedRows = 0;
    for (const clip of this.replayClipsRepository.listStoragePaths()) {
      const paths = [clip.processedClipPath, clip.originalObsPath].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      );
      if (paths.length === 0 || paths.some((path) => existsSync(path))) {
        continue;
      }

      this.replayClipsRepository.delete(clip.id);
      deletedRows += 1;
    }

    return deletedRows;
  }
}

export type { RecordingStorageCleanupOptions, RecordingStorageCleanupResult };
export { RecordingStorageService };
