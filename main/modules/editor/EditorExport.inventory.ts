import { opendir, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { resolveStoragePathAliases } from "~/main/utils/storage-files";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

const defaultBatchSize = 64;
const defaultMaxEntries = 250_000;
const defaultMaxFiles = 250_000;

interface EditorExportFile {
  deviceId: number;
  inode: number;
  modifiedAt: Date;
  path: string;
  sizeBytes: number;
}

interface EditorExportInventoryResult {
  fileCount: number;
  inspectedEntryCount: number;
  isTruncated: boolean;
}

interface EditorExportFileStats {
  dev?: number;
  ino?: number;
  isFile: () => boolean;
  mtime?: Date;
  size: number;
}

interface ScanEditorExportFilesOptions {
  batchSize?: number;
  maxEntries?: number;
  maxFiles?: number;
  onFiles: (files: EditorExportFile[]) => void | Promise<void>;
  openDirectory?: typeof opendir;
  roots: readonly string[];
  shouldAbort?: () => boolean;
  statFile?: (path: string) => Promise<EditorExportFileStats>;
}

async function scanEditorExportFiles(
  options: ScanEditorExportFilesOptions,
): Promise<EditorExportInventoryResult | null> {
  const openDirectory = options.openDirectory ?? opendir;
  const statFile = options.statFile ?? stat;
  const shouldAbort = options.shouldAbort ?? (() => false);
  const batchSize = Math.max(1, options.batchSize ?? defaultBatchSize);
  const maxEntries = Math.max(0, options.maxEntries ?? defaultMaxEntries);
  const maxFiles = Math.max(0, options.maxFiles ?? defaultMaxFiles);
  let fileCount = 0;
  let inspectedEntryCount = 0;

  const appendPaths = async (paths: string[]): Promise<boolean> => {
    const files = (
      await Promise.all(
        paths.map(async (path): Promise<EditorExportFile | null> => {
          try {
            const stats = await statFile(path);
            return stats.isFile()
              ? {
                  deviceId: stats.dev ?? 0,
                  inode: stats.ino ?? 0,
                  modifiedAt: stats.mtime ?? new Date(0),
                  path,
                  sizeBytes: Math.max(0, stats.size),
                }
              : null;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              return null;
            }
            throw error;
          }
        }),
      )
    ).filter((file): file is EditorExportFile => file !== null);
    const accepted: EditorExportFile[] = [];
    let isTruncated = false;
    for (const file of files) {
      if (fileCount >= maxFiles) {
        isTruncated = true;
        break;
      }
      fileCount += 1;
      accepted.push(file);
    }
    if (accepted.length > 0) {
      await options.onFiles(accepted);
    }
    return isTruncated;
  };

  const roots = resolveEditorExportInventoryRoots(options.roots);
  for (const root of roots) {
    if (shouldAbort()) {
      return null;
    }
    let directory: Awaited<ReturnType<typeof opendir>>;
    try {
      directory = await openDirectory(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }

    let pendingPaths: string[] = [];
    for await (const entry of directory) {
      if (shouldAbort()) {
        return null;
      }
      inspectedEntryCount += 1;
      if (inspectedEntryCount > maxEntries) {
        await appendPaths(pendingPaths);
        if (shouldAbort()) {
          return null;
        }
        return { fileCount, inspectedEntryCount, isTruncated: true };
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".mp4")) {
        continue;
      }
      const path = resolve(directory.path, entry.name);
      pendingPaths.push(path);
      if (pendingPaths.length < batchSize) {
        continue;
      }
      const isFileLimitReached = await appendPaths(pendingPaths);
      if (shouldAbort()) {
        return null;
      }
      if (isFileLimitReached) {
        return { fileCount, inspectedEntryCount, isTruncated: true };
      }
      pendingPaths = [];
    }
    const isFileLimitReached = await appendPaths(pendingPaths);
    if (shouldAbort()) {
      return null;
    }
    if (isFileLimitReached) {
      return { fileCount, inspectedEntryCount, isTruncated: true };
    }
  }

  return shouldAbort()
    ? null
    : { fileCount, inspectedEntryCount, isTruncated: false };
}

function resolveEditorExportInventoryRoots(roots: readonly string[]): string[] {
  return Array.from(
    new Map(
      roots.map((root) => {
        const resolvedRoot = resolve(root);
        const canonicalRoot = resolveStoragePathAliases(resolvedRoot).at(-1)!;
        return [createStoragePathKey(canonicalRoot), canonicalRoot] as const;
      }),
    ).values(),
  );
}

export type {
  EditorExportFile,
  EditorExportInventoryResult,
  ScanEditorExportFilesOptions,
};
export {
  defaultBatchSize as defaultEditorExportInventoryBatchSize,
  defaultMaxEntries as defaultEditorExportInventoryMaxEntries,
  defaultMaxFiles as defaultEditorExportInventoryMaxFiles,
  resolveEditorExportInventoryRoots,
  scanEditorExportFiles,
};
