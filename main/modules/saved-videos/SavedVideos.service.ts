import { createHash } from "node:crypto";
import type { PathLike, Stats } from "node:fs";
import { type opendir, rm, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";

import { app, BrowserWindow, shell } from "electron";

import { DatabaseService } from "~/main/modules/database";
import {
  type EditorExportFile,
  resolveEditorExportInventoryRoots,
  type ScanEditorExportFilesOptions,
  type scanEditorExportFiles,
} from "~/main/modules/editor/EditorExport.inventory";
import {
  createEditorExportOwnershipPolicy,
  hasSameEditorExportIdentity,
} from "~/main/modules/editor/EditorExport.ownership";
import {
  resolveEditorExportLibraryRoots,
  resolveEditorExportStorageRoot,
  resolveImplicitlyOwnedEditorExportRoots,
} from "~/main/modules/editor/EditorExport.paths";
import { EditorExportInventoryService } from "~/main/modules/editor/EditorExportInventory.service";
import { EditorExportOwnershipRepository } from "~/main/modules/editor/EditorExportOwnership.repository";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { normalizeMediaLibraryPageQuery } from "~/main/modules/media-library/MediaLibrary.utils";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { resolveRecordingStorageRoot } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { StorageService } from "~/main/modules/storage";
import {
  createSafePathLogFields,
  createTextHash,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { getIpcWindowRole } from "~/main/utils/ipc-window-roles";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import { storageBytesPerGigabyte } from "~/types";
import { SavedVideosChannel } from "./SavedVideos.channels";
import type {
  SavedVideoFileActionResult,
  SavedVideoItem,
  SavedVideosLibraryPage,
  SavedVideosLibraryQuery,
  SavedVideosLibrarySortKey,
} from "./SavedVideos.dto";
import { setupSavedVideosIpcHandlers } from "./SavedVideos.handlers";
import {
  createSavedVideosRetentionPlan,
  type SavedVideosRetentionPlan,
} from "./SavedVideos.retention";

const defaultPageSize = 20;
const libraryCacheMs = 30_000;
const maxLibraryFiles = 20_000;
const maxLibraryEntries = 100_000;
const scanBatchSize = 64;
const savedVideosLogScope = "saved-videos";
const savedVideosCleanupDelayMs = 1_000;
const savedVideosCleanupRetryLimit = 3;

interface SavedVideoCache {
  calculatedAtMs: number;
  filesById: Map<string, EditorExportFile>;
  isTruncated: boolean;
  items: SavedVideoItem[];
  rootsKey: string;
  sortedItems: Map<string, SavedVideoItem[]>;
}

interface SavedVideosServiceDependencies {
  createRetentionPlan?: (
    options: Parameters<typeof createSavedVideosRetentionPlan>[0],
  ) => Promise<SavedVideosRetentionPlan | null>;
  maxLibraryEntries?: number;
  maxLibraryFiles?: number;
  openDirectory?: typeof opendir;
  ownershipRepository?: EditorExportOwnershipRepository;
  removeFile?: typeof rm;
  scanBatchSize?: number;
  scanExportFiles?: (
    options: ScanEditorExportFilesOptions,
  ) => ReturnType<typeof scanEditorExportFiles>;
  statFile?: (path: PathLike) => Promise<Stats>;
}

interface SavedVideoExportCommit {
  deviceId: number;
  inode: number;
  modifiedAtMs: number;
  path: string;
  sizeDeltaBytes: number;
  sizeBytes: number;
}

interface SavedVideosCleanupOptions {
  protectedPaths?: string[];
  retryCount?: number;
}

interface SavedVideosCleanupResult {
  deletedCount: number;
  failedCount: number;
  freedBytes: number;
  limitBytes: number;
  usageBytes: number;
}

class SavedVideosService {
  private static instance: SavedVideosService | null = null;
  private cache: SavedVideoCache | null = null;
  private cacheGeneration = 0;
  private cleanupQueue: Promise<void> = Promise.resolve();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly createRetentionPlan: typeof createSavedVideosRetentionPlan;
  private exportLimitGigabytes: number;
  private libraryRequest: {
    generation: number;
    promise: Promise<SavedVideoCache>;
    rootsKey: string;
  } | null = null;
  private libraryRootsKey: string;
  private readonly maxLibraryFiles: number;
  private readonly maxLibraryEntries: number;
  private readonly openDirectory: typeof opendir | undefined;
  private readonly ownershipRepository: EditorExportOwnershipRepository;
  private readonly pendingCleanupProtectedPaths = new Map<string, string>();
  private readonly removeFile: typeof rm;
  private readonly scanBatchSize: number;
  private readonly scanStatFile:
    | ((path: PathLike) => Promise<Stats>)
    | undefined;
  private readonly scanExportFiles: (
    options: ScanEditorExportFilesOptions,
  ) => ReturnType<typeof scanEditorExportFiles>;
  private readonly statFile: (path: PathLike) => Promise<Stats>;
  private readonly settingsUnsubscribe: (() => void) | null;

  static getInstance(): SavedVideosService {
    if (!SavedVideosService.instance) {
      SavedVideosService.instance = new SavedVideosService();
    }

    return SavedVideosService.instance;
  }

  static noteExportCommitted(commit: SavedVideoExportCommit): void {
    const service = SavedVideosService.instance;
    if (!service) {
      return;
    }
    service.ownershipRepository.upsert({
      deviceId: commit.deviceId,
      inode: commit.inode,
      modifiedAtMs: commit.modifiedAtMs,
      path: commit.path,
      sizeBytes: commit.sizeBytes,
    });
    service.invalidateLibrary();
    RecordingStorageService.getInstance().noteUsageDelta(
      "export-videos",
      commit.sizeDeltaBytes,
    );
    service.scheduleCleanup({
      protectedPaths: [commit.path],
    });
  }

  static resetForTests(): void {
    SavedVideosService.instance?.settingsUnsubscribe?.();
    SavedVideosService.instance?.dispose();
    SavedVideosService.instance = null;
  }

  constructor(dependencies: SavedVideosServiceDependencies = {}) {
    this.createRetentionPlan =
      dependencies.createRetentionPlan ?? createSavedVideosRetentionPlan;
    this.maxLibraryEntries =
      dependencies.maxLibraryEntries ?? maxLibraryEntries;
    this.maxLibraryFiles = dependencies.maxLibraryFiles ?? maxLibraryFiles;
    this.openDirectory = dependencies.openDirectory;
    this.ownershipRepository =
      dependencies.ownershipRepository ??
      new EditorExportOwnershipRepository(DatabaseService.getInstance());
    this.removeFile = dependencies.removeFile ?? rm;
    this.scanBatchSize = dependencies.scanBatchSize ?? scanBatchSize;
    this.scanExportFiles =
      dependencies.scanExportFiles ??
      ((options) => EditorExportInventoryService.getInstance().scan(options));
    this.scanStatFile = dependencies.statFile;
    this.statFile = dependencies.statFile ?? stat;
    const settingsStore = SettingsStoreService.getInstance();
    const settings = settingsStore.get();
    this.exportLimitGigabytes = settings.editorExportMaxStorageGb;
    this.libraryRootsKey = createLibraryRootsKey(
      this.resolveLibraryRoots(settings),
    );
    this.settingsUnsubscribe =
      typeof settingsStore.onDidChange === "function"
        ? settingsStore.onDidChange((settings) => {
            const previousLimitGigabytes = this.exportLimitGigabytes;
            this.exportLimitGigabytes = settings.editorExportMaxStorageGb;
            const nextRootsKey = createLibraryRootsKey(
              this.resolveLibraryRoots(settings),
            );
            const rootsChanged = nextRootsKey !== this.libraryRootsKey;
            if (rootsChanged) {
              this.libraryRootsKey = nextRootsKey;
              this.invalidateLibrary();
            }
            const limitReduced =
              this.exportLimitGigabytes > 0 &&
              (previousLimitGigabytes === 0 ||
                this.exportLimitGigabytes < previousLimitGigabytes);
            if (limitReduced) {
              this.scheduleCleanup();
            }
          })
        : null;
    setupSavedVideosIpcHandlers({
      delete: (id) => this.delete(id),
      listLibrary: (query) => this.listLibrary(query),
      open: (id) => this.open(id),
      reveal: (id) => this.reveal(id),
    });
  }

  initializeRetention(): void {
    this.scheduleCleanup();
  }

  cleanup(
    options: SavedVideosCleanupOptions = {},
  ): Promise<SavedVideosCleanupResult> {
    const run = this.cleanupQueue.then(() => this.runCleanup(options));
    this.cleanupQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async listLibrary(
    query: SavedVideosLibraryQuery = {},
  ): Promise<SavedVideosLibraryPage> {
    const normalizedQuery = normalizeMediaLibraryPageQuery(query, {
      pageIndex: 0,
      pageSize: defaultPageSize,
      sortBy: "savedAt",
      sortDirection: "desc",
    });
    const cache = await this.loadLibrary();
    const sortKey = `${normalizedQuery.sortBy}:${normalizedQuery.sortDirection}`;
    let items = cache.sortedItems.get(sortKey);
    if (!items) {
      items = [...cache.items].sort((left, right) => {
        const comparison = compareItems(left, right, normalizedQuery.sortBy);
        return normalizedQuery.sortDirection === "asc"
          ? comparison
          : -comparison;
      });
      cache.sortedItems.set(sortKey, items);
    }
    const pageCount = Math.max(
      1,
      Math.ceil(items.length / normalizedQuery.pageSize),
    );
    const pageIndex = Math.min(normalizedQuery.pageIndex, pageCount - 1);
    const pageStart = pageIndex * normalizedQuery.pageSize;

    return {
      isTruncated: cache.isTruncated,
      items: items.slice(pageStart, pageStart + normalizedQuery.pageSize),
      pageCount,
      pageIndex,
      pageSize: normalizedQuery.pageSize,
      sortBy: normalizedQuery.sortBy,
      sortDirection: normalizedQuery.sortDirection,
      totalCount: items.length,
    };
  }

  async delete(id: string): Promise<SavedVideoFileActionResult> {
    const resolved = await this.resolveActionTarget(id);
    if (!resolved) {
      return { error: "Saved edit video is not available", ok: false };
    }

    try {
      await this.removeFile(resolved.path);
      this.ownershipRepository.remove(resolved.path);
      this.invalidateLibrary();
      RecordingStorageService.getInstance().noteUsageDelta(
        "export-videos",
        -resolved.sizeBytes,
      );
      logInfo(savedVideosLogScope, "Saved edit video deleted", {
        savedVideoIdHash: createTextHash(id),
        sizeBytes: resolved.sizeBytes,
      });
      return { error: null, ok: true };
    } catch (error) {
      return { error: safeErrorMessage(error), ok: false };
    }
  }

  async open(id: string): Promise<SavedVideoFileActionResult> {
    const resolved = await this.resolveActionTarget(id);
    if (!resolved) {
      return { error: "Saved edit video is not available", ok: false };
    }

    const error = await shell.openPath(resolved.path);
    return error
      ? { error: "Could not open saved edit video", ok: false }
      : { error: null, ok: true };
  }

  async reveal(id: string): Promise<SavedVideoFileActionResult> {
    const resolved = await this.resolveActionTarget(id);
    if (!resolved) {
      return { error: "Saved edit video is not available", ok: false };
    }

    shell.showItemInFolder(resolved.path);
    return { error: null, ok: true };
  }

  private async runCleanup(
    options: SavedVideosCleanupOptions,
  ): Promise<SavedVideosCleanupResult> {
    await RecordingStorageService.waitForPerformanceSensitiveActivityToEnd();
    const activityGeneration =
      RecordingStorageService.getPerformanceSensitiveActivityGeneration();
    const settings = SettingsStoreService.getInstance().get();
    const limitBytes =
      settings.editorExportMaxStorageGb * storageBytesPerGigabyte;
    const usageSnapshot =
      await RecordingStorageService.getInstance().getUsage();
    if (
      limitBytes <= 0 ||
      (usageSnapshot.exportVideosSizeBytes <= limitBytes &&
        !usageSnapshot.exportVideosUsageTruncated)
    ) {
      return {
        deletedCount: 0,
        failedCount: 0,
        freedBytes: 0,
        limitBytes,
        usageBytes: usageSnapshot.exportVideosSizeBytes,
      };
    }

    const roots = this.resolveLibraryRoots(settings);
    const ownership = this.createOwnershipPolicy(settings);
    const rootsKey = createLibraryRootsKey(roots);
    const generation = this.cacheGeneration;
    const shouldAbort = () =>
      generation !== this.cacheGeneration ||
      rootsKey !== createLibraryRootsKey(this.resolveLibraryRoots()) ||
      RecordingStorageService.isPerformanceSensitiveActivityActive() ||
      activityGeneration !==
        RecordingStorageService.getPerformanceSensitiveActivityGeneration();
    const plan = await this.createRetentionPlan({
      limitBytes,
      isOwned: ownership.isOwned,
      ...(this.openDirectory === undefined
        ? {}
        : { openDirectory: this.openDirectory }),
      ...(options.protectedPaths === undefined
        ? {}
        : { protectedPaths: options.protectedPaths }),
      roots,
      scanFiles: this.scanExportFiles,
      shouldAbort,
      ...(this.scanStatFile === undefined
        ? {}
        : { statFile: this.scanStatFile }),
    });
    if (!plan) {
      if (shouldAbort()) {
        this.scheduleCleanup(options);
      }
      return {
        deletedCount: 0,
        failedCount: 0,
        freedBytes: 0,
        limitBytes,
        usageBytes: usageSnapshot.exportVideosSizeBytes,
      };
    }
    const rootKeys = new Set(
      resolveEditorExportInventoryRoots(roots).map(createStoragePathKey),
    );
    const protectedPathKeys = new Set(
      (options.protectedPaths ?? []).map(createStoragePathKey),
    );
    let deletedCount = 0;
    let failedCount = 0;
    let freedBytes = 0;
    let staleCandidateCount = 0;
    let usageReductionBytes = 0;
    let wasAborted = false;
    let remainingUsageBytes = Math.max(
      plan.usageBytes,
      usageSnapshot.exportVideosSizeBytes,
    );

    for (const file of plan.files) {
      if (shouldAbort()) {
        wasAborted = true;
        break;
      }
      if (
        (!plan.isTruncated && remainingUsageBytes <= plan.targetUsageBytes) ||
        protectedPathKeys.has(createStoragePathKey(file.path)) ||
        !rootKeys.has(createStoragePathKey(dirname(file.path)))
      ) {
        continue;
      }

      try {
        const stats = await this.statFile(file.path);
        if (!stats.isFile() || !hasSameEditorExportIdentity(file, stats)) {
          staleCandidateCount += 1;
          continue;
        }
        await this.removeFile(file.path);
        this.ownershipRepository.remove(file.path);
        deletedCount += 1;
        freedBytes += Math.max(0, stats.size);
        usageReductionBytes += file.sizeBytes;
        remainingUsageBytes = Math.max(0, remainingUsageBytes - file.sizeBytes);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          this.ownershipRepository.remove(file.path);
          usageReductionBytes += file.sizeBytes;
          remainingUsageBytes = Math.max(
            0,
            remainingUsageBytes - file.sizeBytes,
          );
          continue;
        }
        failedCount += 1;
        logWarn(savedVideosLogScope, "Failed to delete retained export video", {
          ...createSafePathLogFields(file.path, "savedVideo"),
          error: safeErrorMessage(error),
        });
      }
    }

    if (usageReductionBytes > 0) {
      this.invalidateLibrary();
      RecordingStorageService.getInstance().noteUsageDelta(
        "export-videos",
        -usageReductionBytes,
      );
    }
    logInfo(savedVideosLogScope, "Export storage cleanup completed", {
      deletedCount,
      failedCount,
      freedBytes,
      isTruncated: plan.isTruncated,
      limitBytes,
      remainingUsageBytes,
      staleCandidateCount,
      targetUsageBytes: plan.targetUsageBytes,
      usageBytes: plan.usageBytes,
    });

    if (wasAborted) {
      this.scheduleCleanup(options);
    } else if (
      plan.isTruncated ||
      remainingUsageBytes > plan.targetUsageBytes
    ) {
      const retryCount = options.retryCount ?? 0;
      const baseOptions =
        options.protectedPaths === undefined
          ? {}
          : { protectedPaths: options.protectedPaths };
      if (
        usageReductionBytes > 0 &&
        (plan.isTruncated || plan.hasMoreCandidates)
      ) {
        this.scheduleCleanup(baseOptions);
      } else if (
        retryCount < savedVideosCleanupRetryLimit &&
        (plan.isTruncated || failedCount > 0 || staleCandidateCount > 0)
      ) {
        this.scheduleCleanup({
          ...baseOptions,
          retryCount: retryCount + 1,
        });
      }
    }

    return {
      deletedCount,
      failedCount,
      freedBytes,
      limitBytes,
      usageBytes: plan.usageBytes,
    };
  }

  private async loadLibrary(): Promise<SavedVideoCache> {
    const roots = this.resolveLibraryRoots();
    const rootsKey = createLibraryRootsKey(roots);
    if (
      this.cache?.rootsKey === rootsKey &&
      Date.now() - this.cache.calculatedAtMs < libraryCacheMs
    ) {
      return this.cache;
    }

    const generation = this.cacheGeneration;
    if (
      this.libraryRequest?.rootsKey === rootsKey &&
      this.libraryRequest.generation === generation
    ) {
      return this.libraryRequest.promise;
    }

    const promise = (async () => {
      const cache = await this.scanLibrary(roots, rootsKey, generation);
      return cache ?? this.loadLibrary();
    })();
    this.libraryRequest = { generation, promise, rootsKey };
    try {
      const cache = await promise;
      if (
        generation === this.cacheGeneration &&
        rootsKey === createLibraryRootsKey(this.resolveLibraryRoots())
      ) {
        this.cache = cache;
      }
      return cache;
    } finally {
      if (this.libraryRequest?.promise === promise) {
        this.libraryRequest = null;
      }
    }
  }

  private async scanLibrary(
    roots: readonly string[],
    rootsKey: string,
    generation: number,
  ): Promise<SavedVideoCache | null> {
    const items: SavedVideoItem[] = [];
    const filesById = new Map<string, EditorExportFile>();
    const ownership = this.createOwnershipPolicy();
    const result = await this.scanExportFiles({
      batchSize: this.scanBatchSize,
      maxEntries: this.maxLibraryEntries,
      maxFiles: this.maxLibraryFiles,
      onFiles: (files) => {
        for (const file of files) {
          if (!ownership.isOwned(file)) {
            continue;
          }
          const id = createSavedVideoId(file.path);
          filesById.set(id, file);
          items.push({
            fileName: basename(file.path),
            id,
            savedAt: file.modifiedAt.toISOString(),
            sizeBytes: file.sizeBytes,
          });
        }
      },
      ...(this.openDirectory === undefined
        ? {}
        : { openDirectory: this.openDirectory }),
      roots,
      shouldAbort: () => generation !== this.cacheGeneration,
      ...(this.scanStatFile === undefined
        ? {}
        : { statFile: this.scanStatFile }),
    });
    if (!result) {
      return null;
    }
    return {
      calculatedAtMs: Date.now(),
      filesById,
      isTruncated: result.isTruncated,
      items,
      rootsKey,
      sortedItems: new Map(),
    };
  }

  private invalidateLibrary(): void {
    EditorExportInventoryService.getInstance().invalidate();
    StorageService.noteExportInventoryChanged();
    this.cacheGeneration += 1;
    this.cache = null;
    this.libraryRequest = null;
    for (const window of BrowserWindow.getAllWindows()) {
      if (
        !window.isDestroyed() &&
        getIpcWindowRole({ sender: window.webContents }) === WindowName.Main
      ) {
        window.webContents.send(SavedVideosChannel.LibraryChanged);
      }
    }
  }

  private scheduleCleanup(options: SavedVideosCleanupOptions = {}): void {
    for (const path of options.protectedPaths ?? []) {
      this.pendingCleanupProtectedPaths.set(createStoragePathKey(path), path);
    }
    if (this.cleanupTimer) {
      return;
    }
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null;
      const protectedPaths = [...this.pendingCleanupProtectedPaths.values()];
      this.pendingCleanupProtectedPaths.clear();
      void this.cleanup({ protectedPaths }).catch((error) => {
        logWarn(savedVideosLogScope, "Scheduled export cleanup failed", {
          error: safeErrorMessage(error),
        });
      });
    }, savedVideosCleanupDelayMs);
    this.cleanupTimer.unref?.();
  }

  private dispose(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.pendingCleanupProtectedPaths.clear();
  }

  private async resolveActionTarget(
    id: string,
  ): Promise<{ path: string; sizeBytes: number } | null> {
    const cache = await this.loadLibrary();
    const file = cache.filesById.get(id);
    if (!file) {
      return null;
    }
    const rootKeys = new Set(
      resolveEditorExportInventoryRoots(this.resolveLibraryRoots()).map(
        createStoragePathKey,
      ),
    );
    if (
      !rootKeys.has(createStoragePathKey(dirname(file.path))) ||
      !this.createOwnershipPolicy().isOwned(file)
    ) {
      return null;
    }

    try {
      const stats = await this.statFile(file.path);
      return stats.isFile() && hasSameEditorExportIdentity(file, stats)
        ? { path: file.path, sizeBytes: Math.max(0, stats.size) }
        : null;
    } catch {
      return null;
    }
  }

  private resolveLibraryRoots(
    settings = SettingsStoreService.getInstance().get(),
  ): string[] {
    const videosPath = app.getPath("videos");
    const recordingStorageRoot = resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      videosPath,
    );
    return resolveEditorExportLibraryRoots({
      configuredExportPath: settings.editorExportStoragePath,
      recordingStorageRoot,
      videosPath,
    });
  }

  private createOwnershipPolicy(
    settings = SettingsStoreService.getInstance().get(),
  ) {
    const videosPath = app.getPath("videos");
    const recordingStorageRoot = resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      videosPath,
    );
    return createEditorExportOwnershipPolicy(
      this.ownershipRepository.list(),
      resolveImplicitlyOwnedEditorExportRoots({
        recordingStorageRoot,
        videosPath,
      }),
      {
        root: resolveEditorExportStorageRoot(
          settings.editorExportStoragePath,
          videosPath,
        ),
        trackingStartedAtMs: this.ownershipRepository.getTrackingStartedAtMs(),
      },
    );
  }
}

function createSavedVideoId(path: string): string {
  return createHash("sha256").update(createStoragePathKey(path)).digest("hex");
}

function createLibraryRootsKey(roots: readonly string[]): string {
  return roots.map(createStoragePathKey).join("\0");
}

function compareItems(
  left: SavedVideoItem,
  right: SavedVideoItem,
  sortBy: SavedVideosLibrarySortKey,
): number {
  const comparison =
    sortBy === "sizeBytes"
      ? left.sizeBytes - right.sizeBytes
      : left[sortBy].localeCompare(right[sortBy]);
  return comparison || left.id.localeCompare(right.id);
}

export { SavedVideosService };
