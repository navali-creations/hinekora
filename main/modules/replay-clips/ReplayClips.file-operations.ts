import { access, copyFile, rename, rm } from "node:fs/promises";
import { dirname, parse, resolve } from "node:path";

import { createEditorExportTempOutputPath } from "~/main/modules/editor/Editor.files";
import { normalizeMediaFileStem } from "~/main/utils/media-file-name";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

interface CommitReplayClipFileUpdateInput<T> {
  finalPath: string;
  onCleanupError?: (error: unknown, path: string) => void;
  persist: (finalPath: string) => Promise<T> | T;
  render?: (outputPath: string) => Promise<void>;
  sourcePath: string;
}

interface CommitReplayClipFileUpdateResult<T> {
  committedValue: T;
  obsoleteSourcePath: string | null;
}

async function commitReplayClipFileUpdate<T>(
  input: CommitReplayClipFileUpdateInput<T>,
): Promise<CommitReplayClipFileUpdateResult<T>> {
  const samePath = areReplayClipPathsEqual(input.sourcePath, input.finalPath);
  if (!input.render && samePath) {
    const committedValue = await input.persist(input.sourcePath);
    return { committedValue, obsoleteSourcePath: null };
  }

  const stagedPath = input.render
    ? createEditorExportTempOutputPath(input.finalPath)
    : null;
  if (stagedPath) {
    try {
      await input.render?.(stagedPath);
    } catch (error) {
      await cleanupReplayClipFile(stagedPath, input.onCleanupError);
      throw error;
    }
  }

  if (samePath && stagedPath) {
    const committedValue = await replaceReplayClipFileInPlace({
      ...(input.onCleanupError ? { onCleanupError: input.onCleanupError } : {}),
      persist: input.persist,
      sourcePath: input.sourcePath,
      stagedPath,
    });
    return { committedValue, obsoleteSourcePath: null };
  }

  if (stagedPath) {
    const committedValue = await installRenderedReplayClip({
      finalPath: input.finalPath,
      ...(input.onCleanupError ? { onCleanupError: input.onCleanupError } : {}),
      persist: input.persist,
      stagedPath,
    });
    return { committedValue, obsoleteSourcePath: input.sourcePath };
  }

  const committedValue = await renameReplayClipWithRollback({
    finalPath: input.finalPath,
    persist: input.persist,
    sourcePath: input.sourcePath,
  });
  return { committedValue, obsoleteSourcePath: null };
}

async function replaceReplayClipFileInPlace<T>(input: {
  onCleanupError?: (error: unknown, path: string) => void;
  persist: (finalPath: string) => Promise<T> | T;
  sourcePath: string;
  stagedPath: string;
}): Promise<T> {
  const backupPath = createEditorExportTempOutputPath(input.sourcePath);
  let backupMode: "copy" | "rename" = "rename";
  try {
    await rename(input.sourcePath, backupPath);
  } catch {
    backupMode = "copy";
    await copyFile(input.sourcePath, backupPath);
  }

  try {
    if (backupMode === "rename") {
      await rename(input.stagedPath, input.sourcePath);
    } else {
      await copyFile(input.stagedPath, input.sourcePath);
      await cleanupReplayClipFile(input.stagedPath, input.onCleanupError);
    }
    const committedValue = await input.persist(input.sourcePath);
    await cleanupReplayClipFile(backupPath, input.onCleanupError);
    return committedValue;
  } catch (error) {
    return restoreReplayClipBackup({
      backupMode,
      backupPath,
      cause: error,
      sourcePath: input.sourcePath,
    });
  }
}

async function installRenderedReplayClip<T>(input: {
  finalPath: string;
  onCleanupError?: (error: unknown, path: string) => void;
  persist: (finalPath: string) => Promise<T> | T;
  stagedPath: string;
}): Promise<T> {
  try {
    await rename(input.stagedPath, input.finalPath);
  } catch (error) {
    await cleanupReplayClipFile(input.stagedPath, input.onCleanupError);
    throw error;
  }
  try {
    return await input.persist(input.finalPath);
  } catch (error) {
    return rollbackReplayClipFile(
      error,
      () => rm(input.finalPath, { force: true }),
      "Could not remove the uncommitted replay clip output",
    );
  }
}

async function renameReplayClipWithRollback<T>(input: {
  finalPath: string;
  persist: (finalPath: string) => Promise<T> | T;
  sourcePath: string;
}): Promise<T> {
  await rename(input.sourcePath, input.finalPath);
  try {
    return await input.persist(input.finalPath);
  } catch (error) {
    return rollbackReplayClipFile(
      error,
      () => rename(input.finalPath, input.sourcePath),
      "Could not restore the original replay clip name",
    );
  }
}

async function restoreReplayClipBackup(input: {
  backupMode: "copy" | "rename";
  backupPath: string;
  cause: unknown;
  sourcePath: string;
}): Promise<never> {
  return rollbackReplayClipFile(
    input.cause,
    async () => {
      if (input.backupMode === "rename") {
        await rm(input.sourcePath, { force: true });
        await rename(input.backupPath, input.sourcePath);
        return;
      }

      await copyFile(input.backupPath, input.sourcePath);
      await rm(input.backupPath, { force: true });
    },
    "Could not restore the original replay clip file",
  );
}

async function rollbackReplayClipFile(
  cause: unknown,
  rollback: () => Promise<void>,
  message: string,
): Promise<never> {
  try {
    await rollback();
  } catch (rollbackError) {
    throw new AggregateError([cause, rollbackError], message);
  }

  throw cause;
}

async function cleanupReplayClipFile(
  path: string,
  onCleanupError?: (error: unknown, path: string) => void,
): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch (error) {
    onCleanupError?.(error, path);
  }
}

function areReplayClipPathsEqual(left: string, right: string): boolean {
  return createStoragePathKey(left) === createStoragePathKey(right);
}

async function resolveReplayClipRenameTarget(
  sourcePath: string,
  name: string | null,
): Promise<string | null> {
  const normalizedName = normalizeMediaFileStem(name);
  if (!normalizedName) {
    return null;
  }

  const parsedSource = parse(sourcePath);
  const extension = parsedSource.ext || ".mp4";
  const targetDirectory = dirname(sourcePath);
  const currentPath = resolve(sourcePath);
  let candidate = resolve(targetDirectory, `${normalizedName}${extension}`);
  if (areReplayClipPathsEqual(currentPath, candidate)) {
    return null;
  }

  let suffix = 2;
  while (await replayClipPathExists(candidate)) {
    candidate = resolve(
      targetDirectory,
      `${normalizedName} (${suffix})${extension}`,
    );
    if (areReplayClipPathsEqual(currentPath, candidate)) {
      return null;
    }
    suffix += 1;
  }

  return candidate;
}

async function replayClipPathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export {
  areReplayClipPathsEqual,
  commitReplayClipFileUpdate,
  resolveReplayClipRenameTarget,
};
