import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isWindowsOS } from "~/main/utils/platform";

import {
  createRecordingStorageInventory,
  selectRecordingStorageCleanupCandidates,
} from "./RecordingStorage.retention";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "hinekora-retention-"));
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("recording storage retention", () => {
  it("counts protected media before excluding it from deletion", async () => {
    const protectedRecordingPath = join(root, "protected.mkv");
    const clipPath = join(root, "clip.mp4");
    const inventory = await createRecordingStorageInventory({
      clips: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "clip-1",
          originalObsPath: null,
          processedClipPath: clipPath,
          sizeBytes: 20,
        },
      ],
      recordings: [{ mtimeMs: 2, path: protectedRecordingPath, size: 100 }],
      root,
    });

    const selection = selectRecordingStorageCleanupCandidates({
      inventory,
      limitBytes: 110,
      options: { protectedPaths: [protectedRecordingPath] },
    });

    expect(inventory.usageBytes).toBe(120);
    expect(selection.files).toEqual([
      expect.objectContaining({ clipIds: ["clip-1"], kind: "clip", size: 20 }),
    ]);
  });

  it("groups shared paths using host casing semantics and does not double-count recordings", async () => {
    const sharedPath = join(root, "Shared.mp4");
    const sharedPathAlias = isWindowsOS()
      ? sharedPath.toUpperCase()
      : sharedPath;
    const inventory = await createRecordingStorageInventory({
      clips: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "clip-1",
          originalObsPath: null,
          processedClipPath: sharedPath,
          sizeBytes: 40,
        },
        {
          createdAt: "2026-01-02T00:00:00.000Z",
          id: "clip-2",
          originalObsPath: sharedPathAlias,
          processedClipPath: null,
          sizeBytes: 40,
        },
      ],
      recordings: [{ mtimeMs: 1, path: sharedPathAlias, size: 40 }],
      root,
    });

    expect(inventory.clipsSizeBytes).toBe(40);
    expect(inventory.recordingsSizeBytes).toBe(0);
    expect(inventory.clipGroups).toEqual([
      expect.objectContaining({
        clipIds: expect.arrayContaining(["clip-1", "clip-2"]),
        size: 40,
      }),
    ]);
  });

  it("uses physical sizes for clips that own distinct source and processed files", async () => {
    const originalPath = join(root, "original.mkv");
    const processedPath = join(root, "processed.mp4");
    await Promise.all([
      writeFile(originalPath, "old"),
      writeFile(processedPath, "new-file"),
    ]);

    const inventory = await createRecordingStorageInventory({
      clips: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "clip-1",
          originalObsPath: originalPath,
          processedClipPath: processedPath,
          sizeBytes: 999,
        },
      ],
      recordings: [],
      root,
    });

    expect(inventory.clipsSizeBytes).toBe(11);
    expect(inventory.clipGroups[0]).toEqual(
      expect.objectContaining({ size: 11 }),
    );
  });

  it("does not re-union clip groups already connected by another shared path", async () => {
    const firstPath = join(root, "first.mp4");
    const secondPath = join(root, "second.mp4");
    const inventory = await createRecordingStorageInventory({
      clips: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "clip-1",
          originalObsPath: firstPath,
          processedClipPath: secondPath,
          sizeBytes: 2,
        },
        {
          createdAt: "2026-01-02T00:00:00.000Z",
          id: "clip-2",
          originalObsPath: firstPath,
          processedClipPath: secondPath,
          sizeBytes: 2,
        },
      ],
      recordings: [],
      root,
    });

    expect(inventory.clipGroups).toHaveLength(1);
    expect(inventory.clipGroups[0]?.clipIds).toEqual(["clip-1", "clip-2"]);
  });

  it("uses the newest clip timestamp for a shared-file group", async () => {
    const sharedPath = join(root, "shared.mp4");
    const independentPath = join(root, "independent.mkv");
    const inventory = await createRecordingStorageInventory({
      clips: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "old-clip",
          originalObsPath: null,
          processedClipPath: sharedPath,
          sizeBytes: 10,
        },
        {
          createdAt: "2026-03-01T00:00:00.000Z",
          id: "recent-clip",
          originalObsPath: sharedPath,
          processedClipPath: null,
          sizeBytes: 10,
        },
      ],
      recordings: [
        {
          mtimeMs: Date.parse("2026-02-01T00:00:00.000Z"),
          path: independentPath,
          size: 10,
        },
      ],
      root,
    });

    const selection = selectRecordingStorageCleanupCandidates({
      inventory,
      limitBytes: 1,
    });

    expect(selection.files[0]).toEqual(
      expect.objectContaining({ kind: "recording", path: independentPath }),
    );
    expect(selection.files[1]).toEqual(
      expect.objectContaining({
        clipIds: expect.arrayContaining(["old-clip", "recent-clip"]),
        kind: "clip",
      }),
    );
  });

  it("chunks shared clip groups that exceed the hard row cap", async () => {
    const sharedPath = join(root, "shared.mp4");
    const inventory = await createRecordingStorageInventory({
      clips: Array.from({ length: 101 }, (_, index) => ({
        createdAt: "2026-01-01T00:00:00.000Z",
        id: `clip-${index}`,
        originalObsPath: null,
        processedClipPath: sharedPath,
        sizeBytes: 1,
      })),
      recordings: [{ mtimeMs: 2, path: join(root, "recording.mkv"), size: 10 }],
      root,
    });

    const selection = selectRecordingStorageCleanupCandidates({
      inventory,
      limitBytes: 1,
    });

    expect(selection.files).toEqual([
      expect.objectContaining({ kind: "recording" }),
      expect.objectContaining({
        clipIds: expect.arrayContaining(["clip-0", "clip-98"]),
        kind: "clip",
        size: 0,
      }),
    ]);
    expect(selection.files[1]?.kind === "clip").toBe(true);
    if (selection.files[1]?.kind === "clip") {
      expect(selection.files[1].clipIds).toHaveLength(99);
    }
    expect(selection.hasMoreCandidates).toBe(true);
  });

  it("reads a zero-sized single clip path from disk", async () => {
    const clipPath = join(root, "clip.mp4");
    await writeFile(clipPath, "physical-size");

    const inventory = await createRecordingStorageInventory({
      clips: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "clip-1",
          originalObsPath: null,
          processedClipPath: clipPath,
          sizeBytes: 0,
        },
      ],
      recordings: [],
      root,
    });

    expect(inventory.clipsSizeBytes).toBe(13);
    expect(inventory.clipGroups[0]).toEqual(
      expect.objectContaining({ size: 13 }),
    );
  });

  it("bounds each cleanup pass to one hundred independent items", async () => {
    const inventory = await createRecordingStorageInventory({
      clips: [],
      recordings: Array.from({ length: 101 }, (_, index) => ({
        mtimeMs: index,
        path: join(root, `${index}.mkv`),
        size: 1,
      })),
      root,
    });

    const selection = selectRecordingStorageCleanupCandidates({
      inventory,
      limitBytes: 1,
    });

    expect(selection.files).toHaveLength(100);
    expect(selection.hasMoreCandidates).toBe(true);
  });

  it("returns no candidates when cleanup is disabled or usage is within the limit", async () => {
    const inventory = await createRecordingStorageInventory({
      clips: [],
      recordings: [{ mtimeMs: 1, path: join(root, "recording.mkv"), size: 10 }],
      root,
    });

    expect(
      selectRecordingStorageCleanupCandidates({ inventory, limitBytes: 0 }),
    ).toEqual({
      files: [],
      hasMoreCandidates: false,
      targetUsageBytes: 0,
      usageBytes: 10,
    });
    expect(
      selectRecordingStorageCleanupCandidates({ inventory, limitBytes: 10 }),
    ).toEqual({
      files: [],
      hasMoreCandidates: false,
      targetUsageBytes: 9,
      usageBytes: 10,
    });
  });

  it("protects every recording and clip beneath an active directory", async () => {
    const activeDirectory = join(root, "active-session");
    const inventory = await createRecordingStorageInventory({
      clips: [
        {
          createdAt: "invalid timestamp",
          id: "clip-1",
          originalObsPath: null,
          processedClipPath: join(activeDirectory, "clip.mp4"),
          sizeBytes: 10,
        },
      ],
      recordings: [
        {
          mtimeMs: 1,
          path: join(activeDirectory, "recording.mkv"),
          size: 10,
        },
      ],
      root,
    });

    expect(
      selectRecordingStorageCleanupCandidates({
        inventory,
        limitBytes: 1,
        options: { protectedDirectories: [activeDirectory] },
      }).files,
    ).toEqual([]);
  });

  it("yields while building large inventories and merges already-connected clip groups", async () => {
    const sharedPath = join(root, "shared.mp4");
    const clips = Array.from({ length: 501 }, (_, index) => ({
      createdAt: index === 0 ? "invalid timestamp" : "2026-01-01T00:00:00.000Z",
      id: `clip-${index}`,
      originalObsPath: index < 3 ? sharedPath : null,
      processedClipPath:
        index < 3 ? sharedPath : join(root, `independent-${index}.mp4`),
      sizeBytes: 1,
    }));

    const inventory = await createRecordingStorageInventory({
      clips,
      recordings: [],
      root,
    });

    expect(inventory.clipGroups).toHaveLength(499);
    expect(inventory.clipGroups[0]?.clipIds).toEqual([
      "clip-0",
      "clip-1",
      "clip-2",
    ]);
  });

  it("yields even when a large imported clip list contains no managed paths", async () => {
    const inventory = await createRecordingStorageInventory({
      clips: Array.from({ length: 501 }, (_, index) => ({
        createdAt: "2026-01-01T00:00:00.000Z",
        id: `clip-${index}`,
        originalObsPath: null,
        processedClipPath: null,
        sizeBytes: 0,
      })),
      recordings: [],
      root,
    });

    expect(inventory.clipGroups).toEqual([]);
  });
});
