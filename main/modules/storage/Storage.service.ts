import { mkdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { app } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { RecordingStorageRepository } from "~/main/modules/recording-storage/RecordingStorage.repository";
import {
  type RecordingStorageMediaKind,
  resolveRecordingStorageMediaDirectory,
  resolveRecordingStorageRoot,
} from "~/main/modules/recording-storage/RecordingStorage.utils";
import { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  createSafePathLogFields,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import {
  assertObject,
  assertString,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";
import { maskPath } from "~/main/utils/mask-path";
import { isPathInsideOrEqual } from "~/main/utils/storage-files";

import type { GameId, RecordingQuality } from "~/types";
import { StorageChannel } from "./Storage.channels";
import type {
  DeleteGameLeagueDataResult,
  DiskSpaceCheck,
  StorageBreakdownItem,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
  StorageRevealPathsResult,
} from "./Storage.dto";
import {
  calculateDatabaseSize,
  calculateDiskUsage,
  calculatePathSize,
  collectDeleteFiles,
  collectRecordingFiles,
  collectTemporaryFiles,
  getExistingFileSize,
  parseResolution,
  removeEmptyParentDirectories,
  resolveClipPaths,
  resolveDatabaseFilePaths,
  type StorageFile,
  sumFileSizes,
} from "./Storage.files";

const STORAGE_LOG_SCOPE = "storage";
const LOW_DISK_SPACE_THRESHOLD_BYTES = 1024 ** 3;
const STORAGE_PATH_ANCHORS = ["Hinekora Recordings", "Hinekora"];
const REWIND_BUFFER_SECONDS = 60;
const FALLBACK_REWIND_BUFFER_RESOLUTION = { width: 1920, height: 1080 };
const REWIND_BUFFER_BASE_BITRATES: Record<RecordingQuality, number> = {
  low: 4_000_000,
  moderate: 6_000_000,
  high: 8_000_000,
  ultra: 12_000_000,
};

interface UsageBucket {
  game: GameId;
  leagueName: string;
  clipCount: number;
  recordingCount: number;
  estimatedSizeBytes: number;
}

class StorageService {
  private static instance: StorageService | null = null;

  private appInstallationSizeCache: { path: string; sizeBytes: number } | null =
    null;
  private readonly database: DatabaseService;
  private readonly recordingStorageRepository: RecordingStorageRepository;
  private readonly replayClipsRepository: ReplayClipsRepository;

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }

    return StorageService.instance;
  }

  static resetForTests(): void {
    StorageService.instance = null;
  }

  constructor() {
    this.database = DatabaseService.getInstance();
    this.recordingStorageRepository = new RecordingStorageRepository(
      this.database,
    );
    this.replayClipsRepository = new ReplayClipsRepository(this.database);
    this.setupHandlers();
  }

  getInfo(): StorageInfo {
    const storageRoot = this.resolveStorageRoot();
    this.ensureStorageRoot(storageRoot);

    const clipFiles = this.collectClipFiles(storageRoot);
    const clipPathSet = new Set(clipFiles.map((file) => file.path));
    const mediaFiles = collectRecordingFiles(storageRoot);
    const manualClipFiles = mediaFiles.filter((file) =>
      this.isMediaFileInDirectory(file.path, storageRoot, "manualClips"),
    );
    const manualClipPathSet = new Set(manualClipFiles.map((file) => file.path));
    const deathClipFiles = mediaFiles.filter(
      (file) =>
        !manualClipPathSet.has(file.path) &&
        (this.isMediaFileInDirectory(file.path, storageRoot, "deathClips") ||
          clipPathSet.has(file.path)),
    );
    const clipMediaPathSet = new Set(
      [...manualClipFiles, ...deathClipFiles].map((file) => file.path),
    );
    const fullRecordingFiles = mediaFiles.filter(
      (file) => !clipMediaPathSet.has(file.path),
    );
    const databasePath = this.database.path;
    const mediaPathSet = new Set(mediaFiles.map((file) => file.path));
    const temporaryFiles = collectTemporaryFiles(
      storageRoot,
      new Set([...mediaPathSet, ...resolveDatabaseFilePaths(databasePath)]),
    );
    const appInstallationPath = this.resolveAppInstallationPath();
    const appInstallationSizeBytes =
      this.calculateAppInstallationSize(appInstallationPath);
    const databaseSizeBytes = calculateDatabaseSize(databasePath);
    const storageDisk = calculateDiskUsage(storageRoot);
    const appInstallationDisk =
      appInstallationPath === null
        ? { totalBytes: 0, freeBytes: 0 }
        : calculateDiskUsage(appInstallationPath);
    const databaseDisk =
      databasePath === ":memory:"
        ? { totalBytes: 0, freeBytes: 0 }
        : calculateDiskUsage(dirname(databasePath));
    const mediaSizeBytes = sumFileSizes(mediaFiles);
    const temporarySizeBytes = sumFileSizes(temporaryFiles);
    const rewindBufferEstimateBytes = this.estimateRewindBufferSizeBytes();
    const breakdown = this.createBreakdown({
      appInstallationSizeBytes,
      databaseSizeBytes,
      deathClips: deathClipFiles,
      fullRecordings: fullRecordingFiles,
      manualClips: manualClipFiles,
      rewindBufferEstimateBytes,
      temporaryFiles,
    });

    return {
      storagePath: maskPath(storageRoot, STORAGE_PATH_ANCHORS),
      mediaSizeBytes,
      appInstallationSizeBytes,
      temporarySizeBytes,
      rewindBufferEstimateBytes,
      databaseSizeBytes,
      totalTrackedSizeBytes:
        mediaSizeBytes +
        temporarySizeBytes +
        appInstallationSizeBytes +
        databaseSizeBytes,
      diskTotalBytes: storageDisk.totalBytes,
      diskFreeBytes: storageDisk.freeBytes,
      appInstallationDiskTotalBytes: appInstallationDisk.totalBytes,
      appInstallationDiskFreeBytes: appInstallationDisk.freeBytes,
      databaseDiskTotalBytes: databaseDisk.totalBytes,
      databaseDiskFreeBytes: databaseDisk.freeBytes,
      breakdown,
      calculatedAt: new Date().toISOString(),
    };
  }

  getGameLeagueUsage(): StorageGameLeagueUsage[] {
    RecordingStorageService.getInstance().refreshLibrary();
    const buckets = new Map<string, UsageBucket>();

    for (const clip of this.replayClipsRepository.listStorageUsage()) {
      const bucket = this.getUsageBucket(buckets, clip.game, clip.leagueName);
      bucket.clipCount += clip.clipCount;
      bucket.estimatedSizeBytes += clip.sizeBytes;
    }

    for (const recording of this.recordingStorageRepository.listStorageUsage()) {
      const bucket = this.getUsageBucket(
        buckets,
        recording.game,
        recording.leagueName,
      );
      bucket.recordingCount += recording.recordingCount;
      bucket.estimatedSizeBytes += recording.sizeBytes;
    }

    const settings = SettingsStoreService.getInstance().get();
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

  deleteGameLeagueData(
    input: StorageGameLeagueInput,
  ): DeleteGameLeagueDataResult {
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
      RecordingStorageService.getInstance().refreshLibrary();
      const filter = { game: input.game, league: input.leagueName };
      const clips = this.replayClipsRepository.listAll(filter);
      const recordings =
        this.recordingStorageRepository.listDeleteTargets(filter);
      const files = collectDeleteFiles(clips, recordings, storageRoot);
      let freedBytes = 0;

      this.database.transaction(() => {
        this.database.runQuery(
          this.database.kysely
            .deleteFrom("replay_clips")
            .where("source_game", "=", input.game)
            .where("source_league", "=", input.leagueName),
        );
        this.database.runQuery(
          this.database.kysely
            .deleteFrom("run_recordings")
            .where("source_game", "=", input.game)
            .where("source_league", "=", input.leagueName),
        );
      });

      let failedFileCount = 0;
      for (const file of files) {
        try {
          unlinkSync(file.path);
          freedBytes += file.size;
          removeEmptyParentDirectories(file.path, storageRoot);
        } catch (error) {
          logWarn(STORAGE_LOG_SCOPE, "Failed to delete storage file", {
            ...createSafePathLogFields(file.path, "recording"),
            error: safeErrorMessage(error),
          });

          failedFileCount += 1;
        }
      }

      this.vacuumDatabase();

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

  checkDiskSpace(): DiskSpaceCheck {
    const disk = calculateDiskUsage(this.resolveStorageRoot());

    return {
      diskFreeBytes: disk.freeBytes,
      isLow:
        disk.freeBytes > 0 && disk.freeBytes < LOW_DISK_SPACE_THRESHOLD_BYTES,
    };
  }

  revealPaths(): StorageRevealPathsResult {
    return {
      storagePath: this.resolveStorageRoot(),
      databasePath: this.database.path,
    };
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(StorageChannel.GetInfo, [WindowName.Main], () =>
      this.getInfo(),
    );
    registerGuardedIpcHandler(
      StorageChannel.GetGameLeagueUsage,
      [WindowName.Main],
      () => this.getGameLeagueUsage(),
    );
    registerGuardedIpcHandler(
      StorageChannel.DeleteGameLeagueData,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          const parsedInput = this.parseGameLeagueInput(
            input,
            StorageChannel.DeleteGameLeagueData,
          );

          return this.deleteGameLeagueData(parsedInput);
        } catch (error) {
          return {
            success: false,
            freedBytes: 0,
            deletedClipCount: 0,
            deletedRecordingCount: 0,
            error: safeErrorMessage(error),
          };
        }
      },
    );
    registerGuardedIpcHandler(
      StorageChannel.CheckDiskSpace,
      [WindowName.Main],
      () => this.checkDiskSpace(),
    );
    registerGuardedIpcHandler(
      StorageChannel.RevealPaths,
      [WindowName.Main],
      () => this.revealPaths(),
    );
  }

  private parseGameLeagueInput(
    input: unknown,
    channel: string,
  ): StorageGameLeagueInput {
    assertObject(input, "input", channel);
    const game = input.game;
    const leagueName = input.leagueName;
    assertString(game, "game", channel, { min: 1, max: 16 });
    assertString(leagueName, "league", channel, { min: 1, max: 80 });
    if (game !== "poe1" && game !== "poe2") {
      throw new Error("game must be poe1 or poe2");
    }

    return { game, leagueName };
  }

  private createBreakdown(input: {
    appInstallationSizeBytes: number;
    databaseSizeBytes: number;
    deathClips: StorageFile[];
    fullRecordings: StorageFile[];
    manualClips: StorageFile[];
    rewindBufferEstimateBytes: number;
    temporaryFiles: StorageFile[];
  }): StorageBreakdownItem[] {
    const items: StorageBreakdownItem[] = [
      {
        category: "full-recordings",
        label: "Full recordings",
        fileCount: input.fullRecordings.length,
        sizeBytes: sumFileSizes(input.fullRecordings),
      },
      {
        category: "death-clips",
        label: "Death clips",
        fileCount: input.deathClips.length,
        sizeBytes: sumFileSizes(input.deathClips),
      },
      {
        category: "manual-clips",
        label: "Manual clips",
        fileCount: input.manualClips.length,
        sizeBytes: sumFileSizes(input.manualClips),
      },
      {
        category: "app-installation",
        label: "App installation",
        fileCount: input.appInstallationSizeBytes > 0 ? 1 : 0,
        sizeBytes: input.appInstallationSizeBytes,
      },
      {
        category: "rewind-buffer",
        estimated: true,
        label: "Rewind buffer",
        fileCount: 1,
        sizeBytes: input.rewindBufferEstimateBytes,
      },
      {
        category: "temporary-files",
        label: "Temporary files",
        fileCount: input.temporaryFiles.length,
        sizeBytes: sumFileSizes(input.temporaryFiles),
      },
      {
        category: "database",
        label: "Database & app data",
        fileCount: input.databaseSizeBytes > 0 ? 1 : 0,
        sizeBytes: input.databaseSizeBytes,
      },
    ];

    return items
      .filter(
        (item) =>
          item.category === "temporary-files" ||
          item.category === "rewind-buffer" ||
          item.fileCount > 0 ||
          item.sizeBytes > 0,
      )
      .sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  private collectClipFiles(storageRoot: string): StorageFile[] {
    const files = new Map<string, StorageFile>();
    for (const clip of this.replayClipsRepository.listAll()) {
      for (const path of resolveClipPaths(clip, storageRoot)) {
        const size = getExistingFileSize(path);
        if (size > 0) {
          files.set(path, { path, size });
        }
      }
    }

    return [...files.values()];
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

  private calculateAppInstallationSize(path: string | null): number {
    if (!path) {
      return 0;
    }
    const resolvedPath = resolve(path);
    if (this.appInstallationSizeCache?.path === resolvedPath) {
      return this.appInstallationSizeCache.sizeBytes;
    }

    const sizeBytes = calculatePathSize(resolvedPath);
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
      REWIND_BUFFER_BASE_BITRATES[settings.recordingClipQuality] *
      fpsFactor *
      pixelFactor;

    return Math.round((bitrate * REWIND_BUFFER_SECONDS) / 8);
  }

  private ensureStorageRoot(root: string): void {
    try {
      mkdirSync(root, { recursive: true });
    } catch {}
  }

  private resolveStorageRoot(): string {
    const settings = SettingsStoreService.getInstance().get();
    return resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      app.getPath("videos"),
    );
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
    return isPathInsideOrEqual(
      resolveRecordingStorageMediaDirectory(storageRoot, kind),
      path,
    );
  }

  private vacuumDatabase(): void {
    if (this.database.path !== ":memory:") {
      this.database.db.exec("VACUUM");
    }
  }
}

export { StorageService };
