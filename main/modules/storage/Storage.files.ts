import { existsSync, statSync } from "node:fs";
import { opendir, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { isManagedRecordingFilePath } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { resolveReplayClipFilePath } from "~/main/modules/replay-clips/ReplayClips.files";
import {
  calculateDatabaseSize,
  calculateDiskUsage,
  getExistingFileSize,
  isPathInsideOrEqual,
  removeEmptyParentDirectories,
  resolveDatabaseFilePaths,
  resolveStoragePathAliases,
} from "~/main/utils/storage-files";

import type { ReplayClip } from "~/types";

interface StorageFile {
  path: string;
  size: number;
}

interface StorageRootInventory {
  isTruncated: boolean;
  recordingFiles: StorageFile[];
  temporaryFiles: StorageFile[];
}

interface ScanStorageDirectoryOptions {
  excludedDirectories?: readonly string[];
  maxEntries?: number;
  maxFiles?: number;
  onFiles: (files: StorageFile[]) => void;
  root: string;
  shouldAbort: () => boolean;
}

const storageScanBatchSize = 64;
const defaultStorageScanMaxEntries = 250_000;
const defaultStorageScanMaxFiles = 250_000;

interface StorageDirectoryScanResult {
  fileCount: number;
  inspectedEntryCount: number;
  isTruncated: boolean;
}

async function calculatePathSize(
  path: string,
  shouldAbort: () => boolean = () => false,
): Promise<number | null> {
  if (shouldAbort()) {
    return null;
  }

  let stats: Awaited<ReturnType<typeof stat>>;
  try {
    stats = await stat(path);
  } catch {
    return 0;
  }

  if (stats.isFile()) {
    return Math.max(0, stats.size);
  }
  if (!stats.isDirectory()) {
    return 0;
  }

  let sizeBytes = 0;
  const result = await scanStorageDirectory({
    maxEntries: Number.MAX_SAFE_INTEGER,
    maxFiles: Number.MAX_SAFE_INTEGER,
    onFiles: (files) => {
      sizeBytes += sumFileSizes(files);
    },
    root: path,
    shouldAbort,
  });

  return result ? sizeBytes : null;
}

function collectDeleteFiles(
  clips: ReplayClip[],
  recordings: Array<{ path: string }>,
  storageRoot: string,
): StorageFile[] {
  const files = new Map<string, StorageFile>();
  for (const clip of clips) {
    for (const path of resolveClipPaths(clip, storageRoot)) {
      const file = getExistingStorageFile(path);
      /* v8 ignore next -- resolveClipPaths already required an existing file; null requires a filesystem race. */
      if (file) {
        files.set(path, file);
      }
    }
  }

  for (const recording of recordings) {
    const path = resolveManagedMediaPath(recording.path, storageRoot);
    if (!path) {
      continue;
    }
    const file = getExistingStorageFile(path);
    /* v8 ignore next -- resolveManagedMediaPath already required an existing file; null requires a filesystem race. */
    if (file) {
      files.set(path, file);
    }
  }

  return [...files.values()];
}

function getExistingStorageFile(path: string): StorageFile | null {
  try {
    const stats = statSync(path);
    /* v8 ignore next -- Callers resolve an existing regular file immediately before this second defensive stat. */
    return stats.isFile() ? { path, size: Math.max(0, stats.size) } : null;
  } catch {
    /* v8 ignore next -- Covers a file disappearing between path validation and this defensive stat. */
    return null;
  }
}

async function collectStorageRootInventory(
  storageRoot: string,
  managedMediaPathSet: Set<string>,
  excludedDirectories: readonly string[] = [],
  shouldAbort: () => boolean = () => false,
  limits: { maxEntries?: number; maxFiles?: number } = {},
): Promise<StorageRootInventory | null> {
  const recordingFiles: StorageFile[] = [];
  const temporaryFiles: StorageFile[] = [];
  const result = await scanStorageDirectory({
    excludedDirectories,
    ...limits,
    onFiles: (files) => {
      for (const file of files) {
        if (isManagedRecordingFilePath(storageRoot, file.path)) {
          recordingFiles.push(file);
        } else if (!managedMediaPathSet.has(file.path)) {
          temporaryFiles.push(file);
        }
      }
    },
    root: storageRoot,
    shouldAbort,
  });

  return result
    ? {
        isTruncated: result.isTruncated,
        recordingFiles,
        temporaryFiles,
      }
    : null;
}

async function scanStorageDirectory(
  options: ScanStorageDirectoryOptions,
): Promise<StorageDirectoryScanResult | null> {
  const maxEntries = Math.max(
    0,
    options.maxEntries ?? defaultStorageScanMaxEntries,
  );
  const maxFiles = Math.max(0, options.maxFiles ?? defaultStorageScanMaxFiles);
  let fileCount = 0;
  let inspectedEntryCount = 0;
  const excludedDirectoryAliases = (options.excludedDirectories ?? []).flatMap(
    (path) => resolveStoragePathAliases(path),
  );
  const isExcluded = (path: string) =>
    excludedDirectoryAliases.some((directory) =>
      isPathInsideOrEqual(directory, path),
    );
  const appendPaths = async (
    paths: string[],
  ): Promise<"aborted" | "complete" | "truncated"> => {
    if (options.shouldAbort()) {
      return "aborted";
    }
    const files = (
      await Promise.all(
        paths.map(async (path): Promise<StorageFile | null> => {
          try {
            const stats = await stat(path);
            return stats.isFile() && stats.size > 0
              ? { path, size: stats.size }
              : null;
          } catch {
            return null;
          }
        }),
      )
    ).filter((file): file is StorageFile => file !== null);
    if (options.shouldAbort()) {
      return "aborted";
    }
    const accepted: StorageFile[] = [];
    for (const file of files) {
      if (fileCount >= maxFiles) {
        options.onFiles(accepted);
        return "truncated";
      }
      fileCount += 1;
      accepted.push(file);
    }
    options.onFiles(accepted);
    return "complete";
  };

  const pendingDirectories = [resolve(options.root)];
  while (pendingDirectories.length > 0) {
    if (options.shouldAbort()) {
      return null;
    }
    const currentDirectory = pendingDirectories.pop()!;
    if (isExcluded(currentDirectory)) {
      continue;
    }
    let directory: Awaited<ReturnType<typeof opendir>>;
    try {
      directory = await opendir(currentDirectory);
    } catch {
      continue;
    }

    let pendingPaths: string[] = [];
    for await (const entry of directory) {
      if (options.shouldAbort()) {
        return null;
      }
      inspectedEntryCount += 1;
      if (inspectedEntryCount > maxEntries) {
        const appendResult = await appendPaths(pendingPaths);
        return appendResult === "aborted"
          ? null
          : { fileCount, inspectedEntryCount, isTruncated: true };
      }
      const entryPath = resolve(directory.path, entry.name);
      if (isExcluded(entryPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (entry.isFile()) {
        pendingPaths.push(entryPath);
      }
      if (pendingPaths.length >= storageScanBatchSize) {
        const appendResult = await appendPaths(pendingPaths);
        if (appendResult === "aborted") {
          return null;
        }
        if (appendResult === "truncated") {
          return { fileCount, inspectedEntryCount, isTruncated: true };
        }
        pendingPaths = [];
      }
    }
    const appendResult = await appendPaths(pendingPaths);
    if (appendResult === "aborted") {
      return null;
    }
    if (appendResult === "truncated") {
      return { fileCount, inspectedEntryCount, isTruncated: true };
    }
  }

  return options.shouldAbort()
    ? null
    : { fileCount, inspectedEntryCount, isTruncated: false };
}

function parseResolution(
  value: string | null | undefined,
): { height: number; width: number } | null {
  if (!value) {
    return null;
  }

  const match = /(\d{2,5})\s*x\s*(\d{2,5})/i.exec(value);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { width, height };
}

function resolveClipPaths(clip: ReplayClip, storageRoot: string): string[] {
  return [
    resolveReplayClipFilePath(clip.processedClipPath, {
      storageRoot,
      requireExistingFile: true,
    }),
    resolveReplayClipFilePath(clip.originalObsPath, {
      storageRoot,
      requireExistingFile: true,
    }),
  ].filter((path): path is string => path !== null);
}

function resolveManagedMediaPath(
  path: string | null | undefined,
  storageRoot: string,
): string | null {
  if (!path) {
    return null;
  }

  const resolvedPath = resolve(path);
  if (!isManagedRecordingFilePath(storageRoot, resolvedPath)) {
    return null;
  }
  if (!existsSync(resolvedPath)) {
    return null;
  }

  try {
    const stats = statSync(resolvedPath);
    return stats.isFile() ? resolvedPath : null;
  } catch {
    return null;
  }
}

function sumFileSizes(files: StorageFile[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

function getStorageDeviceId(path: string | null): number | null {
  if (!path) {
    return null;
  }
  try {
    return statSync(path).dev;
  } catch {
    return null;
  }
}

export type { StorageFile };
export {
  calculateDatabaseSize,
  calculateDiskUsage,
  calculatePathSize,
  collectDeleteFiles,
  collectStorageRootInventory,
  getExistingFileSize,
  getStorageDeviceId,
  parseResolution,
  removeEmptyParentDirectories,
  resolveClipPaths,
  resolveDatabaseFilePaths,
  resolveManagedMediaPath,
  sumFileSizes,
};
