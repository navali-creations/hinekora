import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultEditorExportInventoryBatchSize,
  defaultEditorExportInventoryMaxEntries,
  defaultEditorExportInventoryMaxFiles,
} from "../EditorExport.inventory";
import { EditorExportInventoryService } from "../EditorExportInventory.service";

const roots: string[] = [];

afterEach(async () => {
  EditorExportInventoryService.resetForTests();
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("EditorExportInventoryService", () => {
  it("coalesces, caches, expires, and invalidates inventory scans", async () => {
    const root = join(
      tmpdir(),
      `hinekora-export-inventory-service-${crypto.randomUUID()}`,
    );
    roots.push(root);
    await mkdir(root);
    await writeFile(join(root, "saved.mp4"), "video");
    const service = EditorExportInventoryService.getInstance();
    expect(EditorExportInventoryService.getInstance()).toBe(service);
    const firstFiles = vi.fn();
    const secondFiles = vi.fn();

    const first = service.scan({ onFiles: firstFiles, roots: [root] });
    const second = service.scan({
      onFiles: secondFiles,
      roots: [root],
      shouldAbort: () => true,
    });
    await expect(first).resolves.toMatchObject({ fileCount: 1 });
    await expect(second).resolves.toBeNull();
    expect(firstFiles).toHaveBeenCalledOnce();
    expect(secondFiles).not.toHaveBeenCalled();

    const cachedFiles = vi.fn();
    await service.scan({ onFiles: cachedFiles, roots: [root] });
    expect(cachedFiles).toHaveBeenCalledOnce();

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5_001);
    await expect(
      service.scan({ onFiles: vi.fn(), roots: [root] }),
    ).resolves.toMatchObject({ fileCount: 1 });

    service.invalidate();
    await expect(
      service.scan({ onFiles: vi.fn(), roots: [root] }),
    ).resolves.toMatchObject({ fileCount: 1 });
  });

  it("honors explicit scan options, custom filesystem access, and aborts", async () => {
    const root = join(
      tmpdir(),
      `hinekora-export-inventory-options-${crypto.randomUUID()}`,
    );
    roots.push(root);
    await mkdir(root);
    const path = join(root, "saved.mp4");
    await writeFile(path, "video");
    const service = new EditorExportInventoryService();

    await expect(
      service.scan({
        batchSize: 1,
        maxEntries: 1,
        maxFiles: 1,
        onFiles: vi.fn(),
        roots: [root],
      }),
    ).resolves.toMatchObject({ fileCount: 1 });
    await expect(
      service.scan({
        onFiles: vi.fn(),
        roots: [root],
        statFile: stat,
      }),
    ).resolves.toMatchObject({ fileCount: 1 });
    await expect(
      service.scan({
        onFiles: vi.fn(),
        roots: [root],
        shouldAbort: () => true,
      }),
    ).resolves.toBeNull();
  });

  it("normalizes default cache keys and replays cached files in bounded batches", async () => {
    const root = join(
      tmpdir(),
      `hinekora-export-inventory-batches-${crypto.randomUUID()}`,
    );
    roots.push(root);
    await mkdir(root);
    await Promise.all(
      ["a.mp4", "b.mp4", "c.mp4"].map((name) =>
        writeFile(join(root, name), "video"),
      ),
    );
    const service = new EditorExportInventoryService();
    const firstFiles = vi.fn();

    await expect(
      service.scan({
        batchSize: 1,
        onFiles: firstFiles,
        roots: [root],
      }),
    ).resolves.toMatchObject({ fileCount: 3 });
    expect(firstFiles).toHaveBeenCalledTimes(3);

    const cachedFiles = vi.fn();
    await expect(
      service.scan({
        batchSize: 1,
        maxEntries: defaultEditorExportInventoryMaxEntries,
        maxFiles: defaultEditorExportInventoryMaxFiles,
        onFiles: cachedFiles,
        roots: [root],
      }),
    ).resolves.toMatchObject({ fileCount: 3 });
    expect(cachedFiles).toHaveBeenCalledTimes(3);

    const defaultKeyFiles = vi.fn();
    await service.scan({ onFiles: defaultKeyFiles, roots: [root] });
    const explicitDefaultKeyFiles = vi.fn();
    await service.scan({
      batchSize: defaultEditorExportInventoryBatchSize,
      maxEntries: defaultEditorExportInventoryMaxEntries,
      maxFiles: defaultEditorExportInventoryMaxFiles,
      onFiles: explicitDefaultKeyFiles,
      roots: [root],
    });
    expect(defaultKeyFiles).toHaveBeenCalledOnce();
    expect(explicitDefaultKeyFiles).toHaveBeenCalledOnce();

    let abortCachedReplay = false;
    await expect(
      service.scan({
        batchSize: 1,
        onFiles: () => {
          abortCachedReplay = true;
        },
        roots: [root],
        shouldAbort: () => abortCachedReplay,
      }),
    ).resolves.toBeNull();
  });

  it("aborts a newly scanned inventory while replaying its batches", async () => {
    const root = join(
      tmpdir(),
      `hinekora-export-inventory-replay-abort-${crypto.randomUUID()}`,
    );
    roots.push(root);
    await mkdir(root);
    await Promise.all(
      ["a.mp4", "b.mp4"].map((name) => writeFile(join(root, name), "video")),
    );
    const service = new EditorExportInventoryService();
    let shouldAbort = false;

    await expect(
      service.scan({
        batchSize: 1,
        onFiles: () => {
          shouldAbort = true;
        },
        roots: [root],
        shouldAbort: () => shouldAbort,
      }),
    ).resolves.toBeNull();
  });

  it("discards a scan invalidated while it is running", async () => {
    const root = join(
      tmpdir(),
      `hinekora-export-inventory-invalidated-${crypto.randomUUID()}`,
    );
    roots.push(root);
    await mkdir(root);
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        writeFile(join(root, `${index}.mp4`), "video"),
      ),
    );
    const service = new EditorExportInventoryService();
    const scan = service.scan({ onFiles: vi.fn(), roots: [root] });
    service.invalidate();

    await expect(scan).resolves.toBeNull();
  });
});
