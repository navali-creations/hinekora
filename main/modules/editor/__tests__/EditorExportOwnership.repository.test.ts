import { afterEach, describe, expect, it } from "vitest";

import { DatabaseService } from "~/main/modules/database";

import { EditorExportOwnershipRepository } from "../EditorExportOwnership.repository";

let database: DatabaseService | null = null;

afterEach(() => {
  database?.close();
  database = null;
});

describe("EditorExportOwnershipRepository", () => {
  it("reads the ownership tracking start from the applied migration", () => {
    database = new DatabaseService(":memory:");
    const repository = new EditorExportOwnershipRepository(database);

    expect(repository.getTrackingStartedAtMs()).toEqual(expect.any(Number));

    database.runQuery(
      database.kysely
        .deleteFrom("migrations")
        .where("id", "=", "20260723_000000_editor_export_videos"),
    );
    expect(repository.getTrackingStartedAtMs()).toBeNull();
  });

  it("round-trips native identities above JavaScript's safe integer range", () => {
    database = new DatabaseService(":memory:");
    const repository = new EditorExportOwnershipRepository(database);
    const inode = 9_570_149_209_367_624;

    repository.upsert({
      deviceId: 123,
      inode,
      modifiedAtMs: 1_000,
      path: "C:\\Exports\\saved.mp4",
      sizeBytes: 456,
    });

    expect(repository.list()).toEqual([
      {
        deviceId: 123,
        inode,
        modifiedAtMs: 1_000,
        path: "C:\\Exports\\saved.mp4",
        sizeBytes: 456,
      },
    ]);
  });
});
