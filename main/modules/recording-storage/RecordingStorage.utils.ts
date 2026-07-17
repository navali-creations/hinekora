import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  win32,
} from "node:path";

import { createSafePathLogFields, logWarn } from "~/main/utils/app-log";

import {
  DEFAULT_RECORDING_DIRECTORY_NAME,
  LEGACY_RECORDING_STORAGE_DIRECTORY_NAMES,
  RECORDING_STORAGE_DIRECTORY_NAMES,
} from "./RecordingStorage.constants";

const RECORDING_STORAGE_UTILS_LOG_SCOPE = "recording-storage";
const managedRecordingExtensions = new Set([
  ".flv",
  ".mkv",
  ".mov",
  ".mp4",
  ".webm",
]);
const legacySessionDirectoryPrefix = "Hinekora-";
const legacySessionDirectoryPrefixKey =
  legacySessionDirectoryPrefix.toLowerCase();
const flatManagedRecordingNamePattern =
  /^\d{4}-\d{2}-\d{2}[ _]\d{2}-\d{2}-\d{2}(?:-death-\d+s)?$/i;
const managedMediaDirectoryNames = new Set(
  Object.entries(RECORDING_STORAGE_DIRECTORY_NAMES).flatMap(([kind, name]) =>
    [
      name,
      ...LEGACY_RECORDING_STORAGE_DIRECTORY_NAMES[
        kind as RecordingStorageMediaKind
      ],
    ].map((directoryName) => directoryName.toLowerCase()),
  ),
);

type RecordingStorageMediaKind = keyof typeof RECORDING_STORAGE_DIRECTORY_NAMES;

interface RecordingStorageFileEntry {
  path: string;
  size: number;
  mtimeMs: number;
}

interface RecordingStoragePathMigration {
  from: string;
  to: string;
}

function isManagedRecordingFilePath(root: string, path: string): boolean {
  const relativePath = relative(root, path);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    return false;
  }

  const parts = relativePath.split(/[\\/]+/).filter(Boolean);
  const fileName = parts[parts.length - 1]!;

  const extension = extname(fileName).toLowerCase();
  if (!managedRecordingExtensions.has(extension)) {
    return false;
  }

  if (
    parts
      .slice(0, -1)
      .some((part) =>
        part.toLowerCase().startsWith(legacySessionDirectoryPrefixKey),
      )
  ) {
    return true;
  }

  if (
    parts.length === 2 &&
    managedMediaDirectoryNames.has(parts[0]!.toLowerCase())
  ) {
    return true;
  }

  return (
    parts.length === 1 &&
    flatManagedRecordingNamePattern.test(
      fileName.slice(0, Math.max(0, fileName.length - extension.length)),
    )
  );
}

function resolveRecordingStorageRoot(
  configuredPath: string | null,
  videosPath: string,
): string {
  const root =
    configuredPath ?? join(videosPath, DEFAULT_RECORDING_DIRECTORY_NAME);

  return isCrossPlatformAbsolute(root) ? root : resolve(root);
}

function isCrossPlatformAbsolute(path: string): boolean {
  return isAbsolute(path) || win32.isAbsolute(path);
}

function resolveRecordingStorageMediaDirectory(
  root: string,
  kind: RecordingStorageMediaKind,
): string {
  return join(root, RECORDING_STORAGE_DIRECTORY_NAMES[kind]);
}

function resolveRecordingStorageMediaDirectories(
  root: string,
  kind: RecordingStorageMediaKind,
): string[] {
  return [
    RECORDING_STORAGE_DIRECTORY_NAMES[kind],
    ...LEGACY_RECORDING_STORAGE_DIRECTORY_NAMES[kind],
  ].map((directoryName) => join(root, directoryName));
}

function planLegacyRecordingStorageMediaDirectoryMigrations(
  root: string,
): RecordingStoragePathMigration[] {
  const migrations: RecordingStoragePathMigration[] = [];
  const reservedTargetPaths = new Set<string>();

  for (const [kind, legacyNames] of Object.entries(
    LEGACY_RECORDING_STORAGE_DIRECTORY_NAMES,
  ) as Array<[RecordingStorageMediaKind, readonly string[]]>) {
    const targetDirectory = resolveRecordingStorageMediaDirectory(root, kind);

    for (const legacyName of legacyNames) {
      const legacyDirectory = join(root, legacyName);
      if (!existsSync(legacyDirectory)) {
        continue;
      }

      try {
        if (!statSync(legacyDirectory).isDirectory()) {
          continue;
        }

        if (!existsSync(targetDirectory)) {
          migrations.push({
            from: resolve(legacyDirectory),
            to: resolve(targetDirectory),
          });
          reservedTargetPaths.add(resolve(targetDirectory));
          continue;
        }

        if (!statSync(targetDirectory).isDirectory()) {
          throw new Error("Target path is not a directory");
        }

        for (const entryName of readdirSync(legacyDirectory)) {
          const sourcePath = join(legacyDirectory, entryName);
          const targetPath = resolveAvailablePath(
            join(targetDirectory, entryName),
            reservedTargetPaths,
          );
          migrations.push({
            from: resolve(sourcePath),
            to: resolve(targetPath),
          });
          reservedTargetPaths.add(resolve(targetPath));
        }
      } catch (error) {
        logLegacyRecordingStorageMigrationFailure(
          "Legacy recording media directory migration planning failed",
          error,
          legacyName,
          RECORDING_STORAGE_DIRECTORY_NAMES[kind],
          legacyDirectory,
          targetDirectory,
        );
      }
    }
  }

  return migrations;
}

function applyRecordingStoragePathMigrations(
  migrations: RecordingStoragePathMigration[],
): RecordingStoragePathMigration[] {
  const appliedMigrations: RecordingStoragePathMigration[] = [];

  for (const migration of migrations) {
    const sourcePath = resolve(migration.from);
    const targetPath = resolve(migration.to);

    if (!existsSync(sourcePath)) {
      if (existsSync(targetPath)) {
        appliedMigrations.push({ from: sourcePath, to: targetPath });
        continue;
      }

      logLegacyRecordingStorageMigrationFailure(
        "Legacy recording media directory migration source and target are missing",
        new Error("Source and target path are missing"),
        basename(sourcePath),
        basename(targetPath),
        sourcePath,
        targetPath,
      );
      continue;
    }

    try {
      if (existsSync(targetPath)) {
        throw new Error("Target path already exists");
      }

      mkdirSync(dirname(targetPath), { recursive: true });
      renameSync(sourcePath, targetPath);
      appliedMigrations.push({ from: sourcePath, to: targetPath });
      removeEmptyDirectory(dirname(sourcePath));
    } catch (error) {
      logLegacyRecordingStorageMigrationFailure(
        "Legacy recording media directory migration failed",
        error,
        basename(sourcePath),
        basename(targetPath),
        sourcePath,
        targetPath,
      );
    }
  }

  return appliedMigrations;
}

function resolveAvailablePath(
  path: string,
  reservedPaths: ReadonlySet<string> = new Set(),
): string {
  if (!existsSync(path) && !reservedPaths.has(resolve(path))) {
    return path;
  }

  const parsedPath = parse(path);
  for (let index = 2; index < Number.MAX_SAFE_INTEGER; index += 1) {
    const candidate = join(
      dirname(path),
      `${parsedPath.name} (${index})${parsedPath.ext}`,
    );
    if (!existsSync(candidate) && !reservedPaths.has(resolve(candidate))) {
      return candidate;
    }
  }

  /* v8 ignore next -- exhausting every collision suffix up to MAX_SAFE_INTEGER is not practical. */
  return path;
}

function removeEmptyDirectory(path: string): void {
  try {
    rmdirSync(path);
  } catch {
    // Non-empty or already missing legacy folders are fine to leave in place.
  }
}

function logLegacyRecordingStorageMigrationFailure(
  message: string,
  error: unknown,
  legacyName: string,
  targetName: string,
  legacyPath: string,
  targetPath: string,
): void {
  logWarn(RECORDING_STORAGE_UTILS_LOG_SCOPE, message, {
    errorCode: resolveSafeFilesystemErrorCode(error),
    legacyDirectoryName: legacyName,
    targetDirectoryName: targetName,
    ...createSafePathLogFields(legacyPath, "legacyDirectory"),
    ...createSafePathLogFields(targetPath, "targetDirectory"),
  });
}

/* v8 ignore start -- Node filesystem failures provide stable Error/code shapes; this only sanitizes exotic thrown values. */
function resolveSafeFilesystemErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return error instanceof Error ? error.name : typeof error;
}

/* v8 ignore stop */

export type {
  RecordingStorageFileEntry,
  RecordingStorageMediaKind,
  RecordingStoragePathMigration,
};
export {
  applyRecordingStoragePathMigrations,
  isManagedRecordingFilePath,
  planLegacyRecordingStorageMediaDirectoryMigrations,
  resolveRecordingStorageMediaDirectories,
  resolveRecordingStorageMediaDirectory,
  resolveRecordingStorageRoot,
};
