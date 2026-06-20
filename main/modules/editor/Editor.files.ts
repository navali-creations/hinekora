import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, join, parse } from "node:path";

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

const editorClipboardDirectoryParts = ["Hinekora", "Editor Clipboard"];
const editorClipboardMaxAgeMs = 12 * 60 * 60 * 1_000;
const editorClipboardMaxFiles = 4;

async function createEditorExportOutputPath(
  input: CreateEditorExportOutputPathInput,
): Promise<string> {
  const outputDirectory = join(input.videosPath, "Hinekora", "Exports");
  await mkdir(outputDirectory, { recursive: true });

  const normalizedFileName = normalizeEditorExportFileName(input.fileName);
  const parsed = parse(normalizedFileName);
  let candidate = join(outputDirectory, normalizedFileName);
  let suffix = 2;

  while (existsSync(candidate)) {
    candidate = join(
      outputDirectory,
      `${parsed.name} (${suffix})${parsed.ext}`,
    );
    suffix += 1;
  }

  return candidate;
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
  if (!existsSync(outputDirectory)) {
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

function createEditorExportTempOutputPath(outputPath: string): string {
  const parsed = parse(outputPath);

  return join(
    parsed.dir,
    `.${parsed.name}.hinekora-${randomUUID()}${parsed.ext}`,
  );
}

function normalizeEditorExportFileName(fileName: string): string {
  const parsed = parse(basename(fileName));
  const name = Array.from(
    /* v8 ignore next -- basename/parse fallback branches are defensive for malformed names. */
    (parsed.name || parsed.base || "Hinekora edit").replace(
      /[<>:"/\\|?*]/g,
      " ",
    ),
  )
    .map((character) => (character.charCodeAt(0) < 32 ? " " : character))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const safeName = name.length > 0 ? name : "Hinekora edit";

  return `${safeName.slice(0, 120)}.mp4`;
}

export {
  cleanupEditorClipboardOutputDirectory,
  createEditorClipboardOutputPath,
  createEditorExportOutputPath,
  createEditorExportTempOutputPath,
  resolveEditorClipboardOutputDirectory,
};
