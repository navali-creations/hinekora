import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import { deleteGameLeagueStorage } from "./Storage.deletion";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "hinekora-storage-deletion-"));
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    bookmarks: {
      deleteBookmarksForRecordings: vi.fn(),
      deleteReplayClipLinksMany: vi.fn(),
    },
    clips: [],
    database: {
      transaction: (callback: () => void) => callback(),
    },
    fileDeletions: {
      finalize: vi.fn().mockResolvedValue({
        deletedPaths: [],
        failed: [],
        freedBytes: 0,
      }),
      markCommitted: vi.fn(),
    },
    game: "poe2",
    leagueName: "Standard",
    recordingRepository: { listRunRecordings: vi.fn().mockReturnValue([]) },
    recordings: [],
    replayClipsRepository: { listStoragePaths: vi.fn().mockReturnValue([]) },
    storageRoot: root,
    ...overrides,
  } as unknown as Parameters<typeof deleteGameLeagueStorage>[0];
}

describe("game and league storage deletion", () => {
  it("preserves paths still referenced by an unselected recording", async () => {
    const remainingPath = join(root, "remaining.mkv");
    const input = createInput({
      recordingRepository: {
        listRunRecordings: vi
          .fn()
          .mockReturnValue([
            { id: "recording-remaining", path: remainingPath },
          ]),
      },
    });

    await expect(deleteGameLeagueStorage(input)).resolves.toEqual({
      failedFileCount: 0,
      freedBytes: 0,
    });
  });

  it("restores files when a new reference appears inside the transaction", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    await writeFile(path, "clip");
    const clip = createReplayClip({
      id: "selected",
      originalObsPath: null,
      processedClipPath: path,
    });
    const listStoragePaths = vi
      .fn()
      .mockReturnValueOnce([
        { id: clip.id, originalObsPath: null, processedClipPath: path },
      ])
      .mockReturnValueOnce([
        { id: "new-reference", originalObsPath: null, processedClipPath: path },
      ]);
    const input = createInput({
      clips: [clip],
      replayClipsRepository: { listStoragePaths },
    });

    await expect(deleteGameLeagueStorage(input)).rejects.toThrow(
      "Storage references changed during deletion",
    );
    await expect(readFile(path, "utf8")).resolves.toBe("clip");
  });
});
