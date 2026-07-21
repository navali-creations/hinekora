import { randomUUID } from "node:crypto";
import {
  access,
  link,
  mkdir,
  opendir,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { basename, join, parse } from "node:path";

import { normalizeMediaFileStem } from "~/main/utils/media-file-name";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

interface CreateEditorExportOutputPathInput {
  fileName: string;
  videosPath: string;
}

interface CreateEditorClipboardOutputPathInput {
  fileName: string;
  tempPath: string;
}

interface CleanupEditorClipboardOutputDirectoryInput {
  maxAgeMs?: number;
  maxFiles?: number;
  protectedPath?: string | null;
  tempPath: string;
}

interface CommitEditorExportOutputPathInput {
  fileName: string;
  temporaryPath: string;
  videosPath: string;
}

interface CreateEditorExportStagingOutputPathInput {
  outputPath: string;
  storageRoot: string;
}

interface EditorExportStagingOutputPath {
  directoryPath: string;
  outputPath: string;
}

interface CleanupAbandonedEditorExportFilesResult {
  failedCount: number;
  removedCount: number;
}

const editorClipboardDirectoryParts = ["Hinekora", "Editor Clipboard"];
const editorClipboardMaxAgeMs = 12 * 60 * 60 * 1_000;
const editorClipboardMaxFiles = 4;
const editorExportCleanupBatchSize = 16;
const editorExportCleanupMaxEntries = 256;
const editorExportCleanupMaxFiles = 64;
const editorExportCleanupMaxStorageRoots = 2;
const editorExportStagingDirectoryName = ".hinekora-editor-exports";
const editorExportSessionId = randomUUID();
const editorTemporaryFileUuidPattern =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const editorExportStagingEntryPattern = new RegExp(
  `^hinekora-export-(?:${editorTemporaryFileUuidPattern}-)?${editorTemporaryFileUuidPattern}$`,
  "i",
);
const currentEditorExportStagingEntryPrefix = `hinekora-export-${editorExportSessionId}-`;

class EditorTemporaryFileCleanupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorTemporaryFileCleanupError";
  }
}

async function createEditorExportOutputPath(
  input: CreateEditorExportOutputPathInput,
): Promise<string> {
  const candidates = await createEditorExportOutputPathCandidates(input);
  let candidate = candidates.next();

  while (await fileExists(candidate)) {
    candidate = candidates.next();
  }

  return candidate;
}

async function commitEditorExportOutputPath(
  input: CommitEditorExportOutputPathInput,
  linkFile: typeof link = link,
): Promise<string> {
  const candidates = await createEditorExportOutputPathCandidates(input);

  while (true) {
    const candidate = candidates.next();
    try {
      await linkFile(input.temporaryPath, candidate);

      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }
}

async function cleanupAbandonedEditorExportFiles(
  storageRoots: readonly string[],
  removeFile: typeof rm = rm,
): Promise<CleanupAbandonedEditorExportFilesResult> {
  let failedCount = 0;
  let removedCount = 0;
  const uniqueStorageRoots = Array.from(
    new Map(
      storageRoots.map((storageRoot) => [
        createStoragePathKey(storageRoot),
        storageRoot,
      ]),
    ).values(),
  ).slice(0, editorExportCleanupMaxStorageRoots);

  for (const storageRoot of uniqueStorageRoots) {
    const stagingRoot = resolveEditorExportStagingRoot(storageRoot);
    if (!(await fileExists(stagingRoot))) {
      continue;
    }

    const abandonedPaths: string[] = [];
    const directory = await opendir(stagingRoot);
    let inspectedEntries = 0;
    for await (const entry of directory) {
      inspectedEntries += 1;
      if (
        entry.isDirectory() &&
        editorExportStagingEntryPattern.test(entry.name) &&
        !entry.name.startsWith(currentEditorExportStagingEntryPrefix)
      ) {
        abandonedPaths.push(join(stagingRoot, entry.name));
      }
      if (
        inspectedEntries >= editorExportCleanupMaxEntries ||
        abandonedPaths.length >= editorExportCleanupMaxFiles
      ) {
        break;
      }
    }

    for (
      let startIndex = 0;
      startIndex < abandonedPaths.length;
      startIndex += editorExportCleanupBatchSize
    ) {
      const results = await Promise.allSettled(
        abandonedPaths
          .slice(startIndex, startIndex + editorExportCleanupBatchSize)
          .map((path) => removeFile(path, { force: true, recursive: true })),
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          removedCount += 1;
        } else {
          failedCount += 1;
        }
      }
    }
  }

  return { failedCount, removedCount };
}

async function createEditorClipboardOutputPath(
  input: CreateEditorClipboardOutputPathInput,
): Promise<string> {
  const outputDirectory = resolveEditorClipboardOutputDirectory(input.tempPath);
  await mkdir(outputDirectory, { recursive: true });

  const normalizedFileName = normalizeEditorExportFileName(input.fileName);
  const parsed = parse(normalizedFileName);

  return join(outputDirectory, `${parsed.name}-${randomUUID()}${parsed.ext}`);
}

async function cleanupEditorClipboardOutputDirectory(
  input: CleanupEditorClipboardOutputDirectoryInput,
): Promise<void> {
  const outputDirectory = resolveEditorClipboardOutputDirectory(input.tempPath);
  if (!(await fileExists(outputDirectory))) {
    return;
  }

  const entries = await readdir(outputDirectory, { withFileTypes: true });
  const now = Date.now();
  const maxAgeMs = input.maxAgeMs ?? editorClipboardMaxAgeMs;
  const maxFiles = input.maxFiles ?? editorClipboardMaxFiles;
  const protectedPath = input.protectedPath ?? null;
  const files = (
    await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() && parse(entry.name).ext.toLowerCase() === ".mp4",
        )
        .map(async (entry) => {
          const path = join(outputDirectory, entry.name);
          const fileStat = await stat(path).catch(
            /* v8 ignore next -- Race where file disappears between readdir and stat. */
            () => null,
          );

          /* v8 ignore next -- Race where file disappears between readdir and stat. */
          return fileStat ? { mtimeMs: fileStat.mtimeMs, path } : null;
        }),
    )
  )
    .filter((file): file is { mtimeMs: number; path: string } => file !== null)
    .sort((first, second) => second.mtimeMs - first.mtimeMs);
  const protectedIndex = protectedPath
    ? files.findIndex((file) => file.path === protectedPath)
    : -1;
  const keptRecentPaths = new Set(
    files
      .filter((file) => file.path !== protectedPath)
      .slice(0, Math.max(0, maxFiles - (protectedIndex === -1 ? 0 : 1)))
      .map((file) => file.path),
  );

  await Promise.all(
    files.map(async (file) => {
      if (file.path === protectedPath) {
        return;
      }

      const isStale = now - file.mtimeMs > maxAgeMs;
      const exceedsLimit = !keptRecentPaths.has(file.path);
      if (isStale || exceedsLimit) {
        await rm(file.path, { force: true });
      }
    }),
  );
}

function resolveEditorClipboardOutputDirectory(tempPath: string): string {
  return join(tempPath, ...editorClipboardDirectoryParts);
}

function resolveEditorExportOutputDirectory(videosPath: string): string {
  return join(videosPath, "Hinekora", "Exports");
}

function resolveEditorExportStagingRoot(storageRoot: string): string {
  return join(storageRoot, editorExportStagingDirectoryName);
}

async function createEditorExportStagingOutputPath(
  input: CreateEditorExportStagingOutputPathInput,
): Promise<EditorExportStagingOutputPath> {
  const stagingRoot = resolveEditorExportStagingRoot(input.storageRoot);
  const directoryPath = join(
    stagingRoot,
    `${currentEditorExportStagingEntryPrefix}${randomUUID()}`,
  );
  await mkdir(directoryPath, { recursive: true });

  return {
    directoryPath,
    outputPath: join(directoryPath, basename(input.outputPath)),
  };
}

function createEditorExportTempOutputPath(outputPath: string): string {
  const parsed = parse(outputPath);

  return join(
    parsed.dir,
    `.${parsed.name}.hinekora-${randomUUID()}${parsed.ext}`,
  );
}

function normalizeEditorExportFileName(fileName: string): string {
  const safeName = normalizeMediaFileStem(fileName, {
    fallback: "Hinekora edit",
  })!;

  return `${safeName}.mp4`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createEditorExportOutputPathCandidates(input: {
  fileName: string;
  videosPath: string;
}): Promise<{ next: () => string }> {
  const outputDirectory = resolveEditorExportOutputDirectory(input.videosPath);
  await mkdir(outputDirectory, { recursive: true });
  const normalizedFileName = normalizeEditorExportFileName(input.fileName);
  const parsed = parse(normalizedFileName);
  let suffix = 1;

  return {
    next: () => {
      const candidate =
        suffix === 1
          ? normalizedFileName
          : `${parsed.name} (${suffix})${parsed.ext}`;
      suffix += 1;

      return join(outputDirectory, candidate);
    },
  };
}

export {
  cleanupAbandonedEditorExportFiles,
  cleanupEditorClipboardOutputDirectory,
  commitEditorExportOutputPath,
  createEditorClipboardOutputPath,
  createEditorExportOutputPath,
  createEditorExportStagingOutputPath,
  createEditorExportTempOutputPath,
  EditorTemporaryFileCleanupError,
  resolveEditorClipboardOutputDirectory,
  resolveEditorExportOutputDirectory,
  resolveEditorExportStagingRoot,
};
