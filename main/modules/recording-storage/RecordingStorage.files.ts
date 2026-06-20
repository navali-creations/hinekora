import { statSync } from "node:fs";
import { resolve } from "node:path";

import {
  calculateDatabaseSize,
  calculateDiskUsage,
  collectManagedFiles,
  removeEmptyParentDirectories,
} from "~/main/utils/storage-files";

import {
  isManagedRecordingFilePath,
  type RecordingStorageCleanupCandidate,
} from "./RecordingStorage.utils";

function collectRecordingFiles(
  root: string,
): RecordingStorageCleanupCandidate[] {
  return collectManagedFiles(root, isManagedRecordingFilePath);
}

function createProtectedPathSet(paths?: string[]): Set<string> {
  return new Set(
    (paths ?? [])
      .filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      )
      .map((path) => resolve(path)),
  );
}

function createProtectedDirectories(paths?: string[]): string[] {
  return (paths ?? [])
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    )
    .map((path) => resolve(path));
}

function sumExistingFileSizes(paths: Set<string>): number {
  let size = 0;
  for (const path of paths) {
    try {
      const stats = statSync(path);
      if (stats.isFile() && stats.size > 0) {
        size += stats.size;
      }
    } catch {}
  }

  return size;
}

export {
  calculateDatabaseSize,
  calculateDiskUsage,
  collectRecordingFiles,
  createProtectedDirectories,
  createProtectedPathSet,
  removeEmptyParentDirectories,
  sumExistingFileSizes,
};
