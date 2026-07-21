import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  cleanupAbandonedEditorExportFiles,
  cleanupEditorClipboardOutputDirectory,
  commitEditorExportOutputPath,
  createEditorClipboardOutputPath,
  createEditorExportOutputPath,
  createEditorExportStagingOutputPath,
  createEditorExportTempOutputPath,
  resolveEditorClipboardOutputDirectory,
  resolveEditorExportOutputDirectory,
  resolveEditorExportStagingRoot,
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
      const stagingOutput = await createEditorExportStagingOutputPath({
        outputPath: firstOutput,
        storageRoot: tempPath,
      });

      expect(firstOutput).toContain(join("Hinekora", "Exports"));
      expect(firstOutput).toMatch(/bad name\.mp4$/);
      expect(secondOutput).toMatch(/bad name \(2\)\.mp4$/);
      expect(clipboardPath).toContain(join("Hinekora", "Editor Clipboard"));
      expect(clipboardPath).toMatch(/Hinekora edit-[\w-]+\.mp4$/);
      expect(extensionOnlyClipboardPath).toMatch(/\.mp4-[\w-]+\.mp4$/);
      expect(tempOutput).toContain(".bad name.hinekora-");
      expect(stagingOutput.directoryPath).toMatch(
        /\.hinekora-editor-exports[\\/]hinekora-export-[\w-]+$/,
      );
      expect(stagingOutput.outputPath).toBe(
        join(stagingOutput.directoryPath, "bad name.mp4"),
      );
    } finally {
      await rm(tempPath, { force: true, recursive: true });
    }
  });

  it("atomically commits a collision-free export destination", async () => {
    const videosPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));

    try {
      const outputDirectory = resolveEditorExportOutputDirectory(videosPath);
      await mkdir(outputDirectory, { recursive: true });
      const firstTemporaryPath = join(outputDirectory, ".first.mp4");
      const secondTemporaryPath = join(outputDirectory, ".second.mp4");
      await writeFile(firstTemporaryPath, "first render");
      await writeFile(secondTemporaryPath, "second render");
      const firstOutput = await commitEditorExportOutputPath({
        fileName: "render.mp4",
        temporaryPath: firstTemporaryPath,
        videosPath,
      });
      const secondOutput = await commitEditorExportOutputPath({
        fileName: "render.mp4",
        temporaryPath: secondTemporaryPath,
        videosPath,
      });

      expect(firstOutput).toMatch(/render\.mp4$/);
      expect(secondOutput).toMatch(/render \(2\)\.mp4$/);
      await expect(readFile(firstOutput, "utf8")).resolves.toBe("first render");
      await expect(readFile(secondOutput, "utf8")).resolves.toBe(
        "second render",
      );
    } finally {
      await rm(videosPath, { force: true, recursive: true });
    }
  });

  it("surfaces export destination commit failures", async () => {
    const videosPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));
    const linkFile = (async () => {
      const error = new Error("access denied") as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    }) as typeof import("node:fs/promises").link;

    try {
      await expect(
        commitEditorExportOutputPath(
          {
            fileName: "render.mp4",
            temporaryPath: join(videosPath, ".render.mp4"),
            videosPath,
          },
          linkFile,
        ),
      ).rejects.toThrow("access denied");
    } finally {
      await rm(videosPath, { force: true, recursive: true });
    }
  });

  it("removes abandoned export jobs from each storage root in bounded batches", async () => {
    const videosPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));
    const recordingStoragePath = await mkdtemp(
      join(tmpdir(), "hinekora-editor-recordings-"),
    );
    const outputDirectory = resolveEditorExportOutputDirectory(videosPath);
    await mkdir(outputDirectory, { recursive: true });
    const stagingRoot = resolveEditorExportStagingRoot(videosPath);
    const recordingStagingRoot =
      resolveEditorExportStagingRoot(recordingStoragePath);
    await mkdir(stagingRoot, { recursive: true });
    await mkdir(recordingStagingRoot, { recursive: true });
    const temporaryNames = Array.from(
      { length: 17 },
      (_, index) =>
        `hinekora-export-00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    const failedName = temporaryNames.at(-1)!;
    const unrelatedNames = ["notes", "hinekora-export-not-a-uuid"];
    for (const name of [...temporaryNames, ...unrelatedNames]) {
      await mkdir(join(stagingRoot, name));
      await writeFile(join(stagingRoot, name, "artifact"), name);
    }
    const recordingTemporaryName =
      "hinekora-export-00000000-0000-4000-8000-000000000099";
    await mkdir(join(recordingStagingRoot, recordingTemporaryName));
    await writeFile(
      join(recordingStagingRoot, recordingTemporaryName, "render.mp4"),
      "temporary",
    );
    const currentStagingOutput = await createEditorExportStagingOutputPath({
      outputPath: join(outputDirectory, "active.mp4"),
      storageRoot: videosPath,
    });
    await writeFile(currentStagingOutput.outputPath, "active");
    await writeFile(join(outputDirectory, "saved.mp4"), "saved");
    const removeFile = (async (path, options) => {
      if (String(path).endsWith(failedName)) {
        throw new Error("locked");
      }
      await rm(path, options);
    }) as typeof rm;

    try {
      await expect(
        cleanupAbandonedEditorExportFiles(
          [videosPath, recordingStoragePath],
          removeFile,
        ),
      ).resolves.toEqual({ failedCount: 1, removedCount: 17 });
      expect((await readdir(stagingRoot)).sort()).toEqual(
        [
          ...unrelatedNames,
          failedName,
          currentStagingOutput.directoryPath.split(/[\\/]/).at(-1)!,
        ].sort(),
      );
      await expect(readdir(recordingStagingRoot)).resolves.toEqual([]);
      await expect(readdir(outputDirectory)).resolves.toEqual(["saved.mp4"]);
    } finally {
      await rm(videosPath, { force: true, recursive: true });
      await rm(recordingStoragePath, { force: true, recursive: true });
    }
  });

  it("ignores a missing abandoned-export directory", async () => {
    const videosPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));

    try {
      await expect(
        cleanupAbandonedEditorExportFiles([videosPath, videosPath]),
      ).resolves.toEqual({ failedCount: 0, removedCount: 0 });
    } finally {
      await rm(videosPath, { force: true, recursive: true });
    }
  });

  it("caps abandoned-export cleanup work per run", async () => {
    const videosPath = await mkdtemp(join(tmpdir(), "hinekora-editor-files-"));
    const stagingRoot = resolveEditorExportStagingRoot(videosPath);
    await mkdir(stagingRoot, { recursive: true });
    for (let index = 0; index < 70; index += 1) {
      const uuidTail = String(index).padStart(12, "0");
      const stagingDirectory = join(
        stagingRoot,
        `hinekora-export-00000000-0000-4000-8000-${uuidTail}`,
      );
      await mkdir(stagingDirectory);
      await writeFile(join(stagingDirectory, "render.mp4"), "temporary");
    }

    try {
      await expect(
        cleanupAbandonedEditorExportFiles([videosPath]),
      ).resolves.toEqual({ failedCount: 0, removedCount: 64 });
      await expect(readdir(stagingRoot)).resolves.toHaveLength(6);
      await expect(
        cleanupAbandonedEditorExportFiles([videosPath]),
      ).resolves.toEqual({ failedCount: 0, removedCount: 6 });
      await expect(readdir(stagingRoot)).resolves.toEqual([]);
    } finally {
      await rm(videosPath, { force: true, recursive: true });
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
