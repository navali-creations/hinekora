import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  finalizeStagedFileDeletions,
  getStagedFileDeletionTrashSize,
  markStagedFileDeletionsCommitted,
  recoverStagedFileDeletions,
  resetStagedFileDeletionStateForTests,
  rollbackStagedFileDeletions,
  stageFilesForDeletion,
} from "./staged-file-deletion";

let root: string;

beforeEach(async () => {
  resetStagedFileDeletionStateForTests();
  root = await mkdtemp(join(tmpdir(), "hinekora-staged-deletion-"));
});

afterEach(async () => {
  resetStagedFileDeletionStateForTests();
  await rm(root, { force: true, recursive: true });
});

describe("staged file deletion", () => {
  it("rejects oversized operations before touching storage", async () => {
    await expect(
      stageFilesForDeletion(
        root,
        Array.from({ length: 100_001 }, () => ({
          path: join(root, "recording.mkv"),
          size: 1,
        })),
      ),
    ).rejects.toThrow("Too many files");
  });

  it("fails closed when the trash path is not a directory", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");
    await writeFile(join(root, ".hinekora-retention-trash"), "occupied");

    await expect(
      stageFilesForDeletion(root, [{ path, size: 9 }]),
    ).rejects.toThrow("trash directory is unavailable");
    await expect(readFile(path, "utf8")).resolves.toBe("recording");
  });

  it("rolls back files already moved when a duplicate target fails", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");

    await expect(
      stageFilesForDeletion(root, [
        { path, size: 9 },
        { path, size: 9 },
      ]),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(path, "utf8")).resolves.toBe("recording");
  });

  it("rejects runtime-invalid manifest values", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");

    await expect(
      stageFilesForDeletion(root, [{ path, size: Number.NaN }]),
    ).rejects.toThrow("manifest is invalid");
    await expect(readFile(path, "utf8")).resolves.toBe("recording");
  });
  it("restores original files when a transaction must roll back", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");

    const staged = await stageFilesForDeletion(root, [{ path, size: 9 }]);
    await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await getStagedFileDeletionTrashSize(root)).toBe(9);

    await rollbackStagedFileDeletions(staged);

    await expect(readFile(path, "utf8")).resolves.toBe("recording");
    expect(await getStagedFileDeletionTrashSize(root)).toBe(0);
  });

  it("surfaces rollback failures as an aggregate error", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");
    const staged = await stageFilesForDeletion(root, [{ path, size: 9 }]);
    await unlink(staged[0]!.stagedPath);

    await expect(rollbackStagedFileDeletions(staged)).rejects.toThrow(
      "Failed to restore staged storage files",
    );
  });

  it("counts only files that were physically finalized", async () => {
    const path = join(root, "clip.mp4");
    await writeFile(path, "clip");
    const staged = await stageFilesForDeletion(root, [{ path, size: 4 }]);

    await expect(finalizeStagedFileDeletions(staged)).resolves.toEqual({
      deletedPaths: [path],
      failed: [],
      freedBytes: 4,
    });
    expect(await getStagedFileDeletionTrashSize(root)).toBe(0);
  });

  it("fails closed when a commit marker cannot be written", async () => {
    const path = join(root, "clip.mp4");
    await writeFile(path, "clip");
    const staged = await stageFilesForDeletion(root, [{ path, size: 4 }]);
    await writeFile(join(dirname(staged[0]!.stagedPath), "committed"), "bad");

    await expect(finalizeStagedFileDeletions(staged)).resolves.toEqual({
      deletedPaths: [],
      failed: staged,
      freedBytes: 0,
    });
    resetStagedFileDeletionStateForTests();
    await recoverStagedFileDeletions(root);

    await expect(readFile(path, "utf8")).resolves.toBe("clip");
  });

  it("keeps the journal when durable completion fails during finalization", async () => {
    const path = join(root, "clip.mp4");
    await writeFile(path, "clip");
    const staged = await stageFilesForDeletion(root, [{ path, size: 4 }]);
    const operationDirectory = dirname(staged[0]!.stagedPath);

    await expect(
      finalizeStagedFileDeletions(staged, {
        completeOperation: () => Promise.reject(new Error("database failed")),
      }),
    ).resolves.toEqual({
      deletedPaths: [path],
      failed: [],
      freedBytes: 4,
    });
    await expect(readdir(operationDirectory)).resolves.toEqual(
      expect.arrayContaining(["committed", "manifest.json"]),
    );

    resetStagedFileDeletionStateForTests();
    const completeOperation = vi.fn();
    await expect(
      recoverStagedFileDeletions(root, { completeOperation }),
    ).resolves.toEqual({
      failed: [],
      finalizedPaths: [],
      hasMore: false,
      restoredPaths: [],
    });
    expect(completeOperation).toHaveBeenCalledTimes(1);
    await expect(readdir(operationDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("preserves staged files when the durable commit lookup fails", async () => {
    const path = join(root, "clip.mp4");
    await writeFile(path, "clip");
    const staged = await stageFilesForDeletion(root, [{ path, size: 4 }]);
    resetStagedFileDeletionStateForTests();

    await expect(
      recoverStagedFileDeletions(root, {
        isOperationCommitted: () =>
          Promise.reject(new Error("database failed")),
      }),
    ).resolves.toEqual({
      failed: staged,
      finalizedPaths: [],
      hasMore: false,
      restoredPaths: [],
    });
    await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await getStagedFileDeletionTrashSize(root)).toBe(4);

    await recoverStagedFileDeletions(root);
    await expect(readFile(path, "utf8")).resolves.toBe("clip");
  });

  it("keeps the journal when durable completion fails during recovery", async () => {
    const path = join(root, "clip.mp4");
    await writeFile(path, "clip");
    const staged = await stageFilesForDeletion(root, [{ path, size: 4 }]);
    const operationDirectory = dirname(staged[0]!.stagedPath);
    await markStagedFileDeletionsCommitted(staged);
    resetStagedFileDeletionStateForTests();

    await expect(
      recoverStagedFileDeletions(root, {
        completeOperation: () => Promise.reject(new Error("database failed")),
      }),
    ).resolves.toEqual({
      failed: [],
      finalizedPaths: [path],
      hasMore: false,
      restoredPaths: [],
    });
    await expect(readdir(operationDirectory)).resolves.toEqual(
      expect.arrayContaining(["committed", "manifest.json"]),
    );

    await recoverStagedFileDeletions(root, { completeOperation: vi.fn() });
    await expect(readdir(operationDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("recovers a bounded number of journaled files", async () => {
    const firstPath = join(root, "one.mp4");
    const secondPath = join(root, "two.mp4");
    await writeFile(firstPath, "one");
    await writeFile(secondPath, "two");
    const first = await stageFilesForDeletion(root, [
      { path: firstPath, size: 3 },
    ]);
    const second = await stageFilesForDeletion(root, [
      { path: secondPath, size: 3 },
    ]);
    await markStagedFileDeletionsCommitted(first);
    await markStagedFileDeletionsCommitted(second);
    resetStagedFileDeletionStateForTests();

    const firstRecovery = await recoverStagedFileDeletions(root, {
      maxFiles: 1,
    });
    expect(firstRecovery.finalizedPaths).toHaveLength(1);
    expect(firstRecovery.hasMore).toBe(true);
    expect(await getStagedFileDeletionTrashSize(root)).toBeGreaterThan(0);
    const secondRecovery = await recoverStagedFileDeletions(root, {
      maxFiles: 1,
    });
    expect(secondRecovery.finalizedPaths).toHaveLength(1);
    expect(secondRecovery.hasMore).toBe(false);
    expect(await getStagedFileDeletionTrashSize(root)).toBe(0);
  });

  it("bounds recovery within a multi-file operation", async () => {
    const firstPath = join(root, "one.mp4");
    const secondPath = join(root, "two.mp4");
    await writeFile(firstPath, "one");
    await writeFile(secondPath, "two");
    const staged = await stageFilesForDeletion(root, [
      { path: firstPath, size: 3 },
      { path: secondPath, size: 3 },
    ]);
    await markStagedFileDeletionsCommitted(staged);
    resetStagedFileDeletionStateForTests();

    await expect(
      recoverStagedFileDeletions(root, { maxFiles: 1 }),
    ).resolves.toMatchObject({
      finalizedPaths: [firstPath],
      hasMore: true,
    });
    await expect(
      recoverStagedFileDeletions(root, { maxFiles: 1 }),
    ).resolves.toMatchObject({
      finalizedPaths: [secondPath],
      hasMore: false,
    });
  });

  it("preserves unsafe staged entries for manual recovery", async () => {
    const path = join(root, "recording.mp4");
    await writeFile(path, "recording");
    const staged = await stageFilesForDeletion(root, [{ path, size: 9 }]);
    await unlink(staged[0]!.stagedPath);
    await mkdir(staged[0]!.stagedPath);
    resetStagedFileDeletionStateForTests();

    await expect(recoverStagedFileDeletions(root)).resolves.toMatchObject({
      failed: staged,
      finalizedPaths: [],
      restoredPaths: [],
    });
  });

  it("does not overwrite a replacement created before recovery", async () => {
    const path = join(root, "recording.mp4");
    await writeFile(path, "recording");
    const staged = await stageFilesForDeletion(root, [{ path, size: 9 }]);
    await writeFile(path, "replacement");
    resetStagedFileDeletionStateForTests();

    await expect(recoverStagedFileDeletions(root)).resolves.toMatchObject({
      failed: staged,
      finalizedPaths: [],
      restoredPaths: [],
    });
    await expect(readFile(path, "utf8")).resolves.toBe("replacement");
  });

  it("ignores malformed and unsafe deletion manifests", async () => {
    const trashDirectory = join(root, ".hinekora-retention-trash");
    await mkdir(trashDirectory);
    const stagedName = "12345678-1234-4123-8123-123456789abc";
    const manifests: Array<unknown | "malformed" | "directory"> = [
      "directory",
      null,
      "malformed",
      {
        files: [{ path: join(root, "..", "outside.mp4"), size: 1, stagedName }],
        version: 1,
      },
    ];
    for (let index = 0; index < manifests.length; index += 1) {
      const operationDirectory = join(trashDirectory, `operation-${index}`);
      await mkdir(operationDirectory);
      const manifestPath = join(operationDirectory, "manifest.json");
      const manifest = manifests[index];
      if (manifest === "directory") {
        await mkdir(manifestPath);
      } else if (manifest === "malformed") {
        await writeFile(manifestPath, "{");
      } else {
        await writeFile(manifestPath, JSON.stringify(manifest));
      }
    }

    await expect(recoverStagedFileDeletions(root)).resolves.toEqual({
      failed: [],
      finalizedPaths: [],
      hasMore: false,
      restoredPaths: [],
    });
  });

  it("counts loose trash files and handles roots that do not exist", async () => {
    const trashDirectory = join(root, ".hinekora-retention-trash");
    await mkdir(trashDirectory);
    await writeFile(join(trashDirectory, "loose.bin"), "loose");

    await expect(getStagedFileDeletionTrashSize(root)).resolves.toBe(5);
    await expect(
      getStagedFileDeletionTrashSize(join(root, "missing")),
    ).resolves.toBe(0);
  });

  it("accepts an existing valid commit marker", async () => {
    const path = join(root, "recording.mp4");
    await writeFile(path, "recording");
    const staged = await stageFilesForDeletion(root, [{ path, size: 9 }]);

    await markStagedFileDeletionsCommitted(staged);
    await expect(
      markStagedFileDeletionsCommitted(staged),
    ).resolves.toBeUndefined();
    await finalizeStagedFileDeletions(staged);
  });

  it("rejects lexical outside and root deletion targets", async () => {
    const outsidePath = join(dirname(root), "outside-recording.mp4");
    await writeFile(outsidePath, "outside");
    try {
      await expect(
        stageFilesForDeletion(root, [{ path: outsidePath, size: 7 }]),
      ).rejects.toThrow("outside managed storage");
      await expect(
        stageFilesForDeletion(root, [{ path: root, size: 0 }]),
      ).rejects.toThrow("must be a file inside managed storage");
    } finally {
      await rm(outsidePath, { force: true });
    }
  });

  it("guards the test-only state reset", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVitest = process.env.VITEST;
    process.env.NODE_ENV = "production";
    process.env.VITEST = "false";
    try {
      expect(() => resetStagedFileDeletionStateForTests()).toThrow(
        "only available in tests",
      );
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.VITEST = previousVitest;
    }
  });

  it("does not recover files from an active deletion operation", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");
    const staged = await stageFilesForDeletion(root, [{ path, size: 9 }]);

    await expect(recoverStagedFileDeletions(root)).resolves.toEqual({
      failed: [],
      finalizedPaths: [],
      hasMore: false,
      restoredPaths: [],
    });
    await rollbackStagedFileDeletions(staged);

    await expect(readFile(path, "utf8")).resolves.toBe("recording");
  });

  it("restores a staged file after a pre-commit process restart", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");
    await stageFilesForDeletion(root, [{ path, size: 9 }]);
    resetStagedFileDeletionStateForTests();

    await expect(recoverStagedFileDeletions(root)).resolves.toEqual({
      failed: [],
      finalizedPaths: [],
      hasMore: false,
      restoredPaths: [path],
    });
    await expect(readFile(path, "utf8")).resolves.toBe("recording");
    expect(await getStagedFileDeletionTrashSize(root)).toBe(0);
  });

  it("finalizes a staged file after a committed process restart", async () => {
    const path = join(root, "recording.mkv");
    await writeFile(path, "recording");
    const staged = await stageFilesForDeletion(root, [{ path, size: 9 }]);
    await markStagedFileDeletionsCommitted(staged);
    resetStagedFileDeletionStateForTests();

    await expect(recoverStagedFileDeletions(root)).resolves.toEqual({
      failed: [],
      finalizedPaths: [path],
      hasMore: false,
      restoredPaths: [],
    });
    await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await getStagedFileDeletionTrashSize(root)).toBe(0);
  });

  it("rejects deletion targets that resolve outside the storage root", async () => {
    const externalRoot = await mkdtemp(
      join(tmpdir(), "hinekora-staged-deletion-external-"),
    );
    try {
      const linkedDirectory = join(root, "Manual Replays");
      await symlink(
        externalRoot,
        linkedDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
      const externalPath = join(externalRoot, "clip.mp4");
      await writeFile(externalPath, "clip");

      await expect(
        stageFilesForDeletion(root, [
          { path: join(linkedDirectory, "clip.mp4"), size: 4 },
        ]),
      ).rejects.toThrow("resolves outside managed storage");
      await expect(readFile(externalPath, "utf8")).resolves.toBe("clip");
    } finally {
      await rm(externalRoot, { force: true, recursive: true });
    }
  });

  it("does not follow a linked retention trash directory", async () => {
    const externalRoot = await mkdtemp(
      join(tmpdir(), "hinekora-staged-trash-external-"),
    );
    try {
      const externalPath = join(externalRoot, "keep.mp4");
      await writeFile(externalPath, "keep");
      await symlink(
        externalRoot,
        join(root, ".hinekora-retention-trash"),
        process.platform === "win32" ? "junction" : "dir",
      );

      await expect(recoverStagedFileDeletions(root)).resolves.toEqual({
        failed: [],
        finalizedPaths: [],
        hasMore: false,
        restoredPaths: [],
      });
      await expect(readFile(externalPath, "utf8")).resolves.toBe("keep");
    } finally {
      await rm(externalRoot, { force: true, recursive: true });
    }
  });

  it("does not restore a journaled file through a linked parent directory", async () => {
    const externalRoot = await mkdtemp(
      join(tmpdir(), "hinekora-staged-restore-external-"),
    );
    try {
      const linkedDirectory = join(root, "linked");
      await symlink(
        externalRoot,
        linkedDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
      const trashDirectory = join(root, ".hinekora-retention-trash");
      const operationDirectory = join(trashDirectory, "operation");
      const stagedName = "12345678-1234-4123-8123-123456789abc";
      const originalPath = join(linkedDirectory, "restored.mp4");
      await mkdir(operationDirectory, { recursive: true });
      await writeFile(join(operationDirectory, stagedName), "staged");
      await writeFile(
        join(operationDirectory, "manifest.json"),
        JSON.stringify({
          files: [{ path: originalPath, size: 6, stagedName }],
          version: 1,
        }),
      );

      await expect(recoverStagedFileDeletions(root)).resolves.toMatchObject({
        failed: [expect.objectContaining({ path: originalPath })],
        restoredPaths: [],
      });
      await expect(
        readFile(join(externalRoot, "restored.mp4")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(externalRoot, { force: true, recursive: true });
    }
  });

  it("does not recover through a linked operation directory", async () => {
    const externalRoot = await mkdtemp(
      join(tmpdir(), "hinekora-staged-operation-external-"),
    );
    try {
      const path = join(root, "recording.mp4");
      await writeFile(path, "recording");
      await stageFilesForDeletion(root, [{ path, size: 9 }]);
      resetStagedFileDeletionStateForTests();
      const trashDirectory = join(root, ".hinekora-retention-trash");
      const [operationName] = await readdir(trashDirectory);
      const operationDirectory = join(trashDirectory, operationName!);
      const externalOperationDirectory = join(externalRoot, "operation");
      await rename(operationDirectory, externalOperationDirectory);
      await symlink(
        externalOperationDirectory,
        operationDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );

      await expect(recoverStagedFileDeletions(root)).resolves.toEqual({
        failed: [],
        finalizedPaths: [],
        hasMore: false,
        restoredPaths: [],
      });
      expect(await readdir(externalOperationDirectory)).not.toEqual([]);
    } finally {
      await rm(externalRoot, { force: true, recursive: true });
    }
  });
});
