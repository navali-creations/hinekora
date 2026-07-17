import {
  type Dirent,
  existsSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  statfsSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

interface ManagedFileStat {
  path: string;
  size: number;
  mtimeMs: number;
}

function calculateDatabaseSize(databasePath: string): number {
  return resolveDatabaseFilePaths(databasePath).reduce(
    (sum, path) => sum + getExistingFileSize(path),
    0,
  );
}

function calculateDiskUsage(path: string): {
  freeBytes: number;
  totalBytes: number;
} {
  try {
    const stats = statfsSync(path);

    return {
      freeBytes: stats.bavail * stats.bsize,
      totalBytes: stats.blocks * stats.bsize,
    };
  } catch {
    return { freeBytes: 0, totalBytes: 0 };
  }
}

function collectManagedFiles(
  root: string,
  isManagedFilePath: (root: string, path: string) => boolean,
): ManagedFileStat[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: ManagedFileStat[] = [];
  const pendingDirectories = [root];
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
      if (!entry.isFile() || !isManagedFilePath(root, entryPath)) {
        continue;
      }

      try {
        const stats = statSync(entryPath);
        if (!stats.isFile() || stats.size <= 0) {
          continue;
        }

        files.push({
          path: resolve(entryPath),
          size: stats.size,
          mtimeMs: stats.mtimeMs,
        });
      } catch {}
    }
  }

  return files;
}

function getExistingFileSize(path: string): number {
  try {
    const stats = statSync(path);
    return stats.isFile() && stats.size > 0 ? stats.size : 0;
  } catch {
    return 0;
  }
}

function removeEmptyParentDirectories(path: string, root: string): void {
  let currentDirectory = dirname(path);
  while (
    currentDirectory !== root &&
    isPathInsideOrEqual(root, currentDirectory)
  ) {
    try {
      rmdirSync(currentDirectory);
    } catch {
      return;
    }

    currentDirectory = dirname(currentDirectory);
  }
}

function resolveDatabaseFilePaths(databasePath: string): string[] {
  if (databasePath === ":memory:") {
    return [];
  }

  return [databasePath, `${databasePath}-wal`, `${databasePath}-shm`].map(
    (path) => resolve(path),
  );
}

function isPathInsideOrEqual(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);

  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function isRealPathInsideOrEqual(parent: string, child: string): boolean {
  if (!isPathInsideOrEqual(resolve(parent), resolve(child))) {
    return false;
  }

  try {
    return isPathInsideOrEqual(realpathSync(parent), realpathSync(child));
  } catch {
    return false;
  }
}

export type { ManagedFileStat };
export {
  calculateDatabaseSize,
  calculateDiskUsage,
  collectManagedFiles,
  getExistingFileSize,
  isPathInsideOrEqual,
  isRealPathInsideOrEqual,
  removeEmptyParentDirectories,
  resolveDatabaseFilePaths,
};
