import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { type Migration, MigrationRunner, migrations } from "../migrations";
import { migration_20260618_000000_replay_clip_kind } from "../migrations/20260618_000000_replay_clip_kind";
import { migration_20260620_000000_media_library_performance } from "../migrations/20260620_000000_media_library_performance";

let database: DatabaseSync | null = null;

function createDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  return database;
}

function closeDatabase(): void {
  database?.close();
  database = null;
}

function tableExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare(
      `
      SELECT 1 AS found
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `,
    )
    .get(name) as { found: number } | undefined;

  return row !== undefined;
}

function indexExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare(
      `
      SELECT 1 AS found
      FROM sqlite_master
      WHERE type = 'index' AND name = ?
    `,
    )
    .get(name) as { found: number } | undefined;

  return row !== undefined;
}

function columnNames(db: DatabaseSync, table: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => (row as { name: string }).name);
}

function createTableMigration(id: string): Migration {
  return {
    id,
    description: `Create ${id}`,
    up(db) {
      db.exec(`CREATE TABLE ${id} (id TEXT PRIMARY KEY)`);
    },
    down(db) {
      db.exec(`DROP TABLE ${id}`);
    },
  };
}

describe("MigrationRunner", () => {
  afterEach(() => {
    closeDatabase();
  });

  it("creates the migrations tracking table", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);

    expect(tableExists(db, "migrations")).toBe(true);
    expect(runner.getAppliedMigrationIds()).toEqual([]);
  });

  it("runs Hinekora migrations on a fresh database and is idempotent", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);

    runner.runMigrations(migrations);
    runner.runMigrations(migrations);

    expect(runner.getAppliedMigrationIds()).toEqual(
      migrations.map((migration) => migration.id),
    );
    expect(runner.listAppliedMigrations()[0]).toContain(
      "20260608_000000_initial_schema - Create initial Hinekora persistence schema",
    );
    expect(tableExists(db, "profiles")).toBe(true);
    expect(tableExists(db, "settings")).toBe(true);
    expect(tableExists(db, "replay_clips")).toBe(true);
    expect(tableExists(db, "run_recordings")).toBe(true);
    expect(tableExists(db, "editor_projects")).toBe(true);
    expect(columnNames(db, "replay_clips")).toContain("source_league");
    expect(columnNames(db, "replay_clips")).toContain("kind");
    expect(columnNames(db, "replay_clips")).toContain("size_bytes");
    expect(columnNames(db, "run_recordings")).toEqual(
      expect.arrayContaining([
        "duration_seconds",
        "exists_on_disk",
        "file_name",
        "mtime_ms",
        "size_bytes",
      ]),
    );
    expect(indexExists(db, "idx_replay_clips_created_at")).toBe(true);
    expect(indexExists(db, "idx_replay_clips_game_league_created_at")).toBe(
      true,
    );
    expect(
      indexExists(db, "idx_replay_clips_kind_game_league_created_at"),
    ).toBe(true);
    expect(indexExists(db, "idx_replay_clips_kind_game_league_size")).toBe(
      true,
    );
    expect(indexExists(db, "idx_run_recordings_path")).toBe(true);
    expect(indexExists(db, "idx_run_recordings_game_league_created_at")).toBe(
      true,
    );
    expect(indexExists(db, "idx_run_recordings_game_league_size")).toBe(true);
    expect(indexExists(db, "idx_run_recordings_game_league_duration")).toBe(
      true,
    );
    expect(indexExists(db, "idx_run_recordings_cleanup")).toBe(true);
    expect(indexExists(db, "idx_editor_projects_updated_at")).toBe(true);
  });

  it("adds replay clip kind to pre-existing replay clip tables", () => {
    const db = createDatabase();
    db.exec(`
      CREATE TABLE replay_clips (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        source_game TEXT NOT NULL,
        source_league TEXT NOT NULL DEFAULT 'Standard',
        death_timestamp TEXT NOT NULL,
        trigger_line_hash TEXT NOT NULL,
        original_obs_path TEXT,
        processed_clip_path TEXT,
        target_duration_seconds INTEGER NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    migration_20260618_000000_replay_clip_kind.up(db);

    expect(columnNames(db, "replay_clips")).toContain("kind");
    expect(
      indexExists(db, "idx_replay_clips_kind_game_league_created_at"),
    ).toBe(true);
  });

  it("keeps media library performance migration idempotent on upgraded tables", () => {
    const db = createDatabase();

    db.exec(`
      CREATE TABLE replay_clips (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL DEFAULT 'death',
        source_game TEXT NOT NULL DEFAULT 'poe2',
        source_league TEXT NOT NULL DEFAULT 'Standard',
        size_bytes INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE run_recordings (
        id TEXT PRIMARY KEY,
        source_game TEXT NOT NULL,
        source_league TEXT NOT NULL,
        duration_seconds INTEGER,
        exists_on_disk INTEGER NOT NULL DEFAULT 0,
        file_name TEXT NOT NULL DEFAULT '',
        mtime_ms INTEGER NOT NULL DEFAULT 0,
        size_bytes INTEGER NOT NULL DEFAULT 0
      );
    `);

    migration_20260620_000000_media_library_performance.up(db);

    expect(columnNames(db, "replay_clips")).toContain("size_bytes");
    expect(columnNames(db, "run_recordings")).toEqual(
      expect.arrayContaining([
        "duration_seconds",
        "exists_on_disk",
        "file_name",
        "mtime_ms",
        "size_bytes",
      ]),
    );
    expect(indexExists(db, "idx_run_recordings_cleanup")).toBe(true);
  });

  it("rolls back Hinekora migrations in reverse order", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);

    runner.runMigrations(migrations);

    for (const migration of [...migrations].reverse()) {
      expect(runner.rollbackMigration(migration)).toBe(true);
    }

    expect(runner.getAppliedMigrationIds()).toEqual([]);
    expect(tableExists(db, "editor_projects")).toBe(false);
    expect(tableExists(db, "run_recordings")).toBe(false);
    expect(tableExists(db, "profiles")).toBe(false);
  });

  it("runs only migrations that are still pending", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);
    const first = createTableMigration("first_migration");
    const second = createTableMigration("second_migration");

    runner.runMigrations([first]);
    runner.runMigrations([first, second]);

    expect(tableExists(db, "first_migration")).toBe(true);
    expect(tableExists(db, "second_migration")).toBe(true);
    expect(runner.getAppliedMigrationIds()).toEqual([
      "first_migration",
      "second_migration",
    ]);
  });

  it("rolls back all changes when a pending migration fails", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);
    const failingMigration: Migration = {
      id: "failing_migration",
      description: "Fail after making a schema change",
      up(database) {
        database.exec("CREATE TABLE should_not_survive (id TEXT PRIMARY KEY)");
        throw new Error("migration failed");
      },
      down(database) {
        database.exec("DROP TABLE should_not_survive");
      },
    };

    expect(() => runner.runMigrations([failingMigration])).toThrow(
      "migration failed",
    );
    expect(tableExists(db, "should_not_survive")).toBe(false);
    expect(runner.getAppliedMigrationIds()).toEqual([]);
  });

  it("returns false when rolling back a migration that was not applied", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);
    const migration = createTableMigration("not_applied");

    expect(runner.rollbackMigration(migration)).toBe(false);
  });

  it("rejects duplicate migration ids", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);
    const first = createTableMigration("duplicate_id");
    const second = createTableMigration("duplicate_id");

    expect(() => runner.runMigrations([first, second])).toThrow(
      "[Migrations] Duplicate migration id: duplicate_id",
    );
  });
});
