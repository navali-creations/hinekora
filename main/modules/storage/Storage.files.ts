import { type Dirent, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { isManagedRecordingFilePath } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { resolveReplayClipFilePath } from "~/main/modules/replay-clips/ReplayClips.files";
import {
  calculateDatabaseSize,
  calculateDiskUsage,
  collectManagedFiles,
  getExistingFileSize,
  removeEmptyParentDirectories,
  resolveDatabaseFilePaths,
} from "~/main/utils/storage-files";

import type { ReplayClip } from "~/types";

interface StorageFile {
  path: string;
  size: number;
}

function calculatePathSize(path: string): number {
  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(path);
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
  const pendingDirectories = [path];
  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop()!;
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      sizeBytes += getExistingFileSize(entryPath);
    }
  }

  return sizeBytes;
}

function collectDeleteFiles(
  clips: ReplayClip[],
  recordings: Array<{ path: string }>,
  storageRoot: string,
): StorageFile[] {
  const files = new Map<string, StorageFile>();
  for (const clip of clips) {
    for (const path of resolveClipPaths(clip, storageRoot)) {
      const size = getExistingFileSize(path);
      if (size > 0) {
        files.set(path, { path, size });
      }
    }
  }

  for (const recording of recordings) {
    const path = resolveManagedMediaPath(recording.path, storageRoot);
    if (!path) {
      continue;
    }
    const size = getExistingFileSize(path);
    if (size > 0) {
      files.set(path, { path, size });
    }
  }

  return [...files.values()];
}

function collectRecordingFiles(storageRoot: string): StorageFile[] {
  return collectManagedFiles(storageRoot, isManagedRecordingFilePath).map(
    (file) => ({
      path: file.path,
      size: file.size,
    }),
  );
}

function collectTemporaryFiles(
  storageRoot: string,
  managedMediaPathSet: Set<string>,
): StorageFile[] {
  if (!existsSync(storageRoot)) {
    return [];
  }

  const files: StorageFile[] = [];
  const pendingDirectories = [storageRoot];
  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop()!;
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const resolvedPath = resolve(entryPath);
      if (managedMediaPathSet.has(resolvedPath)) {
        continue;
      }

      const size = getExistingFileSize(resolvedPath);
      if (size > 0) {
        files.push({ path: resolvedPath, size });
      }
    }
  }

  return files;
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

export type { StorageFile };
export {
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
  resolveManagedMediaPath,
  sumFileSizes,
};
