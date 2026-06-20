import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  cleanupEditorClipboardOutputDirectory,
  createEditorClipboardOutputPath,
  createEditorExportOutputPath,
  createEditorExportTempOutputPath,
  resolveEditorClipboardOutputDirectory,
} from "../Editor.files";

describe("editor clipboard files", () => {
  it("creates sanitized export, temp, and clipboard paths", async () => {
    const tempPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));

    try {
      const firstOutput = await createEditorExportOutputPath({
        fileName: 'bad<>:"|?*\u0000 name.mov',
        videosPath: tempPath,
      });
      await writeFile(firstOutput, "existing");
      const secondOutput = await createEditorExportOutputPath({
        fileName: 'bad<>:"|?*\u0000 name.mov',
        videosPath: tempPath,
      });
      const clipboardPath = await createEditorClipboardOutputPath({
        fileName: "   ",
        tempPath,
      });
      const extensionOnlyClipboardPath = await createEditorClipboardOutputPath({
        fileName: ".mp4",
        tempPath,
      });
      const tempOutput = createEditorExportTempOutputPath(firstOutput);

      expect(firstOutput).toContain(join("Hinekora", "Exports"));
      expect(firstOutput).toMatch(/bad name\.mp4$/);
      expect(secondOutput).toMatch(/bad name \(2\)\.mp4$/);
      expect(clipboardPath).toContain(join("Hinekora", "Editor Clipboard"));
      expect(clipboardPath).toMatch(/Hinekora edit-[\w-]+\.mp4$/);
      expect(extensionOnlyClipboardPath).toMatch(/\.mp4-[\w-]+\.mp4$/);
      expect(tempOutput).toContain(".bad name.hinekora-");
    } finally {
      await rm(tempPath, { force: true, recursive: true });
    }
  });

  it("removes stale clipboard renders while preserving the active file", async () => {
    const tempPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));
    const outputDirectory = resolveEditorClipboardOutputDirectory(tempPath);
    await mkdir(outputDirectory, { recursive: true });
    const stalePath = join(outputDirectory, "stale.mp4");
    const activePath = join(outputDirectory, "active.mp4");
    const unrelatedPath = join(outputDirectory, "notes.txt");
    await writeFile(stalePath, "stale");
    await writeFile(activePath, "active");
    await writeFile(unrelatedPath, "notes");
    const oldDate = new Date(Date.now() - 10_000);
    await utimes(stalePath, oldDate, oldDate);
    await utimes(activePath, oldDate, oldDate);

    try {
      await cleanupEditorClipboardOutputDirectory({
        maxAgeMs: 1_000,
        protectedPath: activePath,
        tempPath,
      });

      expect((await readdir(outputDirectory)).sort()).toEqual([
        "active.mp4",
        "notes.txt",
      ]);
    } finally {
      await rm(tempPath, { force: true, recursive: true });
    }
  });

  it("caps recent clipboard renders", async () => {
    const tempPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));
    const outputDirectory = resolveEditorClipboardOutputDirectory(tempPath);
    await mkdir(outputDirectory, { recursive: true });

    try {
      for (let index = 0; index < 5; index += 1) {
        const path = join(outputDirectory, `render-${index}.mp4`);
        await writeFile(path, String(index));
        const date = new Date(Date.now() + index * 1_000);
        await utimes(path, date, date);
      }

      await cleanupEditorClipboardOutputDirectory({
        maxFiles: 2,
        tempPath,
      });

      expect((await readdir(outputDirectory)).sort()).toEqual([
        "render-3.mp4",
        "render-4.mp4",
      ]);
    } finally {
      await rm(tempPath, { force: true, recursive: true });
    }
  });

  it("ignores missing clipboard cleanup directories and protected recent files", async () => {
    const tempPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));

    try {
      await expect(
        cleanupEditorClipboardOutputDirectory({ tempPath }),
      ).resolves.toBeUndefined();

      const outputDirectory = resolveEditorClipboardOutputDirectory(tempPath);
      await mkdir(outputDirectory, { recursive: true });
      const protectedPath = join(outputDirectory, "protected.mp4");
      const removablePath = join(outputDirectory, "removable.mp4");
      await writeFile(protectedPath, "protected");
      await writeFile(removablePath, "removable");

      await cleanupEditorClipboardOutputDirectory({
        maxAgeMs: 0,
        maxFiles: 1,
        protectedPath,
        tempPath,
      });

      expect((await readdir(outputDirectory)).sort()).toEqual([
        "protected.mp4",
      ]);
    } finally {
      await rm(tempPath, { force: true, recursive: true });
    }
  });
});
