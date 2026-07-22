import { createHash } from "node:crypto";
import type { PathLike, Stats } from "node:fs";
import { opendir, rm, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { app, shell } from "electron";

import { resolveEditorExportLibraryRoots } from "~/main/modules/editor/EditorExport.paths";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { normalizeMediaLibraryPageQuery } from "~/main/modules/media-library/MediaLibrary.utils";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { resolveRecordingStorageRoot } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createTextHash, logInfo } from "~/main/utils/app-log";
import {
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import { SavedVideosChannel } from "./SavedVideos.channels";
import type {
  SavedVideoFileActionResult,
  SavedVideoItem,
  SavedVideosLibraryPage,
  SavedVideosLibraryQuery,
  SavedVideosLibrarySortKey,
} from "./SavedVideos.dto";
import {
  validateSavedVideoId,
  validateSavedVideosLibraryQuery,
} from "./SavedVideos.validation";

const defaultPageSize = 20;
const libraryCacheMs = 30_000;
const maxLibraryFiles = 20_000;
const scanBatchSize = 64;
const savedVideosLogScope = "saved-videos";

interface SavedVideoCache {
  calculatedAtMs: number;
  isTruncated: boolean;
  items: SavedVideoItem[];
  pathsById: Map<string, string>;
  rootsKey: string;
}

interface SavedVideosServiceDependencies {
  maxLibraryFiles?: number;
  openDirectory?: typeof opendir;
  removeFile?: typeof rm;
  scanBatchSize?: number;
  statFile?: (path: PathLike) => Promise<Stats>;
}

class SavedVideosService {
  private static instance: SavedVideosService | null = null;
  private cache: SavedVideoCache | null = null;
  private libraryRootsKey: string;
  private readonly maxLibraryFiles: number;
  private readonly openDirectory: typeof opendir;
  private readonly removeFile: typeof rm;
  private readonly scanBatchSize: number;
  private readonly statFile: (path: PathLike) => Promise<Stats>;
  private readonly settingsUnsubscribe: (() => void) | null;

  static getInstance(): SavedVideosService {
    if (!SavedVideosService.instance) {
      SavedVideosService.instance = new SavedVideosService();
    }

    return SavedVideosService.instance;
  }

  static notifyLibraryChanged(): void {
    if (SavedVideosService.instance) {
      SavedVideosService.instance.cache = null;
    }
  }

  static resetForTests(): void {
    SavedVideosService.instance?.settingsUnsubscribe?.();
    SavedVideosService.instance = null;
  }

  constructor(dependencies: SavedVideosServiceDependencies = {}) {
    this.maxLibraryFiles = dependencies.maxLibraryFiles ?? maxLibraryFiles;
    this.openDirectory = dependencies.openDirectory ?? opendir;
    this.removeFile = dependencies.removeFile ?? rm;
    this.scanBatchSize = dependencies.scanBatchSize ?? scanBatchSize;
    this.statFile = dependencies.statFile ?? stat;
    const settingsStore = SettingsStoreService.getInstance();
    this.libraryRootsKey = createLibraryRootsKey(
      this.resolveLibraryRoots(settingsStore.get()),
    );
    this.settingsUnsubscribe =
      typeof settingsStore.onDidChange === "function"
        ? settingsStore.onDidChange((settings) => {
            const nextRootsKey = createLibraryRootsKey(
              this.resolveLibraryRoots(settings),
            );
            if (nextRootsKey !== this.libraryRootsKey) {
              this.libraryRootsKey = nextRootsKey;
              this.cache = null;
            }
          })
        : null;
    this.setupHandlers();
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
    const items = [...cache.items].sort((left, right) => {
      const comparison = compareItems(left, right, normalizedQuery.sortBy);
      return normalizedQuery.sortDirection === "asc" ? comparison : -comparison;
    });
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
      this.cache = null;
      RecordingStorageService.getInstance().noteUsageDelta(
        "saved-edits",
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

  private async loadLibrary(): Promise<SavedVideoCache> {
    const roots = this.resolveLibraryRoots();
    const rootsKey = createLibraryRootsKey(roots);
    if (
      this.cache?.rootsKey === rootsKey &&
      Date.now() - this.cache.calculatedAtMs < libraryCacheMs
    ) {
      return this.cache;
    }

    const items: SavedVideoItem[] = [];
    const pathsById = new Map<string, string>();
    let isTruncated = false;
    for (const root of roots) {
      let directory: Awaited<ReturnType<typeof opendir>>;
      try {
        directory = await this.openDirectory(root);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
        throw error;
      }

      let pendingPaths: string[] = [];
      for await (const entry of directory) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".mp4")) {
          continue;
        }
        pendingPaths.push(resolve(directory.path, entry.name));
        if (pendingPaths.length >= this.scanBatchSize) {
          await this.appendFiles(items, pathsById, pendingPaths);
          pendingPaths = [];
        }
        if (items.length >= this.maxLibraryFiles) {
          isTruncated = true;
          break;
        }
      }
      await this.appendFiles(items, pathsById, pendingPaths);
      if (isTruncated || items.length >= this.maxLibraryFiles) {
        isTruncated = true;
        break;
      }
    }

    this.cache = {
      calculatedAtMs: Date.now(),
      isTruncated,
      items: items.slice(0, this.maxLibraryFiles),
      pathsById,
      rootsKey,
    };
    return this.cache;
  }

  private async appendFiles(
    items: SavedVideoItem[],
    pathsById: Map<string, string>,
    paths: string[],
  ): Promise<void> {
    const results = await Promise.all(
      paths.map(async (path) => {
        try {
          const stats = await this.statFile(path);
          return stats.isFile()
            ? {
                item: {
                  fileName: basename(path),
                  id: createSavedVideoId(path),
                  savedAt: stats.mtime.toISOString(),
                  sizeBytes: Math.max(0, stats.size),
                },
                path,
              }
            : null;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
          }
          throw error;
        }
      }),
    );
    for (const result of results) {
      if (!result || items.length >= this.maxLibraryFiles) {
        continue;
      }
      if (pathsById.has(result.item.id)) {
        continue;
      }
      pathsById.set(result.item.id, result.path);
      items.push(result.item);
    }
  }

  private async resolveActionTarget(
    id: string,
  ): Promise<{ path: string; sizeBytes: number } | null> {
    const cache = await this.loadLibrary();
    const path = cache.pathsById.get(id);
    if (!path) {
      return null;
    }
    const rootKeys = new Set(
      this.resolveLibraryRoots().map(createStoragePathKey),
    );
    if (!rootKeys.has(createStoragePathKey(dirname(path)))) {
      return null;
    }

    try {
      const stats = await this.statFile(path);
      return stats.isFile()
        ? { path, sizeBytes: Math.max(0, stats.size) }
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

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      SavedVideosChannel.ListLibrary,
      [WindowName.Main],
      async (_event, query: unknown) => {
        try {
          return await this.listLibrary(validateSavedVideosLibraryQuery(query));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    this.registerIdHandler(SavedVideosChannel.Delete, (id) => this.delete(id));
    this.registerIdHandler(SavedVideosChannel.Open, (id) => this.open(id));
    this.registerIdHandler(SavedVideosChannel.Reveal, (id) => this.reveal(id));
  }

  private registerIdHandler(
    channel:
      | SavedVideosChannel.Delete
      | SavedVideosChannel.Open
      | SavedVideosChannel.Reveal,
    handler: (id: string) => Promise<SavedVideoFileActionResult>,
  ): void {
    registerGuardedIpcHandler(
      channel,
      [WindowName.Main],
      async (_event, id: unknown) => {
        try {
          return await handler(validateSavedVideoId(id, channel));
        } catch (error) {
          return handleValidationError(error);
        }
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

export { SavedVideosService, type SavedVideosServiceDependencies };
