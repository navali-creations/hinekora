import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import {
  DEFAULT_RECORDING_DIRECTORY_NAME,
  RECORDING_STORAGE_DIRECTORY_NAMES,
} from "./RecordingStorage.constants";

const managedRecordingExtensions = new Set([
  ".flv",
  ".mkv",
  ".mov",
  ".mp4",
  ".webm",
]);
const legacySessionDirectoryPrefix = "Hinekora-";
const flatManagedRecordingNamePattern =
  /^\d{4}-\d{2}-\d{2}[ _]\d{2}-\d{2}-\d{2}(?:-death-\d+s)?$/i;
const managedMediaDirectoryNames = new Set(
  Object.values(RECORDING_STORAGE_DIRECTORY_NAMES).map((name) =>
    name.toLowerCase(),
  ),
);

type RecordingStorageMediaKind = keyof typeof RECORDING_STORAGE_DIRECTORY_NAMES;

interface RecordingStorageCleanupCandidate {
  path: string;
  size: number;
  mtimeMs: number;
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
      .some((part) => part.startsWith(legacySessionDirectoryPrefix))
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
    flatManagedRecordingNamePattern.test(basename(fileName, extension))
  );
}

function resolveRecordingStorageRoot(
  configuredPath: string | null,
  videosPath: string,
): string {
  return resolve(
    configuredPath ?? join(videosPath, DEFAULT_RECORDING_DIRECTORY_NAME),
  );
}

function resolveRecordingStorageMediaDirectory(
  root: string,
  kind: RecordingStorageMediaKind,
): string {
  return join(root, RECORDING_STORAGE_DIRECTORY_NAMES[kind]);
}

export type { RecordingStorageCleanupCandidate, RecordingStorageMediaKind };
export {
  isManagedRecordingFilePath,
  resolveRecordingStorageMediaDirectory,
  resolveRecordingStorageRoot,
};
