import { symlinkSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scanEditorExportFiles } from "../EditorExport.inventory";

let root: string;

beforeEach(async () => {
  root = join(tmpdir(), `hinekora-export-inventory-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("scanEditorExportFiles", () => {
  it("scans top-level MP4 files with filesystem metadata", async () => {
    await Promise.all([
      writeFile(join(root, "video.mp4"), "video"),
      writeFile(join(root, "notes.txt"), "notes"),
      mkdir(join(root, "nested.mp4")),
    ]);
    const files: Array<{ path: string; sizeBytes: number }> = [];

    const result = await scanEditorExportFiles({
      onFiles: async (batch) => {
        files.push(...batch);
      },
      roots: [root, `${root}.`, root],
    });

    expect(result).toMatchObject({
      fileCount: 1,
      inspectedEntryCount: 3,
      isTruncated: false,
    });
    expect(files).toEqual([
      expect.objectContaining({ path: join(root, "video.mp4"), sizeBytes: 5 }),
    ]);
  });

  it("scans physical directories once when roots include an alias", async () => {
    const target = join(root, "target");
    const alias = join(root, "alias");
    await mkdir(target);
    await writeFile(join(target, "video.mp4"), "video");
    symlinkSync(
      target,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    const files: string[] = [];

    const result = await scanEditorExportFiles({
      onFiles: (batch) => {
        files.push(...batch.map((file) => file.path));
      },
      roots: [target, alias],
    });

    expect(result).toMatchObject({ fileCount: 1, isTruncated: false });
    expect(files).toEqual([join(target, "video.mp4")]);
  });

  it("uses safe metadata defaults when the filesystem omits optional fields", async () => {
    const path = join(root, "video.mp4");
    await writeFile(path, "video");
    const files: Array<{
      deviceId: number;
      modifiedAt: Date;
      sizeBytes: number;
    }> = [];

    await scanEditorExportFiles({
      onFiles: (batch) => {
        files.push(...batch);
      },
      roots: [root],
      statFile: async () => ({
        isFile: () => true,
        size: -1,
      }),
    });

    expect(files).toEqual([
      {
        deviceId: 0,
        inode: 0,
        modifiedAt: new Date(0),
        path,
        sizeBytes: 0,
      },
    ]);
  });

  it("reports truncation only after observing an extra matching file", async () => {
    await Promise.all([
      writeFile(join(root, "one.mp4"), "1"),
      writeFile(join(root, "two.mp4"), "2"),
    ]);
    const exactFiles: string[] = [];
    const exact = await scanEditorExportFiles({
      maxFiles: 2,
      onFiles: (files) => {
        exactFiles.push(...files.map((file) => file.path));
      },
      roots: [root],
    });
    const limitedFiles: string[] = [];
    const limited = await scanEditorExportFiles({
      maxFiles: 1,
      onFiles: (files) => {
        limitedFiles.push(...files.map((file) => file.path));
      },
      roots: [root],
    });

    expect(exact).toMatchObject({ fileCount: 2, isTruncated: false });
    expect(exactFiles).toHaveLength(2);
    expect(limited).toMatchObject({ fileCount: 1, isTruncated: true });
    expect(limitedFiles).toHaveLength(1);
  });

  it("bounds inspected entries and full stat batches", async () => {
    await Promise.all([
      writeFile(join(root, "a.mp4"), "a"),
      writeFile(join(root, "b.mp4"), "b"),
      writeFile(join(root, "c.mp4"), "c"),
    ]);
    await expect(
      scanEditorExportFiles({
        batchSize: 2,
        maxFiles: 1,
        onFiles: vi.fn(),
        roots: [root],
      }),
    ).resolves.toMatchObject({ fileCount: 1, isTruncated: true });
    const entryLimitedFiles: string[] = [];
    await expect(
      scanEditorExportFiles({
        batchSize: 2,
        maxEntries: 2,
        onFiles: (files) => {
          entryLimitedFiles.push(...files.map((file) => file.path));
        },
        roots: [root],
      }),
    ).resolves.toMatchObject({ inspectedEntryCount: 3, isTruncated: true });
    expect(entryLimitedFiles).toHaveLength(2);
  });

  it("supports cancellation and missing roots", async () => {
    await writeFile(join(root, "video.mp4"), "video");
    await expect(
      scanEditorExportFiles({
        onFiles: vi.fn(),
        roots: [join(root, "missing")],
      }),
    ).resolves.toMatchObject({ fileCount: 0, isTruncated: false });
    await expect(
      scanEditorExportFiles({
        onFiles: vi.fn(),
        roots: [root],
        shouldAbort: () => true,
      }),
    ).resolves.toBeNull();
  });

  it("cancels before stat work, during a capped flush, and after a full batch", async () => {
    await writeFile(join(root, "video.mp4"), "video");
    const abortOnCheck = (targetCheck: number) => {
      let checkCount = 0;
      return () => {
        checkCount += 1;
        return checkCount === targetCheck;
      };
    };

    await expect(
      scanEditorExportFiles({
        onFiles: vi.fn(),
        roots: [root],
        shouldAbort: abortOnCheck(2),
      }),
    ).resolves.toBeNull();
    await expect(
      scanEditorExportFiles({
        maxEntries: 0,
        onFiles: vi.fn(),
        roots: [root],
        shouldAbort: abortOnCheck(3),
      }),
    ).resolves.toBeNull();
    await expect(
      scanEditorExportFiles({
        batchSize: 1,
        onFiles: vi.fn(),
        roots: [root],
        shouldAbort: abortOnCheck(3),
      }),
    ).resolves.toBeNull();
  });
});
