import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { app } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { DatabaseService } from "~/main/modules/database";
import {
  resolveEditorExportInventoryRoots,
  type ScanEditorExportFilesOptions,
  type scanEditorExportFiles,
} from "~/main/modules/editor/EditorExport.inventory";
import { createEditorExportOwnershipPolicy } from "~/main/modules/editor/EditorExport.ownership";
import {
  resolveEditorExportLibraryRoots,
  resolveEditorExportStorageRoot,
  resolveImplicitlyOwnedEditorExportRoots,
} from "~/main/modules/editor/EditorExport.paths";
import { EditorExportInventoryService } from "~/main/modules/editor/EditorExportInventory.service";
import { EditorExportOwnershipRepository } from "~/main/modules/editor/EditorExportOwnership.repository";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { recordingQualityBaseBitrates } from "~/main/modules/managed-recorder/ManagedRecorder.utils";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { RecordingStorageRepository } from "~/main/modules/recording-storage/RecordingStorage.repository";
import {
  type RecordingStorageMediaKind,
  resolveRecordingStorageMediaDirectories,
  resolveRecordingStorageRoot,
} from "~/main/modules/recording-storage/RecordingStorage.utils";
import { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { logInfo } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { maskPath } from "~/main/utils/mask-path";
import {
  isPathInsideOrEqual,
  resolveStoragePathAliases,
} from "~/main/utils/storage-files";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import { type GameId, rewindBufferSeconds } from "~/types";
import { deleteGameLeagueStorage } from "./Storage.deletion";
import type {
  DeleteGameLeagueDataResult,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
  StorageRevealPathsResult,
} from "./Storage.dto";
import {
  calculateDatabaseSize,
  calculateDiskUsage,
  calculatePathSize,
  collectStorageRootInventory,
  getStorageDeviceId,
  parseResolution,
  resolveDatabaseFilePaths,
  type StorageFile,
  sumFileSizes,
} from "./Storage.files";
import { setupStorageIpcHandlers } from "./Storage.handlers";
import {
  addExportFileToStorageTotals,
  createExportStorageTotals,
  createExportStorageVolumes,
  createStorageBreakdown,
  storagePathAnchors,
} from "./Storage.info";
import { StorageFileDeletionService } from "./StorageFileDeletion.service";

const STORAGE_LOG_SCOPE = "storage";
const FALLBACK_REWIND_BUFFER_RESOLUTION = { width: 1920, height: 1080 };
const DEFAULT_INFO_CACHE_MS = 5_000;
const DEFAULT_MAX_EXPORT_ENTRIES = 250_000;
const DEFAULT_MAX_EXPORT_FILES = 250_000;

interface UsageBucket {
  game: GameId;
  leagueName: string;
  clipCount: number;
  recordingCount: number;
  estimatedSizeBytes: number;
}

interface StorageServiceDependencies {
  calculateDiskUsage?: typeof calculateDiskUsage;
  calculatePathSize?: typeof calculatePathSize;
  collectStorageRootInventory?: typeof collectStorageRootInventory;
  getStorageDeviceId?: typeof getStorageDeviceId;
  infoCacheMs?: number;
  maxExportEntries?: number;
  maxExportFiles?: number;
  scanExportFiles?: (
    options: ScanEditorExportFilesOptions,
  ) => ReturnType<typeof scanEditorExportFiles>;
}

interface StorageInfoRoots {
  exportLibraryRoots: string[];
  exportStorageRoot: string;
  key: string;
  storageRoot: string;
}

class StorageService {
  private static instance: StorageService | null = null;

  private appInstallationSizeCache: { path: string; sizeBytes: number } | null =
    null;
  private infoCache: {
    calculatedAtMs: number;
    info: StorageInfo;
    rootsKey: string;
  } | null = null;
  private infoGeneration = 0;
  private infoRequest: {
    generation: number;
    promise: Promise<StorageInfo>;
    rootsKey: string;
  } | null = null;
  private infoRootsKey: string | null = null;
  private readonly calculateDiskUsage: typeof calculateDiskUsage;
  private readonly calculatePathSize: typeof calculatePathSize;
  private readonly collectStorageRootInventory: typeof collectStorageRootInventory;
  private readonly database: DatabaseService;
  private readonly fileDeletions: StorageFileDeletionService;
  private readonly exportOwnershipRepository: EditorExportOwnershipRepository;
  private readonly infoCacheMs: number;
  private readonly maxExportEntries: number;
  private readonly maxExportFiles: number;
  private readonly getStorageDeviceId: typeof getStorageDeviceId;
  private readonly recordingStorageRepository: RecordingStorageRepository;
  private recordingInventoryCache: {
    files: StorageFile[];
    root: string;
  } | null = null;
  private readonly replayClipsRepository: ReplayClipsRepository;
  private readonly scanExportFiles: (
    options: ScanEditorExportFilesOptions,
  ) => ReturnType<typeof scanEditorExportFiles>;

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }

    return StorageService.instance;
  }

  static resetForTests(): void {
    StorageService.instance = null;
  }

  static noteExportInventoryChanged(): void {
    StorageService.instance?.invalidateInfoCache();
  }

  constructor(dependencies: StorageServiceDependencies = {}) {
    this.database = DatabaseService.getInstance();
    this.fileDeletions = new StorageFileDeletionService(this.database);
    this.exportOwnershipRepository = new EditorExportOwnershipRepository(
      this.database,
    );
    this.recordingStorageRepository = new RecordingStorageRepository(
      this.database,
    );
    this.replayClipsRepository = new ReplayClipsRepository(this.database);
    this.calculateDiskUsage =
      dependencies.calculateDiskUsage ?? calculateDiskUsage;
    this.calculatePathSize =
      dependencies.calculatePathSize ?? calculatePathSize;
    this.collectStorageRootInventory =
      dependencies.collectStorageRootInventory ?? collectStorageRootInventory;
    this.getStorageDeviceId =
      dependencies.getStorageDeviceId ?? getStorageDeviceId;
    this.infoCacheMs = Math.max(
      0,
      dependencies.infoCacheMs ?? DEFAULT_INFO_CACHE_MS,
    );
    this.maxExportEntries = Math.max(
      0,
      dependencies.maxExportEntries ?? DEFAULT_MAX_EXPORT_ENTRIES,
    );
    this.maxExportFiles = Math.max(
      0,
      dependencies.maxExportFiles ?? DEFAULT_MAX_EXPORT_FILES,
    );
    this.scanExportFiles =
      dependencies.scanExportFiles ??
      ((options) => EditorExportInventoryService.getInstance().scan(options));
    setupStorageIpcHandlers({
      deleteGameLeagueData: (input) => this.deleteGameLeagueData(input),
      getGameLeagueUsage: () => this.getGameLeagueUsage(),
      getInfo: () => this.getInfo(),
      revealPaths: () => this.revealPaths(),
    });
  }

  getInfo(): Promise<StorageInfo> {
    const roots = this.resolveInfoRoots();
    if (roots.key !== this.infoRootsKey) {
      this.infoRootsKey = roots.key;
      this.infoGeneration += 1;
    }
    if (
      this.infoCache?.rootsKey === roots.key &&
      Date.now() - this.infoCache.calculatedAtMs < this.infoCacheMs
    ) {
      return Promise.resolve(this.infoCache.info);
    }
    const generation = this.infoGeneration;
    if (
      this.infoRequest?.rootsKey === roots.key &&
      this.infoRequest.generation === generation
    ) {
      return this.infoRequest.promise;
    }
    const request = (async () => {
      await RecordingStorageService.waitForPerformanceSensitiveActivityToEnd();
      const activityGeneration =
        RecordingStorageService.getPerformanceSensitiveActivityGeneration();
      return this.calculateInfo(
        roots,
        () =>
          generation !== this.infoGeneration ||
          RecordingStorageService.isPerformanceSensitiveActivityActive() ||
          activityGeneration !==
            RecordingStorageService.getPerformanceSensitiveActivityGeneration(),
      );
    })().then((info) => {
      if (!info) {
        return this.getInfo();
      }
      this.infoCache = {
        calculatedAtMs: Date.now(),
        info,
        rootsKey: roots.key,
      };
      return info;
    });
    this.infoRequest = { generation, promise: request, rootsKey: roots.key };
    const clearRequest = () => {
      if (this.infoRequest?.promise === request) {
        this.infoRequest = null;
      }
    };
    void request.then(clearRequest, clearRequest);
    return request;
  }

  private async calculateInfo(
    roots: StorageInfoRoots,
    shouldAbort: () => boolean,
  ): Promise<StorageInfo | null> {
    const { exportLibraryRoots, exportStorageRoot, storageRoot } = roots;
    this.ensureStorageRoot(storageRoot);
    this.ensureDirectory(exportStorageRoot);
    const exportLibraryAliases = exportLibraryRoots.flatMap((path) =>
      resolveStoragePathAliases(path),
    );
    const exportScanRoots =
      resolveEditorExportInventoryRoots(exportLibraryRoots);
    const storageDeviceId = this.getStorageDeviceId(storageRoot);

    const clipPathSet = this.collectClipPathKeys(storageRoot);
    const exportTotals = createExportStorageTotals(
      exportScanRoots,
      exportStorageRoot,
      storageDeviceId,
      this.getStorageDeviceId,
    );
    const exportOwnership = createEditorExportOwnershipPolicy(
      this.exportOwnershipRepository.list(),
      resolveImplicitlyOwnedEditorExportRoots({
        recordingStorageRoot: storageRoot,
        videosPath: app.getPath("videos"),
      }),
      {
        root: exportStorageRoot,
        trackingStartedAtMs:
          this.exportOwnershipRepository.getTrackingStartedAtMs(),
      },
    );
    const databasePath = this.database.path;
    const appInstallationPath = this.resolveAppInstallationPath();
    const [exportInventory, storageInventory, appInstallationSizeBytes] =
      await Promise.all([
        this.scanExportFiles({
          maxEntries: this.maxExportEntries,
          maxFiles: this.maxExportFiles,
          onFiles: (files) => {
            for (const file of files) {
              if (exportOwnership.isOwned(file)) {
                addExportFileToStorageTotals(exportTotals, file);
              }
            }
          },
          roots: exportScanRoots,
          shouldAbort,
        }),
        this.collectStorageRootInventory(
          storageRoot,
          new Set(resolveDatabaseFilePaths(databasePath)),
          exportLibraryAliases,
          shouldAbort,
        ),
        this.calculateAppInstallationSize(appInstallationPath, shouldAbort),
      ]);
    if (
      !exportInventory ||
      !storageInventory ||
      appInstallationSizeBytes === null ||
      shouldAbort()
    ) {
      return null;
    }
    const mediaFiles = storageInventory.recordingFiles;
    const manualReplayFiles = mediaFiles.filter((file) =>
      this.isMediaFileInDirectory(file.path, storageRoot, "manualReplays"),
    );
    const manualReplayPathSet = new Set(
      manualReplayFiles.map((file) => file.path),
    );
    const deathClipFiles = mediaFiles.filter(
      (file) =>
        !manualReplayPathSet.has(file.path) &&
        (this.isMediaFileInDirectory(file.path, storageRoot, "deathClips") ||
          clipPathSet.has(createStoragePathKey(file.path))),
    );
    const clipMediaPathSet = new Set(
      [...manualReplayFiles, ...deathClipFiles].map((file) => file.path),
    );
    const fullRecordingFiles = mediaFiles.filter(
      (file) => !clipMediaPathSet.has(file.path),
    );
    const temporaryFiles = storageInventory.temporaryFiles;
    const databaseSizeBytes = calculateDatabaseSize(databasePath);
    const storageDisk = this.calculateDiskUsage(storageRoot);
    const recordingsSizeBytes = sumFileSizes(mediaFiles);
    const appInstallationDeviceId =
      this.getStorageDeviceId(appInstallationPath);
    const databaseDeviceId = this.getStorageDeviceId(
      databasePath === ":memory:" ? null : databasePath,
    );
    const temporarySizeBytes = sumFileSizes(temporaryFiles);
    const rewindBufferEstimateBytes = this.estimateRewindBufferSizeBytes();
    const breakdown = createStorageBreakdown({
      appInstallationSizeBytes,
      databaseSizeBytes,
      deathClips: deathClipFiles,
      fullRecordings: fullRecordingFiles,
      manualReplays: manualReplayFiles,
      rewindBufferEstimateBytes,
      exportVideos: {
        fileCount: exportTotals.exportFileCount,
        sizeBytes: exportTotals.exportVideosSizeBytes,
      },
      temporaryFiles,
    });
    const exportStorageVolumes = createExportStorageVolumes(
      exportTotals,
      this.calculateDiskUsage,
    );

    if (shouldAbort()) {
      return null;
    }
    this.recordingInventoryCache = {
      files: mediaFiles,
      root: storageRoot,
    };

    return {
      storagePath: maskPath(storageRoot, storagePathAnchors),
      recordingsSizeBytes,
      recordingUsageTruncated: storageInventory.isTruncated,
      exportStorageVolumes,
      exportVideosUsageTruncated: exportInventory.isTruncated,
      appInstallationSizeBytes,
      temporarySizeBytes,
      rewindBufferEstimateBytes,
      databaseSizeBytes,
      totalTrackedSizeBytes:
        recordingsSizeBytes +
        exportTotals.exportVideosSizeBytes +
        temporarySizeBytes +
        appInstallationSizeBytes +
        databaseSizeBytes,
      diskTotalBytes: storageDisk.totalBytes,
      diskFreeBytes: storageDisk.freeBytes,
      appInstallationOnStorageDrive:
        storageDeviceId !== null && storageDeviceId === appInstallationDeviceId,
      databaseOnStorageDrive:
        storageDeviceId !== null && storageDeviceId === databaseDeviceId,
      breakdown,
      calculatedAt: new Date().toISOString(),
    };
  }

  private invalidateInfoCache(): void {
    this.infoGeneration += 1;
    this.infoCache = null;
    this.infoRequest = null;
  }

  async getGameLeagueUsage(): Promise<StorageGameLeagueUsage[]> {
    await this.getInfo();
    const buckets = new Map<string, UsageBucket>();

    for (const clip of this.replayClipsRepository.listStorageUsage()) {
      const bucket = this.getUsageBucket(buckets, clip.game, clip.leagueName);
      bucket.clipCount += clip.clipCount;
      bucket.estimatedSizeBytes += clip.sizeBytes;
    }

    const settings = SettingsStoreService.getInstance().get();
    const storageRoot = this.resolveStorageRoot();
    const clipPathKeys = this.collectClipPathKeys(storageRoot);
    const inventoryFiles =
      this.recordingInventoryCache?.root === storageRoot
        ? this.recordingInventoryCache.files
        : [];
    const inventorySizeByPath = new Map(
      inventoryFiles.map((file) => [
        createStoragePathKey(file.path),
        file.size,
      ]),
    );
    const knownRecordingPathKeys = new Set<string>();
    for (const recording of this.recordingStorageRepository.listDeleteTargets(
      {},
    )) {
      const pathKey = createStoragePathKey(recording.path);
      knownRecordingPathKeys.add(pathKey);
      if (clipPathKeys.has(pathKey)) {
        continue;
      }
      const bucket = this.getUsageBucket(
        buckets,
        recording.sourceGame,
        recording.sourceLeague,
      );
      bucket.recordingCount += 1;
      bucket.estimatedSizeBytes += inventorySizeByPath.get(pathKey) ?? 0;
    }

    for (const file of inventoryFiles) {
      const pathKey = createStoragePathKey(file.path);
      if (
        knownRecordingPathKeys.has(pathKey) ||
        clipPathKeys.has(pathKey) ||
        !this.isRunRecordingLibraryPath(file.path, storageRoot)
      ) {
        continue;
      }
      const bucket = this.getUsageBucket(
        buckets,
        settings.activeGame,
        settings.activeLeague,
      );
      bucket.recordingCount += 1;
      bucket.estimatedSizeBytes += file.size;
    }

    const recorderStatus = ManagedRecorderService.getInstance().getStatus();

    return [...buckets.values()]
      .map((bucket) => ({
        id: `${bucket.game}:${bucket.leagueName}`,
        game: bucket.game,
        leagueName: bucket.leagueName,
        clipCount: bucket.clipCount,
        recordingCount: bucket.recordingCount,
        estimatedSizeBytes: bucket.estimatedSizeBytes,
        hasActiveRecording:
          recorderStatus.runRecordingActive &&
          settings.activeGame === bucket.game &&
          settings.activeLeague === bucket.leagueName,
      }))
      .sort(
        (a, b) =>
          b.estimatedSizeBytes - a.estimatedSizeBytes ||
          a.game.localeCompare(b.game) ||
          a.leagueName.localeCompare(b.leagueName),
      );
  }

  private isRunRecordingLibraryPath(
    path: string,
    storageRoot: string,
  ): boolean {
    return (
      !this.isMediaFileInDirectory(path, storageRoot, "deathClips") &&
      !this.isMediaFileInDirectory(path, storageRoot, "manualReplays")
    );
  }

  async deleteGameLeagueData(
    input: StorageGameLeagueInput,
  ): Promise<DeleteGameLeagueDataResult> {
    try {
      const settings = SettingsStoreService.getInstance().get();
      const recorderStatus = ManagedRecorderService.getInstance().getStatus();
      if (
        recorderStatus.runRecordingActive &&
        settings.activeGame === input.game &&
        settings.activeLeague === input.leagueName
      ) {
        return {
          success: false,
          freedBytes: 0,
          deletedClipCount: 0,
          deletedRecordingCount: 0,
          error: "Stop the active recording before deleting this league data",
        };
      }

      const storageRoot = this.resolveStorageRoot();
      RecordingStorageService.getInstance().refreshLibrary({
        publishUsage: false,
      });
      const filter = { game: input.game, league: input.leagueName };
      const clips = this.replayClipsRepository.listAll(filter);
      const recordings =
        this.recordingStorageRepository.listDeleteTargets(filter);
      const { failedFileCount, freedBytes } = await deleteGameLeagueStorage({
        bookmarks: BookmarksService.getInstance(),
        clips,
        database: this.database,
        fileDeletions: this.fileDeletions,
        game: input.game,
        leagueName: input.leagueName,
        recordingRepository: this.recordingStorageRepository,
        recordings,
        replayClipsRepository: this.replayClipsRepository,
        storageRoot,
      });

      this.invalidateInfoCache();
      this.vacuumDatabase();
      RecordingStorageService.getInstance().publishUsageChanged();

      logInfo(STORAGE_LOG_SCOPE, "Deleted game league data", {
        game: input.game,
        league: input.leagueName,
        deletedClipCount: clips.length,
        deletedRecordingCount: recordings.length,
        deletedRecordingRowCount: recordings.length,
        freedBytes,
        failedFileCount,
      });

      if (failedFileCount > 0) {
        return {
          success: true,
          cleanupError: "Failed to delete one or more files",
          freedBytes,
          failedFileCount,
          deletedClipCount: clips.length,
          deletedRecordingCount: recordings.length,
        };
      }

      return {
        success: true,
        freedBytes,
        deletedClipCount: clips.length,
        deletedRecordingCount: recordings.length,
      };
    } catch (error) {
      return {
        success: false,
        freedBytes: 0,
        deletedClipCount: 0,
        deletedRecordingCount: 0,
        error: safeErrorMessage(error),
      };
    }
  }

  revealPaths(): StorageRevealPathsResult {
    const roots = this.resolveInfoRoots();
    const storageDeviceId = this.getStorageDeviceId(roots.storageRoot);
    const exportTotals = createExportStorageTotals(
      resolveEditorExportInventoryRoots(roots.exportLibraryRoots),
      roots.exportStorageRoot,
      storageDeviceId,
      this.getStorageDeviceId,
    );
    return {
      storagePath: roots.storageRoot,
      exportStoragePath: roots.exportStorageRoot,
      exportStorageVolumes: [...exportTotals.volumes.values()].map(
        (volume) => ({ id: volume.id, path: volume.path }),
      ),
      databasePath: this.database.path,
    };
  }

  private collectClipPathKeys(storageRoot: string): Set<string> {
    const paths = new Set<string>();
    for (const clip of this.replayClipsRepository.listStoragePaths()) {
      for (const path of [clip.processedClipPath, clip.originalObsPath]) {
        if (!path) {
          continue;
        }
        const resolvedPath = resolve(path);
        if (isPathInsideOrEqual(storageRoot, resolvedPath)) {
          paths.add(createStoragePathKey(resolvedPath));
        }
      }
    }
    return paths;
  }

  private getUsageBucket(
    buckets: Map<string, UsageBucket>,
    game: GameId,
    leagueName: string,
  ): UsageBucket {
    const id = `${game}:${leagueName}`;
    const existing = buckets.get(id);
    if (existing) {
      return existing;
    }

    const bucket: UsageBucket = {
      game,
      leagueName,
      clipCount: 0,
      recordingCount: 0,
      estimatedSizeBytes: 0,
    };
    buckets.set(id, bucket);

    return bucket;
  }

  private async calculateAppInstallationSize(
    path: string | null,
    shouldAbort: () => boolean,
  ): Promise<number | null> {
    if (!path) {
      return 0;
    }
    const resolvedPath = resolve(path);
    if (this.appInstallationSizeCache?.path === resolvedPath) {
      return this.appInstallationSizeCache.sizeBytes;
    }

    const sizeBytes = await this.calculatePathSize(resolvedPath, shouldAbort);
    if (sizeBytes === null) {
      return null;
    }
    this.appInstallationSizeCache = { path: resolvedPath, sizeBytes };

    return sizeBytes;
  }

  private estimateRewindBufferSizeBytes(): number {
    const settings = SettingsStoreService.getInstance().get();
    const recorderStatus = ManagedRecorderService.getInstance().getStatus();
    const resolution =
      parseResolution(recorderStatus.outputResolution) ??
      parseResolution(settings.recordingOutputResolution) ??
      FALLBACK_REWIND_BUFFER_RESOLUTION;
    const fpsFactor = Math.max(1, settings.recordingFps / 30);
    const pixelFactor =
      (resolution.width * resolution.height) /
      (FALLBACK_REWIND_BUFFER_RESOLUTION.width *
        FALLBACK_REWIND_BUFFER_RESOLUTION.height);
    const bitrate =
      recordingQualityBaseBitrates[settings.recordingClipQuality] *
      fpsFactor *
      pixelFactor;

    return Math.round((bitrate * rewindBufferSeconds) / 8);
  }

  private ensureStorageRoot(root: string): void {
    try {
      mkdirSync(root, { recursive: true });
    } catch {}
    RecordingStorageService.getInstance().migrateLegacyMediaDirectories(root);
  }

  private ensureDirectory(path: string): void {
    try {
      mkdirSync(path, { recursive: true });
    } catch {}
  }

  private resolveStorageRoot(): string {
    const settings = SettingsStoreService.getInstance().get();
    return resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      app.getPath("videos"),
    );
  }

  private resolveInfoRoots(): StorageInfoRoots {
    const settings = SettingsStoreService.getInstance().get();
    const videosPath = app.getPath("videos");
    const storageRoot = resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      videosPath,
    );
    const exportStorageRoot = resolveEditorExportStorageRoot(
      settings.editorExportStoragePath,
      videosPath,
    );
    const exportLibraryRoots = resolveEditorExportLibraryRoots({
      configuredExportPath: settings.editorExportStoragePath,
      recordingStorageRoot: storageRoot,
      videosPath,
    });
    const key = [
      resolveStoragePathAliases(storageRoot).at(-1)!,
      ...resolveEditorExportInventoryRoots(exportLibraryRoots),
    ]
      .map(createStoragePathKey)
      .join("\0");

    return { exportLibraryRoots, exportStorageRoot, key, storageRoot };
  }

  private resolveAppInstallationPath(): string | null {
    try {
      if (app.isPackaged) {
        return dirname(process.execPath);
      }

      return app.getAppPath();
    } catch {
      return null;
    }
  }

  private isMediaFileInDirectory(
    path: string,
    storageRoot: string,
    kind: RecordingStorageMediaKind,
  ): boolean {
    return resolveRecordingStorageMediaDirectories(storageRoot, kind).some(
      (directory) => isPathInsideOrEqual(directory, path),
    );
  }

  private vacuumDatabase(): void {
    if (this.database.path !== ":memory:") {
      this.database.db.exec("VACUUM");
    }
  }
}

export { StorageService };
