import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { isWindowsOS } from "~/main/utils/platform";
import {
  getStagedFileDeletionOperationId,
  resetStagedFileDeletionStateForTests,
  stageFilesForDeletion,
} from "~/main/utils/staged-file-deletion";

import { StorageFileDeletionService } from "../StorageFileDeletion.service";

let database: DatabaseService;
let root: string;
let service: StorageFileDeletionService;

describe("StorageFileDeletionService", () => {
  beforeEach(() => {
    database = new DatabaseService(":memory:");
    root = mkdtempSync(join(tmpdir(), "hinekora-storage-file-deletion-"));
    service = new StorageFileDeletionService(database);
  });

  afterEach(() => {
    resetStagedFileDeletionStateForTests();
    database.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("finalizes a database-committed operation after a process restart", async () => {
    const path = join(root, "recording.mp4");
    writeFileSync(path, "recording");
    const stagedFiles = await stageFilesForDeletion(root, [{ path, size: 9 }]);
    const operationId = getStagedFileDeletionOperationId(stagedFiles)!;
    database.transaction(() =>
      service.markCommitted(
        stagedFiles,
        isWindowsOS() ? root.toUpperCase() : root,
      ),
    );
    resetStagedFileDeletionStateForTests();

    await expect(service.recover(root)).resolves.toEqual({
      failed: [],
      finalizedPaths: [path],
      hasMore: false,
      restoredPaths: [],
    });
    expect(existsSync(path)).toBe(false);
    expect(readOperation(operationId)).toBeUndefined();
  });

  it("restores an operation whose database transaction did not commit", async () => {
    const path = join(root, "recording.mp4");
    writeFileSync(path, "recording");
    await stageFilesForDeletion(root, [{ path, size: 9 }]);
    resetStagedFileDeletionStateForTests();

    await expect(service.recover(root)).resolves.toEqual({
      failed: [],
      finalizedPaths: [],
      hasMore: false,
      restoredPaths: [path],
    });
    expect(existsSync(path)).toBe(true);
  });

  it("does not apply a committed operation from a different storage root", async () => {
    const path = join(root, "recording.mp4");
    const otherRoot = mkdtempSync(
      join(tmpdir(), "hinekora-storage-file-deletion-other-"),
    );
    writeFileSync(path, "recording");
    const stagedFiles = await stageFilesForDeletion(root, [{ path, size: 9 }]);
    const operationId = getStagedFileDeletionOperationId(stagedFiles)!;
    database.transaction(() => service.markCommitted(stagedFiles, otherRoot));
    resetStagedFileDeletionStateForTests();

    try {
      await expect(service.recover(root)).resolves.toEqual({
        failed: [],
        finalizedPaths: [],
        hasMore: false,
        restoredPaths: [path],
      });
      expect(existsSync(path)).toBe(true);
      expect(readOperation(operationId)).toEqual({ operation_id: operationId });
    } finally {
      rmSync(otherRoot, { recursive: true, force: true });
    }
  });

  it("uses the database journal when the filesystem marker is invalid", async () => {
    const path = join(root, "recording.mp4");
    writeFileSync(path, "recording");
    const stagedFiles = await stageFilesForDeletion(root, [{ path, size: 9 }]);
    const operationId = getStagedFileDeletionOperationId(stagedFiles)!;
    database.transaction(() => service.markCommitted(stagedFiles, root));
    writeFileSync(
      join(dirname(stagedFiles[0]!.stagedPath), "committed"),
      "bad",
    );

    await expect(service.finalize(stagedFiles)).resolves.toEqual({
      deletedPaths: [],
      failed: stagedFiles,
      freedBytes: 0,
    });
    resetStagedFileDeletionStateForTests();
    await expect(service.recover(root)).resolves.toEqual({
      failed: [],
      finalizedPaths: [path],
      hasMore: false,
      restoredPaths: [],
    });
    expect(existsSync(path)).toBe(false);
    expect(readOperation(operationId)).toBeUndefined();
  });
});

function readOperation(operationId: string) {
  return database.db
    .prepare(
      `SELECT operation_id
       FROM storage_file_deletion_operations
       WHERE operation_id = ?`,
    )
    .get(operationId);
}
