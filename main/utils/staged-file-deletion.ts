import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { isPathInsideOrEqual } from "./storage-files";

const stagedDeletionDirectoryName = ".hinekora-retention-trash";
const stagedDeletionCommitMarkerName = "committed";
const stagedDeletionManifestName = "manifest.json";
const stagedDeletionManifestVersion = 1;
const stagedDeletionStatConcurrency = 16;
const maxManifestBytes = 32 * 1024 * 1024;
const maxManifestFiles = 100_000;
const activeDeletionOperations = new Set<string>();

interface FileDeletionTarget {
  path: string;
  size: number;
}

interface StagedFileDeletion extends FileDeletionTarget {
  stagedPath: string;
}

interface FinalizedStagedFileDeletions {
  deletedPaths: string[];
  failed: StagedFileDeletion[];
  freedBytes: number;
}

interface StagedFileDeletionRecoveryResult {
  failed: StagedFileDeletion[];
  finalizedPaths: string[];
  hasMore: boolean;
  restoredPaths: string[];
}

interface StagedFileDeletionManifest {
  files: Array<{ path: string; size: number; stagedName: string }>;
  version: 1;
}

interface StagedFileDeletionFinalizeOptions {
  completeOperation?: (operationId: string) => Promise<void> | void;
}

interface StagedFileDeletionRecoveryOptions {
  completeOperation?: (operationId: string) => Promise<void> | void;
  isOperationCommitted?: (operationId: string) => boolean | Promise<boolean>;
  maxFiles?: number;
}

async function stageFilesForDeletion(
  root: string,
  targets: FileDeletionTarget[],
): Promise<StagedFileDeletion[]> {
  if (targets.length === 0) {
    return [];
  }
  if (targets.length > maxManifestFiles) {
    throw new Error("Too many files were selected for one deletion operation");
  }

  const resolvedRoot = resolve(root);
  const trashDirectory = await resolveSafeTrashDirectory(resolvedRoot, true);
  if (!trashDirectory) {
    throw new Error("Recording storage trash directory is unavailable");
  }
  const operationDirectory = join(trashDirectory, randomUUID());
  await mkdir(operationDirectory);
  activeDeletionOperations.add(operationDirectory);

  const stagedFiles = targets.map((target) => ({
    path: resolve(target.path),
    size: Math.max(0, target.size),
    stagedPath: join(operationDirectory, randomUUID()),
  }));

  try {
    for (const file of stagedFiles) {
      await assertSafeDeletionTarget(resolvedRoot, file.path);
    }
    await writeDeletionManifest(operationDirectory, stagedFiles);

    const movedFiles: StagedFileDeletion[] = [];
    try {
      for (const file of stagedFiles) {
        await rename(file.path, file.stagedPath);
        movedFiles.push(file);
      }
    } catch (error) {
      /* v8 ignore next -- The zero-move branch requires the first file to disappear after realpath validation but before rename; rollback is covered independently. */
      if (movedFiles.length > 0) {
        await rollbackStagedFileDeletions(movedFiles);
      } else {
        await releaseDeletionOperation(operationDirectory, false);
      }
      throw error;
    }
  } catch (error) {
    if (activeDeletionOperations.has(operationDirectory)) {
      await releaseDeletionOperation(operationDirectory, true);
    }
    throw error;
  }

  return stagedFiles;
}

async function rollbackStagedFileDeletions(
  stagedFiles: StagedFileDeletion[],
): Promise<void> {
  const operationDirectory = getOperationDirectory(stagedFiles);
  const rollbackErrors: unknown[] = [];
  for (const file of [...stagedFiles].reverse()) {
    try {
      await rename(file.stagedPath, file.path);
    } catch (error) {
      rollbackErrors.push(error);
    }
  }

  if (rollbackErrors.length > 0) {
    await releaseDeletionOperation(operationDirectory, true);
    throw new AggregateError(
      rollbackErrors,
      "Failed to restore staged storage files",
    );
  }

  await releaseDeletionOperation(operationDirectory, false);
}

async function finalizeStagedFileDeletions(
  stagedFiles: StagedFileDeletion[],
  options: StagedFileDeletionFinalizeOptions = {},
): Promise<FinalizedStagedFileDeletions> {
  const operationDirectory = getOperationDirectory(stagedFiles);
  const operationId = getStagedFileDeletionOperationId(stagedFiles);
  const deletedPaths: string[] = [];
  const failed: StagedFileDeletion[] = [];
  let freedBytes = 0;

  try {
    await markStagedFileDeletionsCommitted(stagedFiles);
  } catch {
    await releaseDeletionOperation(operationDirectory, true);
    return { deletedPaths, failed: [...stagedFiles], freedBytes };
  }

  let operationCompletionFailed = false;
  if (operationId && options.completeOperation) {
    try {
      await options.completeOperation(operationId);
    } catch {
      operationCompletionFailed = true;
    }
  }

  for (const file of stagedFiles) {
    try {
      await unlink(file.stagedPath);
      deletedPaths.push(file.path);
      freedBytes += file.size;
    } catch {
      failed.push(file);
    }
  }

  await releaseDeletionOperation(
    operationDirectory,
    failed.length > 0 || operationCompletionFailed,
  );
  return { deletedPaths, failed, freedBytes };
}

async function recoverStagedFileDeletions(
  root: string,
  options: StagedFileDeletionRecoveryOptions = {},
): Promise<StagedFileDeletionRecoveryResult> {
  const resolvedRoot = resolve(root);
  const trashDirectory = await resolveSafeTrashDirectory(resolvedRoot, false);
  const result: StagedFileDeletionRecoveryResult = {
    failed: [],
    finalizedPaths: [],
    hasMore: false,
    restoredPaths: [],
  };
  if (!trashDirectory) {
    return result;
  }

  const maxFiles = Math.max(0, options.maxFiles ?? 100);
  const operationDirectories =
    await listInactiveOperationDirectories(trashDirectory);
  let processedFiles = 0;
  for (const operationDirectory of operationDirectories) {
    if (processedFiles >= maxFiles) {
      result.hasMore = true;
      break;
    }
    const stagedFiles = await readDeletionManifest(
      resolvedRoot,
      operationDirectory,
    );
    if (!stagedFiles) {
      continue;
    }
    const operationId = basename(operationDirectory);
    let isCommitted = await hasCommitMarker(operationDirectory);
    if (!isCommitted && options.isOperationCommitted) {
      try {
        isCommitted = await options.isOperationCommitted(operationId);
      } catch {
        result.failed.push(...stagedFiles);
        continue;
      }
    }

    for (const file of stagedFiles) {
      if (processedFiles >= maxFiles) {
        result.hasMore = true;
        break;
      }
      const stagedFileState = await getStagedFileState(file.stagedPath);
      if (stagedFileState === "missing") {
        continue;
      }
      processedFiles += 1;
      if (stagedFileState === "unsafe") {
        result.failed.push(file);
        continue;
      }

      try {
        if (isCommitted) {
          await unlink(file.stagedPath);
          result.finalizedPaths.push(file.path);
        } else {
          await restoreStagedFile(resolvedRoot, file);
          result.restoredPaths.push(file.path);
        }
      } catch {
        result.failed.push(file);
      }
    }

    if (!(await operationHasStagedFiles(operationDirectory))) {
      if (options.completeOperation) {
        try {
          await options.completeOperation(operationId);
        } catch {
          continue;
        }
      }
      await removeDeletionJournal(operationDirectory);
      await removeEmptyDirectory(operationDirectory);
    }
  }

  await removeEmptyDirectory(trashDirectory);
  return result;
}

async function getStagedFileDeletionTrashSize(root: string): Promise<number> {
  const trashDirectory = await resolveSafeTrashDirectory(root, false);
  if (!trashDirectory) {
    return 0;
  }

  const files = await listTrashDataFiles(trashDirectory, {
    includeActive: true,
    maxItems: Number.POSITIVE_INFINITY,
  });
  let total = 0;
  for (
    let index = 0;
    index < files.length;
    index += stagedDeletionStatConcurrency
  ) {
    const sizes = await Promise.all(
      files
        .slice(index, index + stagedDeletionStatConcurrency)
        .map(async (path) => {
          try {
            const fileStats = await stat(path);
            /* v8 ignore next -- readdir supplied a file entry; false requires a type-changing filesystem race. */
            return fileStats.isFile() ? fileStats.size : 0;
          } catch {
            /* v8 ignore next -- Requires a trash entry to disappear between readdir and stat. */
            return 0;
          }
        }),
    );
    total += sizes.reduce((sum, size) => sum + size, 0);
  }

  return total;
}

async function writeDeletionManifest(
  operationDirectory: string,
  files: StagedFileDeletion[],
): Promise<void> {
  const manifest: StagedFileDeletionManifest = {
    files: files.map((file) => ({
      path: file.path,
      size: file.size,
      stagedName: basename(file.stagedPath),
    })),
    version: stagedDeletionManifestVersion,
  };
  if (!isManifest(manifest)) {
    throw new Error("Staged deletion manifest is invalid");
  }
  const serializedManifest = JSON.stringify(manifest);
  /* v8 ignore next -- The file-count and platform path-length caps keep generated manifests below this corruption guard. */
  if (Buffer.byteLength(serializedManifest, "utf8") > maxManifestBytes) {
    throw new Error("Staged deletion manifest is too large");
  }
  const temporaryPath = join(operationDirectory, `${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, serializedManifest, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(
      temporaryPath,
      join(operationDirectory, stagedDeletionManifestName),
    );
  } finally {
    try {
      await unlink(temporaryPath);
    } catch {}
  }
}

async function markStagedFileDeletionsCommitted(
  stagedFiles: StagedFileDeletion[],
): Promise<void> {
  const operationDirectory = getOperationDirectory(stagedFiles);
  if (!operationDirectory) {
    return;
  }
  const markerPath = join(operationDirectory, stagedDeletionCommitMarkerName);
  try {
    await writeFile(markerPath, "", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "EEXIST" ||
      !(await hasCommitMarker(operationDirectory))
    ) {
      throw error;
    }
  }
}

function getStagedFileDeletionOperationId(
  stagedFiles: StagedFileDeletion[],
): string | null {
  const operationDirectory = getOperationDirectory(stagedFiles);

  return operationDirectory ? basename(operationDirectory) : null;
}

async function hasCommitMarker(operationDirectory: string): Promise<boolean> {
  try {
    const markerStats = await lstat(
      join(operationDirectory, stagedDeletionCommitMarkerName),
    );
    return (
      markerStats.isFile() &&
      !markerStats.isSymbolicLink() &&
      markerStats.size === 0
    );
  } catch {
    return false;
  }
}

async function readDeletionManifest(
  root: string,
  operationDirectory: string,
): Promise<StagedFileDeletion[] | null> {
  const manifestPath = join(operationDirectory, stagedDeletionManifestName);
  try {
    const manifestStats = await lstat(manifestPath);
    if (
      !manifestStats.isFile() ||
      manifestStats.isSymbolicLink() ||
      manifestStats.size > maxManifestBytes
    ) {
      return null;
    }
    const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!isManifest(parsed)) {
      return null;
    }

    const files: StagedFileDeletion[] = [];
    for (const file of parsed.files) {
      const originalPath = resolve(file.path);
      if (
        !isPathInsideOrEqual(root, originalPath) ||
        originalPath === root ||
        !isStagedFileName(file.stagedName)
      ) {
        return null;
      }
      files.push({
        path: originalPath,
        size: file.size,
        stagedPath: join(operationDirectory, file.stagedName),
      });
    }
    return files;
  } catch {
    return null;
  }
}

function isManifest(value: unknown): value is StagedFileDeletionManifest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const manifest = value as Partial<StagedFileDeletionManifest>;
  return (
    manifest.version === stagedDeletionManifestVersion &&
    Array.isArray(manifest.files) &&
    manifest.files.length <= maxManifestFiles &&
    manifest.files.every(
      (file) =>
        file !== null &&
        typeof file === "object" &&
        typeof file.path === "string" &&
        file.path.length > 0 &&
        file.path.length <= 32_768 &&
        typeof file.stagedName === "string" &&
        file.stagedName.length > 0 &&
        file.stagedName.length <= 256 &&
        typeof file.size === "number" &&
        Number.isFinite(file.size) &&
        file.size >= 0,
    )
  );
}

function isStagedFileName(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function restoreStagedFile(
  root: string,
  file: StagedFileDeletion,
): Promise<void> {
  if (await pathExists(file.path)) {
    throw new Error("Cannot restore a staged file over an existing path");
  }
  const parent = dirname(file.path);
  await mkdir(parent, { recursive: true });
  const [realRoot, realParent] = await Promise.all([
    realpath(root),
    realpath(parent),
  ]);
  if (!isPathInsideOrEqual(realRoot, realParent)) {
    throw new Error(
      "Staged file restore path resolves outside managed storage",
    );
  }
  await rename(file.stagedPath, file.path);
}

async function assertSafeDeletionTarget(
  root: string,
  target: string,
): Promise<void> {
  if (!isPathInsideOrEqual(root, target)) {
    throw new Error("Deletion target is outside managed storage");
  }
  if (root === target) {
    throw new Error("Deletion target must be a file inside managed storage");
  }

  const [realRoot, realTarget] = await Promise.all([
    realpath(root),
    realpath(target),
  ]);
  if (!isPathInsideOrEqual(realRoot, realTarget)) {
    throw new Error("Deletion target resolves outside managed storage");
  }
}

async function resolveSafeTrashDirectory(
  root: string,
  create: boolean,
): Promise<string | null> {
  const resolvedRoot = resolve(root);
  if (create) {
    await mkdir(resolvedRoot, { recursive: true });
  }

  let realRoot: string;
  try {
    realRoot = await realpath(resolvedRoot);
  } catch {
    return null;
  }

  const trashDirectory = resolve(resolvedRoot, stagedDeletionDirectoryName);
  try {
    const trashStats = await lstat(trashDirectory);
    if (!trashStats.isDirectory() || trashStats.isSymbolicLink()) {
      return null;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !create) {
      return null;
    }
    await mkdir(trashDirectory);
  }

  const realTrashDirectory = await realpath(trashDirectory);
  /* v8 ignore next -- A non-symlink child resolved directly under realRoot cannot resolve outside it. */
  return isPathInsideOrEqual(realRoot, realTrashDirectory)
    ? trashDirectory
    : null;
}

async function listInactiveOperationDirectories(
  trashDirectory: string,
): Promise<string[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(trashDirectory, { withFileTypes: true });
  } catch {
    /* v8 ignore next -- Requires the validated trash directory to disappear before enumeration. */
    return [];
  }
  const realTrashDirectory = await realpath(trashDirectory);
  const operationDirectories: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue;
    }
    const operationDirectory = join(trashDirectory, entry.name);
    if (activeDeletionOperations.has(operationDirectory)) {
      continue;
    }
    try {
      const [operationStats, realOperationDirectory] = await Promise.all([
        lstat(operationDirectory),
        realpath(operationDirectory),
      ]);
      /* v8 ignore next -- Directory entries are revalidated immediately; false requires a type/link race. */
      if (
        operationStats.isDirectory() &&
        !operationStats.isSymbolicLink() &&
        isPathInsideOrEqual(realTrashDirectory, realOperationDirectory)
      ) {
        operationDirectories.push(operationDirectory);
      }
    } catch {}
  }
  return operationDirectories;
}

async function listTrashDataFiles(
  trashDirectory: string,
  options: { includeActive: boolean; maxItems: number },
): Promise<string[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(trashDirectory, { withFileTypes: true });
  } catch {
    /* v8 ignore next -- Requires the validated trash directory to disappear before enumeration. */
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    /* v8 ignore next -- The only caller requests Number.POSITIVE_INFINITY items. */
    if (files.length >= options.maxItems) {
      break;
    }

    const entryPath = join(trashDirectory, entry.name);
    if (entry.isFile()) {
      files.push(entryPath);
      continue;
    }
    /* v8 ignore next -- Trash contents are created as files or operation directories; other types are ignored defensively. */
    if (
      !entry.isDirectory() ||
      (!options.includeActive && activeDeletionOperations.has(entryPath))
    ) {
      continue;
    }

    let operationEntries: Dirent<string>[];
    try {
      operationEntries = await readdir(entryPath, { withFileTypes: true });
    } catch {
      /* v8 ignore next -- Requires an operation directory to disappear during enumeration. */
      continue;
    }
    for (const operationEntry of operationEntries) {
      /* v8 ignore next -- The only caller requests Number.POSITIVE_INFINITY items. */
      if (files.length >= options.maxItems) {
        break;
      }
      if (
        operationEntry.isFile() &&
        operationEntry.name !== stagedDeletionManifestName &&
        operationEntry.name !== stagedDeletionCommitMarkerName &&
        !operationEntry.name.endsWith(".tmp")
      ) {
        files.push(join(entryPath, operationEntry.name));
      }
    }
  }

  return files;
}

async function operationHasStagedFiles(
  operationDirectory: string,
): Promise<boolean> {
  try {
    const entries = await readdir(operationDirectory, { withFileTypes: true });
    return entries.some(
      (entry) =>
        entry.name !== stagedDeletionManifestName &&
        entry.name !== stagedDeletionCommitMarkerName &&
        !entry.name.endsWith(".tmp"),
    );
  } catch {
    /* v8 ignore next -- Requires an operation directory to disappear after its manifest was read. */
    return false;
  }
}

function getOperationDirectory(
  stagedFiles: StagedFileDeletion[],
): string | undefined {
  return stagedFiles[0] ? dirname(stagedFiles[0].stagedPath) : undefined;
}

async function releaseDeletionOperation(
  operationDirectory: string | undefined,
  preserveManifest: boolean,
): Promise<void> {
  if (!operationDirectory) {
    return;
  }

  activeDeletionOperations.delete(operationDirectory);
  if (!preserveManifest) {
    await removeDeletionJournal(operationDirectory);
  }
  await removeEmptyDirectory(operationDirectory);
  await removeEmptyDirectory(dirname(operationDirectory));
}

async function removeDeletionJournal(
  operationDirectory: string,
): Promise<void> {
  await Promise.all(
    [stagedDeletionManifestName, stagedDeletionCommitMarkerName].map(
      async (name) => {
        try {
          await unlink(join(operationDirectory, name));
        } catch {}
      },
    ),
  );
}

async function removeEmptyDirectory(path: string): Promise<void> {
  try {
    await rmdir(path);
  } catch {}
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function getStagedFileState(
  path: string,
): Promise<"missing" | "regular" | "unsafe"> {
  try {
    const fileStats = await lstat(path);
    return fileStats.isFile() && !fileStats.isSymbolicLink()
      ? "regular"
      : "unsafe";
  } catch (error) {
    /* v8 ignore next -- Missing paths are covered; other lstat failures depend on host permissions/device errors. */
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? "missing"
      : "unsafe";
  }
}

function resetStagedFileDeletionStateForTests(): void {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("Staged deletion state reset is only available in tests");
  }
  activeDeletionOperations.clear();
}

export type { StagedFileDeletion };
export {
  finalizeStagedFileDeletions,
  getStagedFileDeletionOperationId,
  getStagedFileDeletionTrashSize,
  markStagedFileDeletionsCommitted,
  recoverStagedFileDeletions,
  resetStagedFileDeletionStateForTests,
  rollbackStagedFileDeletions,
  stageFilesForDeletion,
};
