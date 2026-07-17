import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { migration_20260717_000000_storage_file_deletion_operations } from "../migrations/20260717_000000_storage_file_deletion_operations";
import { columnNames, tableExists } from "./MigrationRunner.test-utils";

let database: DatabaseSync | null = null;

describe("storage file deletion operations migration", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("creates the durable journal and can be rerun", () => {
    database = new DatabaseSync(":memory:");

    migration_20260717_000000_storage_file_deletion_operations.up(database);
    database
      .prepare(
        `INSERT INTO storage_file_deletion_operations
          (operation_id, storage_root, committed_at)
         VALUES (?, ?, ?)`,
      )
      .run("operation-1", "C:/recordings", "2026-07-17T00:00:00.000Z");
    migration_20260717_000000_storage_file_deletion_operations.up(database);

    expect(tableExists(database, "storage_file_deletion_operations")).toBe(
      true,
    );
    expect(columnNames(database, "storage_file_deletion_operations")).toEqual([
      "operation_id",
      "storage_root",
      "committed_at",
    ]);
    expect(
      database
        .prepare("SELECT operation_id FROM storage_file_deletion_operations")
        .get(),
    ).toEqual({ operation_id: "operation-1" });
  });

  it("removes the journal on rollback", () => {
    database = new DatabaseSync(":memory:");
    migration_20260717_000000_storage_file_deletion_operations.up(database);

    migration_20260717_000000_storage_file_deletion_operations.down(database);

    expect(tableExists(database, "storage_file_deletion_operations")).toBe(
      false,
    );
  });
});
