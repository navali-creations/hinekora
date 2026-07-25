import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { MigrationRunner } from "../migrations";
import { migration_20260717_000000_storage_file_deletion_operations } from "../migrations/20260717_000000_storage_file_deletion_operations";
import { migration_20260723_000000_editor_export_videos } from "../migrations/20260723_000000_editor_export_videos";
import {
  columnNames,
  indexExists,
  tableExists,
} from "./MigrationRunner.test-utils";

let database: DatabaseSync | null = null;

function createDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  return database;
}

describe("Editor export videos migration", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("creates its ownership schema idempotently and rolls it back", () => {
    const db = createDatabase();

    migration_20260723_000000_editor_export_videos.up(db);
    migration_20260723_000000_editor_export_videos.up(db);

    expect(tableExists(db, "editor_export_videos")).toBe(true);
    expect(columnNames(db, "editor_export_videos")).toEqual([
      "path",
      "device_id",
      "inode",
      "size_bytes",
      "modified_at_ms",
      "created_at",
      "updated_at",
    ]);
    expect(indexExists(db, "editor_export_videos_updated_at_idx")).toBe(true);

    migration_20260723_000000_editor_export_videos.down(db);

    expect(tableExists(db, "editor_export_videos")).toBe(false);
    expect(indexExists(db, "editor_export_videos_updated_at_idx")).toBe(false);
  });

  it("applies after the previous migration on an existing database", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);
    db.prepare(
      "INSERT INTO migrations (id, description, applied_at) VALUES (?, ?, ?)",
    ).run(
      migration_20260717_000000_storage_file_deletion_operations.id,
      migration_20260717_000000_storage_file_deletion_operations.description,
      "2026-07-17T00:00:00.000Z",
    );

    runner.runMigrations([
      migration_20260717_000000_storage_file_deletion_operations,
      migration_20260723_000000_editor_export_videos,
    ]);
    runner.runMigrations([
      migration_20260717_000000_storage_file_deletion_operations,
      migration_20260723_000000_editor_export_videos,
    ]);

    expect(tableExists(db, "editor_export_videos")).toBe(true);
    expect(runner.getAppliedMigrationIds()).toEqual([
      migration_20260717_000000_storage_file_deletion_operations.id,
      migration_20260723_000000_editor_export_videos.id,
    ]);
    expect(
      runner.rollbackMigration(migration_20260723_000000_editor_export_videos),
    ).toBe(true);
    expect(tableExists(db, "editor_export_videos")).toBe(false);
  });
});
