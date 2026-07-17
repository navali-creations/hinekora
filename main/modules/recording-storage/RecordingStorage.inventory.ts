import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { isPathInsideOrEqual } from "~/main/utils/storage-files";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import type { ReplayClipStorageEntry } from "../replay-clips/ReplayClips.repository";

const storagePathStatConcurrency = 32;

interface RecordingStoragePathSize {
  path: string;
  size: number;
}

function addReplayClipStoragePaths(
  root: string,
  clip: ReplayClipStorageEntry,
  pathSizes: Map<string, RecordingStoragePathSize>,
  ambiguousPathKeys: Set<string>,
): string[] {
  const paths = getManagedStoragePaths(root, clip);
  for (const path of paths) {
    const key = createStoragePathKey(path);
    pathSizes.set(key, pathSizes.get(key) ?? { path, size: 0 });
  }
  if (paths.length === 1 && clip.sizeBytes > 0) {
    const key = createStoragePathKey(paths[0]!);
    const entry = pathSizes.get(key)!;
    entry.size = Math.max(entry.size, clip.sizeBytes);
  } else {
    for (const path of paths) {
      ambiguousPathKeys.add(createStoragePathKey(path));
    }
  }
  return paths;
}

function getManagedStoragePaths(
  root: string,
  clip: Pick<ReplayClipStorageEntry, "originalObsPath" | "processedClipPath">,
): string[] {
  const paths = new Map<string, string>();
  for (const path of [clip.processedClipPath, clip.originalObsPath]) {
    if (!path) {
      continue;
    }
    const resolvedPath = resolve(path);
    if (isPathInsideOrEqual(root, resolvedPath)) {
      paths.set(createStoragePathKey(resolvedPath), resolvedPath);
    }
  }
  return [...paths.values()];
}

async function hydrateStoragePathSizes(
  paths: Map<string, RecordingStoragePathSize>,
  keys: Iterable<string>,
): Promise<void> {
  const entries = [...keys]
    .map((key) => [key, paths.get(key)] as const)
    .filter(
      (entry): entry is readonly [string, RecordingStoragePathSize] =>
        entry[1] !== undefined,
    );
  for (
    let index = 0;
    index < entries.length;
    index += storagePathStatConcurrency
  ) {
    const batch = entries.slice(index, index + storagePathStatConcurrency);
    await Promise.all(
      batch.map(async ([, entry]) => {
        try {
          const fileStats = await stat(entry.path);
          entry.size = fileStats.isFile() ? fileStats.size : 0;
        } catch {
          entry.size = 0;
        }
      }),
    );
  }
}

function sumPositiveValues<T>(
  values: Iterable<T>,
  getSize: (value: T) => number,
): number {
  let total = 0;
  for (const value of values) {
    total += Math.max(0, getSize(value));
  }
  return total;
}

export type { RecordingStoragePathSize };
export {
  addReplayClipStoragePaths,
  getManagedStoragePaths,
  hydrateStoragePathSizes,
  sumPositiveValues,
};
