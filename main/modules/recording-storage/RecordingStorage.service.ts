import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { app, BrowserWindow, shell } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { normalizeMediaLibraryPageQuery } from "~/main/modules/media-library/MediaLibrary.utils";
import { createRunRecordingMediaUrl } from "~/main/modules/media-protocol";
import { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { StorageFileDeletionService } from "~/main/modules/storage/StorageFileDeletion.service";
import {
  createSafePathLogFields,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import * as FileClipboard from "~/main/utils/file-clipboard";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { getIpcWindowRole } from "~/main/utils/ipc-window-roles";
import { readMp4DurationSeconds } from "~/main/utils/media-metadata";
import {
  getStagedFileDeletionTrashSize,
  rollbackStagedFileDeletions,
  stageFilesForDeletion,
} from "~/main/utils/staged-file-deletion";
import {
  isPathInsideOrEqual,
  isRealPathInsideOrEqual,
} from "~/main/utils/storage-files";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import type { GameId, ReplayClip } from "~/types";
import { RecordingStorageChannel } from "./RecordingStorage.channels";
import {
  type RecordingStorageCleanupOptions,
  type RecordingStorageCleanupSchedule,
  RecordingStorageCleanupScheduler,
} from "./RecordingStorage.cleanup-scheduler";
import { RECORDING_STORAGE_LOG_SCOPE } from "./RecordingStorage.constants";
import {
  deleteRecordingFile,
  recoverRecordingStorageDeletions,
} from "./RecordingStorage.deletion";
import type {
  RecordingStorageBatchFileActionResult,
  RecordingStorageFileActionResult,
  RecordingStorageUsage,
  RunRecordingCreateInput,
  RunRecordingDetail,
  RunRecordingItem,
  RunRecordingLibraryPage,
  RunRecordingLibraryQuery,
  RunRecordingMetadata,
} from "./RecordingStorage.dto";
import {
  calculateDiskUsage,
  collectRecordingFiles,
  removeEmptyParentDirectories,
} from "./RecordingStorage.files";
import { getManagedStoragePaths } from "./RecordingStorage.inventory";
import { setupRecordingStorageIpcHandlers } from "./RecordingStorage.ipc";
import { RecordingStorageRepository } from "./RecordingStorage.repository";
import {
  createRecordingStorageInventory,
  type RecordingStorageCleanupSelection,
  type RecordingStorageInventory,
  selectRecordingStorageCleanupCandidates,
} from "./RecordingStorage.retention";
import { calculateRecordingStorageUsage } from "./RecordingStorage.usage";
import {
  applyRecordingStoragePathMigrations,
  isManagedRecordingFilePath,
  planLegacyRecordingStorageMediaDirectoryMigrations,
  type RecordingStoragePathMigration,
  resolveRecordingStorageMediaDirectories,
  resolveRecordingStorageMediaDirectory,
  resolveRecordingStorageRoot,
} from "./RecordingStorage.utils";

const bytesPerGigabyte = 1024 ** 3;
const lowDiskSpaceWarningThresholdBytes = bytesPerGigabyte;
const defaultLibraryPageSize = 20;
const recordingLibrarySyncCacheMs = 2_000;
const storageInventoryPageSize = 500;
const storageMaintenanceContinuationDelayMs = 1_000;
const storageMaintenanceStartDelayMs = 60_000;
const storageUsageCacheMs = 5 * 60_000;
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

interface RecordingStorageUsageCache {
  calculatedAtMs: number;
  root: string;
  usage: RecordingStorageUsage;
}

interface ReplayClipRetentionCleanupResult {
  deletedIds: string[];
  deletedPaths: string[];
  failed: Array<{ id: string; error: string }>;
  freedBytes: number;
}

type ReplayClipRetentionCleanupHandler = (
  idGroups: string[][],
  root: string,
) => Promise<ReplayClipRetentionCleanupResult>;

interface ExistingFileStats {
  mtimeMs: number;
  sizeBytes: number;
}

interface RecordingFileDurationState extends ExistingFileStats {
  path: string;
}

class RecordingStorageService {
  private static instance: RecordingStorageService | null = null;
  private static performanceSensitiveActivityActive = false;

  private readonly durationProbeFailureLoggedPaths = new Set<string>();
  private readonly durationVerifiedFileStateByPath = new Map<string, string>();
  private recordingLibrarySyncCache: RecordingLibrarySyncCache | null = null;
  private usageCache: RecordingStorageUsageCache | null = null;
  private usageGeneration = 0;
  private usageRequest: {
    promise: Promise<RecordingStorageUsage>;
    root: string;
  } | null = null;
  private stagedDeletionRecoveryRequest: {
    promise: Promise<{ hasMore: boolean }>;
    root: string;
  } | null = null;
  private stagedDeletionRecoveryTimer: NodeJS.Timeout | null = null;
  private readonly pendingStagedDeletionRecoveryRoots = new Set<string>();
  private cleanupQueue: Promise<void> = Promise.resolve();
  private readonly cleanupRequests = new Map<
    string,
    Promise<RecordingStorageCleanupResult>
  >();
  private replayClipRetentionCleanupHandler: ReplayClipRetentionCleanupHandler | null =
    null;
  private readonly cleanupScheduler: RecordingStorageCleanupScheduler;
  private settingsUnsubscribe: (() => void) | null = null;
  private previousStorageSettings: {
    limitGigabytes: number;
    root: string;
  } | null = null;
  private readonly database: DatabaseService;
  private readonly fileDeletions: StorageFileDeletionService;
  private readonly replayClipsRepository: ReplayClipsRepository;
  private readonly repository: RecordingStorageRepository;

  static getInstance(): RecordingStorageService {
    if (!RecordingStorageService.instance) {
      RecordingStorageService.instance = new RecordingStorageService();
    }

    return RecordingStorageService.instance;
  }

  static setPerformanceSensitiveActivityActive(active: boolean): void {
    RecordingStorageService.performanceSensitiveActivityActive = active;
    RecordingStorageService.instance?.handlePerformanceSensitiveActivity(
      active,
    );
  }

  static resetForTests(): void {
    RecordingStorageService.instance?.settingsUnsubscribe?.();
    RecordingStorageService.instance?.cleanupScheduler.dispose();
    RecordingStorageService.instance?.clearStagedDeletionRecoveryTimer();
    RecordingStorageService.instance?.pendingStagedDeletionRecoveryRoots.clear();
    RecordingStorageService.instance = null;
    RecordingStorageService.performanceSensitiveActivityActive = false;
  }

  constructor() {
    const database = DatabaseService.getInstance();
    this.database = database;
    this.fileDeletions = new StorageFileDeletionService(database);
    this.replayClipsRepository = new ReplayClipsRepository(database);
    this.repository = new RecordingStorageRepository(database);
    this.cleanupScheduler = new RecordingStorageCleanupScheduler({
      cleanup: (options) => this.cleanup(options),
      getSnapshot: () => this.getCleanupSchedulerSnapshot(),
      handleError: (error) => {
        logWarn(
          RECORDING_STORAGE_LOG_SCOPE,
          "Scheduled storage cleanup failed",
          {
            error: safeErrorMessage(error),
          },
        );
      },
      invalidateUsageCache: () => this.invalidateUsageCache(),
    });
    this.cleanupScheduler.setPerformanceSensitiveActivityActive(
      RecordingStorageService.performanceSensitiveActivityActive,
    );
    const settingsStore = SettingsStoreService.getInstance();
    const settings = settingsStore.get();
    this.previousStorageSettings = {
      limitGigabytes: settings.recordingMaxStorageGb,
      root: this.resolveStorageRoot(settings.recordingStoragePath),
    };
    if (typeof settingsStore.onDidChange === "function") {
      this.settingsUnsubscribe = settingsStore.onDidChange((nextSettings) => {
        this.handleStorageSettingsChanged(nextSettings);
      });
    }
    setupRecordingStorageIpcHandlers({
      copyRecordingToClipboard: (path) => this.copyRecordingToClipboard(path),
      deleteManyRecordings: (paths) => this.deleteManyRecordings(paths),
      deleteRecording: (path) => this.deleteRecording(path),
      getRecording: (id) => this.getRecording(id),
      getUsage: () => this.getUsage(),
      listRecordingLibrary: (query) => this.listRecordingLibrary(query),
      openRecording: (path) => this.openRecording(path),
      revealRecording: (path) => this.revealRecording(path),
    });
  }

  async getUsage(): Promise<RecordingStorageUsage> {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    if (
      this.usageCache?.root === root &&
      Date.now() - this.usageCache.calculatedAtMs < storageUsageCacheMs
    ) {
      return this.usageCache.usage;
    }
    if (this.usageRequest?.root === root) {
      return this.usageRequest.promise;
    }

    const generation = this.usageGeneration;
    const promise = (async () => {
      await yieldToEventLoop();
      const totals = await calculateRecordingStorageUsage({
        recordingRepository: this.repository,
        replayClipsRepository: this.replayClipsRepository,
        root,
      });
      if (generation !== this.usageGeneration) {
        return this.getUsage();
      }

      const usage = this.createUsage(
        root,
        totals.clipsSizeBytes,
        totals.recordingsSizeBytes,
      );
      this.usageCache = { calculatedAtMs: Date.now(), root, usage };
      this.cleanupScheduler.resetEstimatedUsageGrowth();
      this.scheduleStagedDeletionRecovery(root);
      return usage;
    })();
    this.usageRequest = { promise, root };
    const clearRequest = () => {
      if (this.usageRequest?.promise === promise) {
        this.usageRequest = null;
      }
    };
    void promise.then(clearRequest, clearRequest);
    return promise;
  }

  publishUsageChanged(usage?: RecordingStorageUsage, usageRoot?: string): void {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    if (usage && usageRoot && usageRoot !== root) {
      usage = undefined;
    }
    if (usage) {
      this.usageGeneration += 1;
      this.usageRequest = null;
      this.usageCache = { calculatedAtMs: Date.now(), root, usage };
      this.cleanupScheduler.resetEstimatedUsageGrowth();
    } else {
      this.invalidateUsageCache();
    }
    const targetWindows = this.getMainWindows();
    if (targetWindows.length === 0) {
      return;
    }

    void (usage ? Promise.resolve(usage) : this.getUsage()).then(
      (nextUsage) => {
        for (const window of targetWindows) {
          if (!window.isDestroyed()) {
            window.webContents.send(
              RecordingStorageChannel.UsageChanged,
              nextUsage,
            );
          }
        }
      },
      (error) => {
        logWarn(RECORDING_STORAGE_LOG_SCOPE, "Storage usage refresh failed", {
          error: safeErrorMessage(error),
        });
      },
    );
  }

  noteUsageDelta(category: "clips" | "recordings", deltaBytes: number): void {
    if (!Number.isFinite(deltaBytes) || deltaBytes === 0) {
      return;
    }
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    if (this.usageCache?.root !== root) {
      this.usageGeneration += 1;
      this.usageRequest = null;
      return;
    }

    const usage = this.usageCache.usage;
    const nextUsage = {
      ...usage,
      clipsSizeBytes:
        category === "clips"
          ? Math.max(0, usage.clipsSizeBytes + deltaBytes)
          : usage.clipsSizeBytes,
      recordingsSizeBytes:
        category === "recordings"
          ? Math.max(0, usage.recordingsSizeBytes + deltaBytes)
          : usage.recordingsSizeBytes,
    };
    this.publishUsageChanged(nextUsage, root);
  }

  noteReplayClipUsageChange(
    previousClip: ReplayClip | null,
    nextClip: ReplayClip,
  ): void {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    const previousPaths = previousClip
      ? getManagedStoragePaths(root, previousClip)
      : [];
    const nextPaths = getManagedStoragePaths(root, nextClip);
    const previousKeys = new Set(previousPaths.map(createStoragePathKey));
    const nextKeys = new Set(nextPaths.map(createStoragePathKey));
    const pathsUnchanged =
      previousClip !== null &&
      previousKeys.size === nextKeys.size &&
      [...previousKeys].every((key) => nextKeys.has(key));
    if (pathsUnchanged && previousClip.sizeBytes === nextClip.sizeBytes) {
      return;
    }

    const pathsByKey = new Map<string, string>();
    for (const path of [...previousPaths, ...nextPaths]) {
      pathsByKey.set(createStoragePathKey(path), path);
    }
    const affectedPaths = [...pathsByKey.values()];
    const hasSharedClipPath = affectedPaths.some((path) =>
      this.replayClipsRepository.hasStoragePath(path, nextClip.id),
    );
    const hasRecordingPath = affectedPaths.some(
      (path) => this.repository.getItemByPath(path) !== null,
    );

    if (!hasSharedClipPath && (!hasRecordingPath || pathsUnchanged)) {
      this.noteUsageDelta(
        "clips",
        nextClip.sizeBytes - (previousClip?.sizeBytes ?? 0),
      );
      return;
    }

    if (
      previousClip &&
      pathsUnchanged &&
      nextPaths.length === 1 &&
      hasSharedClipPath
    ) {
      const sharedSizeBytes = this.replayClipsRepository.getMaxStoragePathSize(
        nextPaths[0]!,
        nextClip.id,
      );
      this.noteUsageDelta(
        "clips",
        Math.max(sharedSizeBytes, nextClip.sizeBytes) -
          Math.max(sharedSizeBytes, previousClip.sizeBytes),
      );
      return;
    }

    this.publishUsageChanged();
  }

  publishRecordingsChanged(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }

    for (const window of this.getMainWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(
          RecordingStorageChannel.RecordingsChanged,
          ids.slice(0, 100),
        );
      }
    }
  }

  initializeStorageRoot(): void {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.ensureStorageRoot(root);
  }

  refreshLibrary(options: { publishUsage?: boolean } = {}): void {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    this.syncRecordingLibrary(root, settings);
    if (options.publishUsage !== false) {
      this.publishUsageChanged();
    }
  }

  migrateLegacyMediaDirectories(root: string): void {
    const pendingMigrations =
      this.repository.listPendingStoragePathMigrations();
    const appliedPendingMigrations =
      applyRecordingStoragePathMigrations(pendingMigrations);
    let updatedRows = this.completeStoragePathMigrations(
      appliedPendingMigrations,
    );

    const pendingMigrationSources = new Set(
      pendingMigrations.map((migration) => resolve(migration.from)),
    );
    const plannedMigrations =
      planLegacyRecordingStorageMediaDirectoryMigrations(root).filter(
        (migration) => !pendingMigrationSources.has(resolve(migration.from)),
      );
    this.repository.savePendingStoragePathMigrations(plannedMigrations);
    const appliedPlannedMigrations =
      applyRecordingStoragePathMigrations(plannedMigrations);
    updatedRows += this.completeStoragePathMigrations(appliedPlannedMigrations);

    if (
      pendingMigrations.length > 0 ||
      plannedMigrations.length > 0 ||
      updatedRows > 0
    ) {
      this.invalidateRecordingLibrarySyncCache();
    }
  }

  listRecordingLibrary(
    query: RunRecordingLibraryQuery = {},
  ): RunRecordingLibraryPage {
    const normalizedQuery = this.normalizeLibraryQuery(query);
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    if (this.syncRecordingLibrary(root, settings)) {
      this.publishUsageChanged();
    }
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

  listEditorRecordingDetailPage(input: {
    createdAfter?: string;
    excludeIds?: string[];
    game?: GameId;
    includeIds?: string[];
    league?: string;
    pageIndex: number;
    pageSize: number;
  }): { items: RunRecordingDetail[]; totalCount: number } {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    if (this.syncRecordingLibrary(root, settings)) {
      this.publishUsageChanged();
    }
    const filter = {
      ...(input.createdAfter ? { createdAfter: input.createdAfter } : {}),
      ...(input.excludeIds && input.excludeIds.length > 0
        ? { excludeIds: input.excludeIds }
        : {}),
      ...(input.game ? { game: input.game } : {}),
      ...(input.includeIds && input.includeIds.length > 0
        ? { includeIds: input.includeIds }
        : {}),
      ...(input.league ? { league: input.league } : {}),
    };
    const page = this.repository.listLibraryPage({
      filter,
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
      sortBy: "createdAt",
      sortDirection: "desc",
    });

    return {
      items: page.items.map((recording) => ({
        mediaUrl: this.resolveRecordingActionPath(recording.path)
          ? createRunRecordingMediaUrl(recording.id)
          : null,
        recording,
      })),
      totalCount: page.totalCount,
    };
  }

  getRecordingMediaPath(id: string): string | null {
    const recording = this.resolveRecordingById(id);

    return recording ? this.resolveRecordingActionPath(recording.path) : null;
  }

  registerRunRecording(input: RunRecordingCreateInput): RunRecordingMetadata {
    const resolvedPath = resolve(input.path);
    const previousRecording = this.repository.getItemByPath(resolvedPath);
    const fileStats = this.getExistingFileStats(resolvedPath);
    const mediaDurationSeconds =
      input.durationSeconds === undefined && fileStats.sizeBytes > 0
        ? this.readRecordingFileDuration(resolvedPath)
        : null;
    const durationSeconds = input.durationSeconds ?? mediaDurationSeconds;
    const recording = this.repository.upsertRunRecording({
      ...input,
      path: resolvedPath,
      durationSeconds,
      exists: fileStats.sizeBytes > 0,
      mtimeMs: fileStats.mtimeMs,
      sizeBytes: fileStats.sizeBytes,
    });
    if (mediaDurationSeconds !== null) {
      this.markRecordingDurationVerified({
        path: resolvedPath,
        mtimeMs: fileStats.mtimeMs,
        sizeBytes: fileStats.sizeBytes,
      });
    }
    this.recordingLibrarySyncCache = null;
    if (!this.replayClipsRepository.hasStoragePath(resolvedPath)) {
      this.noteUsageDelta(
        "recordings",
        fileStats.sizeBytes - (previousRecording?.sizeBytes ?? 0),
      );
    }
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

  async deleteRecording(
    path: string,
    options: { publishUsage?: boolean } = {},
  ): Promise<RecordingStorageFileActionResult> {
    try {
      const recordingPath = this.resolveManagedRecordingPath(path);
      if (!recordingPath) {
        return { ok: false, error: "Recording file is not available" };
      }

      const settings = SettingsStoreService.getInstance().get();
      const root = this.resolveStorageRoot(settings.recordingStoragePath);
      const deletion = await deleteRecordingFile({
        dependencies: {
          bookmarks: BookmarksService.getInstance(),
          database: this.database,
          fileDeletions: this.fileDeletions,
          recordingRepository: this.repository,
          replayClipsRepository: this.replayClipsRepository,
        },
        path: recordingPath,
        root,
      });

      logInfo(RECORDING_STORAGE_LOG_SCOPE, "Run recording deleted", {
        deletedMetadata: deletion.deletedMetadata,
        ...createSafePathLogFields(recordingPath, "recording"),
      });
      if (deletion.cleanupError) {
        logWarn(
          RECORDING_STORAGE_LOG_SCOPE,
          "Run recording file cleanup failed",
          createSafePathLogFields(recordingPath, "recording"),
        );
      }
      this.invalidateRecordingLibrarySyncCache();
      if (options.publishUsage !== false) {
        this.publishUsageChanged();
      }

      return {
        ok: true,
        error: null,
        ...(deletion.cleanupError
          ? { cleanupError: deletion.cleanupError }
          : {}),
      };
    } catch (error) {
      return { ok: false, error: safeErrorMessage(error) };
    }
  }

  async deleteManyRecordings(
    paths: string[],
  ): Promise<RecordingStorageBatchFileActionResult> {
    const deletedPaths: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    const cleanupErrors: Array<{ path: string; error: string }> = [];

    for (const path of paths) {
      const result = await this.deleteRecording(path, { publishUsage: false });
      if (result.ok) {
        deletedPaths.push(path);
        if (result.cleanupError) {
          cleanupErrors.push({ path, error: result.cleanupError });
        }
        continue;
      }

      failed.push({ path, error: result.error ?? "Recording delete failed" });
    }

    if (deletedPaths.length > 0) {
      this.publishUsageChanged();
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

  setReplayClipRetentionCleanupHandler(
    handler: ReplayClipRetentionCleanupHandler,
  ): void {
    this.replayClipRetentionCleanupHandler = handler;
  }

  cleanup(
    options: RecordingStorageCleanupOptions = {},
  ): Promise<RecordingStorageCleanupResult> {
    const requestKey = createCleanupRequestKey(options);
    const pendingRequest = this.cleanupRequests.get(requestKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const run = this.cleanupQueue.then(() => this.runCleanup(options));
    this.cleanupRequests.set(requestKey, run);
    this.cleanupQueue = run.then(
      () => undefined,
      () => undefined,
    );
    void run.then(
      () => this.cleanupRequests.delete(requestKey),
      () => this.cleanupRequests.delete(requestKey),
    );
    return run;
  }

  scheduleCleanup(schedule: RecordingStorageCleanupSchedule = {}): void {
    const { usageAlreadyAccounted = false, ...nextSchedule } = schedule;
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    if (
      usageAlreadyAccounted &&
      this.usageCache?.root === root &&
      (nextSchedule.estimatedAddedBytes ?? 0) > 0
    ) {
      nextSchedule.estimatedAddedBytes = 0;
    }
    this.cleanupScheduler.schedule(nextSchedule);
  }

  private async runCleanup(
    options: RecordingStorageCleanupOptions,
  ): Promise<RecordingStorageCleanupResult> {
    const settings = SettingsStoreService.getInstance().get();
    const limitBytes = settings.recordingMaxStorageGb * bytesPerGigabyte;
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    const usageSnapshot = await this.getUsage();
    const usageTotals = {
      clipsSizeBytes: usageSnapshot.clipsSizeBytes,
      recordingsSizeBytes: usageSnapshot.recordingsSizeBytes,
      usageBytes:
        usageSnapshot.clipsSizeBytes + usageSnapshot.recordingsSizeBytes,
    };
    if (limitBytes <= 0 || usageTotals.usageBytes <= limitBytes) {
      logInfo(RECORDING_STORAGE_LOG_SCOPE, "Storage cleanup skipped", {
        usageBytes: usageTotals.usageBytes,
        limitBytes,
      });
      this.publishUsageChanged(
        this.createUsage(
          root,
          usageTotals.clipsSizeBytes,
          usageTotals.recordingsSizeBytes,
        ),
        root,
      );
      return {
        deletedCount: 0,
        freedBytes: 0,
        limitBytes,
        usageBytes: usageTotals.usageBytes,
      };
    }

    const inventory = await this.createStorageInventory(root);
    const selection = selectRecordingStorageCleanupCandidates({
      inventory,
      limitBytes,
      options,
    });

    if (selection.files.length === 0) {
      logInfo(RECORDING_STORAGE_LOG_SCOPE, "Storage cleanup skipped", {
        usageBytes: selection.usageBytes,
        limitBytes,
      });

      const result = {
        deletedCount: 0,
        freedBytes: 0,
        limitBytes,
        usageBytes: selection.usageBytes,
      };
      this.publishUsageChanged(
        this.createUsageFromInventory(inventory, root),
        root,
      );

      return result;
    }

    const deletedPaths: string[] = [];
    const changedRecordingIds: string[] = [];
    let cursor = 0;
    let freedClipBytes = 0;
    let freedRecordingBytes = 0;
    let deletedItemCount = 0;
    let recordingUsageReductionBytes = 0;
    let remainingUsageBytes = selection.usageBytes;

    while (
      remainingUsageBytes > selection.targetUsageBytes &&
      cursor < selection.files.length
    ) {
      const batch: typeof selection.files = [];
      let projectedUsageBytes = remainingUsageBytes;
      while (
        projectedUsageBytes > selection.targetUsageBytes &&
        cursor < selection.files.length
      ) {
        const candidate = selection.files[cursor++]!;
        batch.push(candidate);
        projectedUsageBytes -= candidate.size;
      }

      let batchUsageReductionBytes = 0;
      for (const file of batch) {
        if (file.kind === "clip") {
          continue;
        }

        const result = await this.deleteRecordingForRetention(file, root);
        deletedPaths.push(...result.deletedPaths);
        freedRecordingBytes += result.freedBytes;
        recordingUsageReductionBytes += result.usageReductionBytes;
        batchUsageReductionBytes += result.usageReductionBytes;
        if (result.recordingId) {
          changedRecordingIds.push(result.recordingId);
          deletedItemCount += 1;
        }
      }

      const selectedClipIdGroups = batch.flatMap((file) =>
        file.kind === "clip" ? [file.clipIds] : [],
      );
      const clipCleanup = await this.deleteReplayClipsForRetention(
        selectedClipIdGroups,
        root,
      );
      deletedPaths.push(...clipCleanup.deletedPaths);
      freedClipBytes += clipCleanup.freedBytes;
      deletedItemCount += clipCleanup.deletedIds.length;
      batchUsageReductionBytes += clipCleanup.freedBytes;
      remainingUsageBytes = Math.max(
        0,
        remainingUsageBytes - batchUsageReductionBytes,
      );
    }

    const actualFreedBytes = freedRecordingBytes + freedClipBytes;
    this.recordingLibrarySyncCache = null;
    const usage = this.createUsage(
      root,
      Math.max(0, inventory.clipsSizeBytes - freedClipBytes),
      Math.max(0, inventory.recordingsSizeBytes - recordingUsageReductionBytes),
    );
    this.publishUsageChanged(usage, root);
    this.publishRecordingsChanged(changedRecordingIds);
    logInfo(RECORDING_STORAGE_LOG_SCOPE, "Storage cleanup completed", {
      deletedCount: deletedPaths.length,
      freedBytes: actualFreedBytes,
      usageBytes: selection.usageBytes,
      limitBytes,
      targetUsageBytes: selection.targetUsageBytes,
    });

    if (
      remainingUsageBytes > selection.targetUsageBytes &&
      selection.hasMoreCandidates &&
      (remainingUsageBytes < selection.usageBytes || deletedItemCount > 0)
    ) {
      setTimeout(() => void this.cleanup(options), 0);
    }

    return {
      deletedCount: deletedPaths.length,
      freedBytes: actualFreedBytes,
      limitBytes,
      usageBytes: selection.usageBytes,
    };
  }

  private async deleteRecordingForRetention(
    file: Extract<
      RecordingStorageCleanupSelection["files"][number],
      { kind: "recording" }
    >,
    root: string,
  ): Promise<{
    deletedPaths: string[];
    freedBytes: number;
    recordingId: string | null;
    usageReductionBytes: number;
  }> {
    const recording = this.repository.getItemByPath(file.path);
    try {
      if (this.replayClipsRepository.hasStoragePath(file.path)) {
        return {
          deletedPaths: [],
          freedBytes: 0,
          recordingId: null,
          usageReductionBytes: 0,
        };
      }
      const fileStats = await stat(file.path);
      if (!fileStats.isFile()) {
        throw new Error("Recording storage path is not a file");
      }
      const stagedFiles = await stageFilesForDeletion(root, [
        { path: file.path, size: fileStats.size },
      ]);

      try {
        this.database.transaction(() => {
          if (this.replayClipsRepository.hasStoragePath(file.path)) {
            throw new Error(
              "Recording storage references changed during retention cleanup",
            );
          }
          if (recording) {
            BookmarksService.getInstance().archiveRecordingLinks(recording);
          }
          this.repository.updateFileState(file.path, {
            exists: false,
            sizeBytes: 0,
          });
          this.fileDeletions.markCommitted(stagedFiles, root);
        });
      } catch (error) {
        await rollbackStagedFileDeletions(stagedFiles);
        throw error;
      }

      const cleanup = await this.fileDeletions.finalize(stagedFiles);
      if (cleanup.failed.length > 0) {
        logWarn(
          RECORDING_STORAGE_LOG_SCOPE,
          "Failed to finalize staged recording deletion",
          createSafePathLogFields(file.path, "recording"),
        );
      } else {
        removeEmptyParentDirectories(file.path, root);
      }

      return {
        deletedPaths: cleanup.deletedPaths,
        freedBytes: cleanup.freedBytes,
        recordingId: recording?.id ?? null,
        usageReductionBytes:
          cleanup.failed.length === 0 ? Math.max(0, file.size) : 0,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.database.transaction(() => {
          if (recording) {
            BookmarksService.getInstance().archiveRecordingLinks(recording);
          }
          this.repository.updateFileState(file.path, {
            exists: false,
            sizeBytes: 0,
          });
        });
        return {
          deletedPaths: [],
          freedBytes: 0,
          recordingId: recording?.id ?? null,
          usageReductionBytes: Math.max(0, file.size),
        };
      }

      logWarn(RECORDING_STORAGE_LOG_SCOPE, "Failed to delete recording file", {
        ...createSafePathLogFields(file.path, "recording"),
        error: safeErrorMessage(error),
      });
      return {
        deletedPaths: [],
        freedBytes: 0,
        recordingId: null,
        usageReductionBytes: 0,
      };
    }
  }

  private async deleteReplayClipsForRetention(
    idGroups: string[][],
    root: string,
  ): Promise<ReplayClipRetentionCleanupResult> {
    if (idGroups.length === 0) {
      return {
        deletedIds: [],
        deletedPaths: [],
        failed: [],
        freedBytes: 0,
      };
    }
    if (!this.replayClipRetentionCleanupHandler) {
      const failed = idGroups.flat().map((id) => ({
        id,
        error: "Replay clip retention handler is unavailable",
      }));
      logWarn(
        RECORDING_STORAGE_LOG_SCOPE,
        "Replay clip retention cleanup skipped",
        { failedCount: failed.length },
      );
      return {
        deletedIds: [],
        deletedPaths: [],
        failed,
        freedBytes: 0,
      };
    }

    return this.replayClipRetentionCleanupHandler(idGroups, root);
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
      !isManagedRecordingFilePath(root, resolvedPath) ||
      (existsSync(resolvedPath) && !isRealPathInsideOrEqual(root, resolvedPath))
    ) {
      return null;
    }

    return resolvedPath;
  }

  private createFallbackRecordingId(path: string): string {
    return `file-${createHash("sha256")
      .update(resolve(path))
      .digest("hex")
      .slice(0, 32)}`;
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
        .filter((path) => existsSync(path))
        .map(createStoragePathKey),
    );
  }

  private ensureStorageRoot(root: string): void {
    try {
      mkdirSync(root, { recursive: true });
    } catch {}
    this.migrateLegacyMediaDirectories(root);
  }

  private completeStoragePathMigrations(
    migrations: RecordingStoragePathMigration[],
  ): number {
    if (migrations.length === 0) {
      return 0;
    }

    let updatedRows = 0;
    this.database.transaction(() => {
      updatedRows = this.replayClipsRepository.rebaseStoragePaths(migrations);
      this.repository.markStoragePathMigrationsCompleted(migrations);
    });

    return updatedRows;
  }

  private resolveStorageRoot(configuredPath: string | null): string {
    return resolveRecordingStorageRoot(configuredPath, app.getPath("videos"));
  }

  private async createStorageInventory(
    root: string,
  ): Promise<RecordingStorageInventory> {
    const [clips, recordings, stagedDeletionSizeBytes] = await Promise.all([
      this.loadStorageEntries(
        (after: { createdAt: string; id: string } | null, limit) =>
          this.replayClipsRepository.listStorageEntriesPage(after, limit),
        (entry) => ({ createdAt: entry.createdAt, id: entry.id }),
      ),
      this.loadStorageEntries(
        (after: { mtimeMs: number; path: string } | null, limit) =>
          this.repository.listStorageEntriesPage(after, limit),
        (entry) => ({ mtimeMs: entry.mtimeMs, path: entry.path }),
      ),
      getStagedFileDeletionTrashSize(root),
    ]);
    const inventory = await createRecordingStorageInventory({
      clips,
      recordings,
      root,
    });

    return {
      ...inventory,
      recordingsSizeBytes:
        inventory.recordingsSizeBytes + stagedDeletionSizeBytes,
      usageBytes: inventory.usageBytes + stagedDeletionSizeBytes,
    };
  }

  private scheduleStagedDeletionRecovery(root: string): void {
    this.pendingStagedDeletionRecoveryRoots.add(resolve(root));
    this.schedulePendingStagedDeletionRecovery();
  }

  private schedulePendingStagedDeletionRecovery(
    delayMs = storageMaintenanceStartDelayMs,
  ): void {
    if (
      RecordingStorageService.performanceSensitiveActivityActive ||
      this.stagedDeletionRecoveryTimer ||
      this.stagedDeletionRecoveryRequest ||
      this.pendingStagedDeletionRecoveryRoots.size === 0
    ) {
      return;
    }

    this.stagedDeletionRecoveryTimer = setTimeout(() => {
      this.stagedDeletionRecoveryTimer = null;
      this.runNextStagedDeletionRecovery();
    }, delayMs);
    this.stagedDeletionRecoveryTimer.unref?.();
  }

  private runNextStagedDeletionRecovery(): void {
    if (
      RecordingStorageService.performanceSensitiveActivityActive ||
      this.stagedDeletionRecoveryRequest
    ) {
      return;
    }
    const pendingRoot = this.pendingStagedDeletionRecoveryRoots
      .values()
      .next().value;
    if (!pendingRoot) {
      return;
    }
    this.pendingStagedDeletionRecoveryRoots.delete(pendingRoot);

    const promise = recoverRecordingStorageDeletions({
      fileDeletions: this.fileDeletions,
      root: pendingRoot,
    });
    this.stagedDeletionRecoveryRequest = { promise, root: pendingRoot };
    const finish = () => {
      /* v8 ignore next -- Only the recovery promise stored immediately above can settle this closure. */
      if (this.stagedDeletionRecoveryRequest?.promise === promise) {
        this.stagedDeletionRecoveryRequest = null;
      }
      this.schedulePendingStagedDeletionRecovery(
        storageMaintenanceContinuationDelayMs,
      );
    };
    void promise.then(
      (result) => {
        if (result.hasMore) {
          this.pendingStagedDeletionRecoveryRoots.add(pendingRoot);
        }
        finish();
      },
      (error) => {
        logWarn(
          RECORDING_STORAGE_LOG_SCOPE,
          "Storage deletion recovery failed",
          {
            error: safeErrorMessage(error),
          },
        );
        finish();
      },
    );
  }

  private clearStagedDeletionRecoveryTimer(): void {
    if (!this.stagedDeletionRecoveryTimer) {
      return;
    }
    clearTimeout(this.stagedDeletionRecoveryTimer);
    this.stagedDeletionRecoveryTimer = null;
  }

  private handlePerformanceSensitiveActivity(active: boolean): void {
    this.cleanupScheduler.setPerformanceSensitiveActivityActive(active);
    if (active) {
      this.clearStagedDeletionRecoveryTimer();
      return;
    }
    this.schedulePendingStagedDeletionRecovery();
  }

  private async loadStorageEntries<T, TCursor>(
    loadPage: (after: TCursor | null, limit: number) => T[],
    createCursor: (entry: T) => TCursor,
  ): Promise<T[]> {
    const entries: T[] = [];
    let cursor: TCursor | null = null;
    for (;;) {
      await yieldToEventLoop();
      const page = loadPage(cursor, storageInventoryPageSize);
      entries.push(...page);
      if (page.length < storageInventoryPageSize) {
        return entries;
      }
      cursor = createCursor(page.at(-1)!);
    }
  }

  private createUsageFromInventory(
    inventory: RecordingStorageInventory,
    root: string,
  ): RecordingStorageUsage {
    return this.createUsage(
      root,
      inventory.clipsSizeBytes,
      inventory.recordingsSizeBytes,
    );
  }

  private createUsage(
    root: string,
    clipsSizeBytes: number,
    recordingsSizeBytes: number,
  ): RecordingStorageUsage {
    const disk = calculateDiskUsage(root);

    return {
      clipsSizeBytes,
      diskFreeBytes: disk.freeBytes,
      lowDiskSpace:
        disk.freeBytes > 0 &&
        disk.freeBytes < lowDiskSpaceWarningThresholdBytes,
      recordingsSizeBytes,
    };
  }

  private handleStorageSettingsChanged(
    settings: ReturnType<SettingsStoreService["get"]>,
  ): void {
    const next = {
      limitGigabytes: settings.recordingMaxStorageGb,
      root: this.resolveStorageRoot(settings.recordingStoragePath),
    };
    const previous = this.previousStorageSettings;
    this.previousStorageSettings = next;
    /* v8 ignore next -- The constructor initializes the previous snapshot before subscribing to settings changes. */
    if (!previous) {
      return;
    }

    const rootChanged = previous.root !== next.root;
    const limitReduced =
      next.limitGigabytes > 0 &&
      (previous.limitGigabytes === 0 ||
        next.limitGigabytes < previous.limitGigabytes);
    if (rootChanged) {
      this.invalidateRecordingLibrarySyncCache();
      this.scheduleStagedDeletionRecovery(previous.root);
    }
    if (rootChanged || limitReduced) {
      this.scheduleCleanup({ force: true });
      this.scheduleStagedDeletionRecovery(next.root);
    }
  }

  private invalidateUsageCache(): void {
    this.usageGeneration += 1;
    this.usageCache = null;
    this.usageRequest = null;
  }

  private getCleanupSchedulerSnapshot(): {
    cachedUsageBytes: number | null;
    limitBytes: number;
  } {
    const settings = SettingsStoreService.getInstance().get();
    const root = this.resolveStorageRoot(settings.recordingStoragePath);
    const cachedUsage =
      this.usageCache?.root === root ? this.usageCache.usage : null;

    return {
      cachedUsageBytes: cachedUsage
        ? cachedUsage.clipsSizeBytes + cachedUsage.recordingsSizeBytes
        : null,
      limitBytes: settings.recordingMaxStorageGb * bytesPerGigabyte,
    };
  }

  private getMainWindows(): Electron.BrowserWindow[] {
    try {
      const getAllWindows = BrowserWindow?.getAllWindows;
      /* v8 ignore next -- Electron's BrowserWindow export always provides getAllWindows; this guards partial test/runtime shims. */
      if (typeof getAllWindows !== "function") {
        return [];
      }

      return getAllWindows
        .call(BrowserWindow)
        .filter(
          (window) =>
            !window.isDestroyed() &&
            getIpcWindowRole({ sender: window.webContents }) ===
              WindowName.Main,
        );
    } catch {
      return [];
    }
  }

  private syncRecordingLibrary(
    root: string,
    settings: ReturnType<SettingsStoreService["get"]>,
  ): boolean {
    if (RecordingStorageService.performanceSensitiveActivityActive) {
      return false;
    }
    const settingsKey = `${settings.activeGame}:${settings.activeLeague}`;
    const now = Date.now();
    if (
      this.recordingLibrarySyncCache?.root === root &&
      this.recordingLibrarySyncCache.settingsKey === settingsKey &&
      now - this.recordingLibrarySyncCache.syncedAtMs <
        recordingLibrarySyncCacheMs
    ) {
      return false;
    }

    this.ensureStorageRoot(root);
    const clipPaths = this.getExistingClipPaths();
    const metadataByPath = new Map(
      this.repository
        .listRunRecordingSyncItems()
        .map((recording) => [createStoragePathKey(recording.path), recording]),
    );
    const seenRecordingPaths = new Set<string>();
    let didMutate = false;

    for (const file of collectRecordingFiles(root)) {
      if (!this.isRunRecordingLibraryPath(file.path, root, clipPaths)) {
        continue;
      }

      const filePathKey = createStoragePathKey(file.path);
      seenRecordingPaths.add(filePathKey);
      const existing = metadataByPath.get(filePathKey);
      if (existing) {
        const fileChanged =
          !existing.exists ||
          existing.sizeBytes !== file.size ||
          existing.mtimeMs !== file.mtimeMs;
        const fileState = {
          path: file.path,
          mtimeMs: file.mtimeMs,
          sizeBytes: file.size,
        };
        const shouldProbeDuration =
          fileChanged ||
          existing.durationSeconds === null ||
          (isRoundedSecondDuration(existing.durationSeconds) &&
            !this.isRecordingDurationVerified(fileState));
        const recoveredDurationSeconds = shouldProbeDuration
          ? this.readRecordingFileDuration(file.path, {
              logFailure: fileChanged || existing.durationSeconds === null,
              logSuccess: fileChanged || existing.durationSeconds === null,
            })
          : null;
        if (recoveredDurationSeconds !== null) {
          this.markRecordingDurationVerified(fileState);
        }
        const durationChanged =
          recoveredDurationSeconds !== null &&
          !areRecordingDurationsEqual(
            existing.durationSeconds,
            recoveredDurationSeconds,
          );
        if (
          !fileChanged &&
          existing.durationSeconds !== null &&
          durationChanged
        ) {
          logInfo(
            RECORDING_STORAGE_LOG_SCOPE,
            "Run recording duration refreshed from media metadata",
            {
              durationSeconds: recoveredDurationSeconds,
              previousDurationSeconds: existing.durationSeconds,
              ...createSafePathLogFields(file.path, "recording"),
            },
          );
        }
        if (
          fileChanged ||
          (existing.durationSeconds === null &&
            recoveredDurationSeconds !== null) ||
          durationChanged
        ) {
          this.repository.updateFileState(file.path, {
            durationSeconds: recoveredDurationSeconds,
            exists: true,
            mtimeMs: file.mtimeMs,
            sizeBytes: file.size,
          });
          didMutate = true;
        }
        continue;
      }

      const fallbackDate = new Date(file.mtimeMs).toISOString();
      const durationSeconds = this.readRecordingFileDuration(file.path);
      if (durationSeconds !== null) {
        this.markRecordingDurationVerified({
          path: file.path,
          mtimeMs: file.mtimeMs,
          sizeBytes: file.size,
        });
      }
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
      didMutate = true;
    }

    for (const metadata of metadataByPath.values()) {
      const path = resolve(metadata.path);
      if (seenRecordingPaths.has(createStoragePathKey(path))) {
        continue;
      }

      if (metadata.exists || metadata.sizeBytes !== 0) {
        const recording = this.repository.getItemByPath(path);
        /* v8 ignore next -- sync metadata and get-by-path rows come from the same table; false only guards inconsistent local SQLite state. */
        if (recording) {
          BookmarksService.getInstance().archiveRecordingLinks(recording);
        }
        this.repository.updateFileState(path, { exists: false, sizeBytes: 0 });
        didMutate = true;
      }
    }

    this.recordingLibrarySyncCache = {
      root,
      settingsKey,
      syncedAtMs: now,
    };
    if (didMutate) {
      this.invalidateUsageCache();
    }
    return didMutate;
  }

  private invalidateRecordingLibrarySyncCache(): void {
    this.recordingLibrarySyncCache = null;
    this.invalidateUsageCache();
  }

  private isRunRecordingLibraryPath(
    path: string,
    root: string,
    clipPaths: Set<string>,
  ): boolean {
    const resolvedPath = resolve(path);

    return (
      !clipPaths.has(createStoragePathKey(resolvedPath)) &&
      !isPathInsideOrEqual(
        resolveRecordingStorageMediaDirectory(root, "deathClips"),
        resolvedPath,
      ) &&
      !resolveRecordingStorageMediaDirectories(root, "manualReplays").some(
        (directory) => isPathInsideOrEqual(directory, resolvedPath),
      )
    );
  }

  private readRecordingFileDuration(
    path: string,
    options: { logFailure?: boolean; logSuccess?: boolean } = {},
  ): number | null {
    const logFailure = options.logFailure ?? true;
    const logSuccess = options.logSuccess ?? true;
    const durationSeconds = readMp4DurationSeconds(path);
    if (durationSeconds !== null) {
      if (logSuccess) {
        logInfo(
          RECORDING_STORAGE_LOG_SCOPE,
          "Run recording duration recovered from media metadata",
          {
            durationSeconds,
            ...createSafePathLogFields(path, "recording"),
          },
        );
      }
    } else {
      const resolvedPath = resolve(path);
      if (
        logFailure &&
        !this.durationProbeFailureLoggedPaths.has(resolvedPath)
      ) {
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

  private isRecordingDurationVerified(
    file: RecordingFileDurationState,
  ): boolean {
    const resolvedPath = resolve(file.path);

    return (
      this.durationVerifiedFileStateByPath.get(resolvedPath) ===
      this.createRecordingDurationStateKey({ ...file, path: resolvedPath })
    );
  }

  private markRecordingDurationVerified(
    file: RecordingFileDurationState,
  ): void {
    const resolvedPath = resolve(file.path);
    this.durationVerifiedFileStateByPath.set(
      resolvedPath,
      this.createRecordingDurationStateKey({ ...file, path: resolvedPath }),
    );
  }

  private createRecordingDurationStateKey(
    file: RecordingFileDurationState,
  ): string {
    return `${file.path}\0${file.sizeBytes}\0${file.mtimeMs}`;
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
}

export { RecordingStorageService };

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolvePromise) => setImmediate(resolvePromise));
}

function createCleanupRequestKey(
  options: RecordingStorageCleanupOptions,
): string {
  const directories = [...(options.protectedDirectories ?? [])]
    .map(createStoragePathKey)
    .sort();
  const paths = [...(options.protectedPaths ?? [])]
    .map(createStoragePathKey)
    .sort();

  return JSON.stringify({ directories, paths });
}

function areRecordingDurationsEqual(
  first: number | null,
  second: number | null,
): boolean {
  if (first === null || second === null) {
    return first === second;
  }

  return Math.abs(first - second) < 0.001;
}

function isRoundedSecondDuration(durationSeconds: number | null): boolean {
  return (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    Math.abs(durationSeconds - Math.round(durationSeconds)) < 0.001
  );
}
