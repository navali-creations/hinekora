import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteRecordingFile,
  recoverRecordingStorageDeletions,
} from "./RecordingStorage.deletion";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "hinekora-recording-deletion-"));
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

function createDependencies(overrides: Record<string, unknown> = {}) {
  return {
    bookmarks: { deleteBookmarksForRecording: vi.fn() },
    database: { transaction: (callback: () => void) => callback() },
    fileDeletions: {
      finalize: vi.fn().mockResolvedValue({
        deletedPaths: [],
        failed: [],
        freedBytes: 0,
      }),
      markCommitted: vi.fn(),
    },
    recordingRepository: {
      deleteRunRecordingByPath: vi.fn().mockReturnValue(false),
      getItemByPath: vi.fn().mockReturnValue(null),
    },
    replayClipsRepository: { hasStoragePath: vi.fn().mockReturnValue(false) },
    ...overrides,
  } as unknown as Parameters<typeof deleteRecordingFile>[0]["dependencies"];
}

describe("recording storage deletion", () => {
  it("rejects missing paths and directories", async () => {
    const missingPath = join(root, "missing.mkv");
    await expect(
      deleteRecordingFile({
        dependencies: createDependencies(),
        path: missingPath,
        root,
      }),
    ).rejects.toThrow("Recording file is not available");

    const directoryPath = join(root, "recording.mkv");
    await mkdir(directoryPath);
    await expect(
      deleteRecordingFile({
        dependencies: createDependencies(),
        path: directoryPath,
        root,
      }),
    ).rejects.toThrow("Recording storage path is not a file");
  });

  it("restores a staged file when references change inside the transaction", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");
    const hasStoragePath = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const dependencies = createDependencies({
      recordingRepository: {
        deleteRunRecordingByPath: vi.fn(),
        getItemByPath: vi.fn().mockReturnValue({ id: "recording-1" }),
      },
      replayClipsRepository: { hasStoragePath },
    });

    await expect(
      deleteRecordingFile({ dependencies, path, root }),
    ).rejects.toThrow("Recording storage references changed during deletion");
    await expect(readFile(path, "utf8")).resolves.toBe("recording");
  });

  it("rejects failed staged-deletion recovery", async () => {
    await expect(
      recoverRecordingStorageDeletions({
        fileDeletions: {
          recover: vi.fn().mockResolvedValue({
            failed: [{ path: "failed.mkv" }],
            hasMore: false,
          }),
        } as never,
        root,
      }),
    ).rejects.toThrow(
      "One or more staged storage files could not be recovered",
    );
  });
});
