import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { type Migration, MigrationRunner, migrations } from "../migrations";
import { migration_20260618_000000_replay_clip_kind } from "../migrations/20260618_000000_replay_clip_kind";
import { migration_20260620_000000_media_library_performance } from "../migrations/20260620_000000_media_library_performance";
import { migration_20260628_000000_editor_project_saved_edit_metadata } from "../migrations/20260628_000000_editor_project_saved_edit_metadata";
import { migration_20260630_000000_settings_cleanup } from "../migrations/20260630_000000_settings_cleanup";
import { migration_20260630_010000_recording_storage_path_migrations } from "../migrations/20260630_010000_recording_storage_path_migrations";

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

function indexColumns(
  db: DatabaseSync,
  name: string,
): Array<{ desc: boolean; name: string }> {
  return db
    .prepare(`PRAGMA index_xinfo(${name})`)
    .all()
    .filter((row) => (row as { key: number }).key === 1)
    .sort(
      (left, right) =>
        (left as { seqno: number }).seqno - (right as { seqno: number }).seqno,
    )
    .map((row) => {
      const typedRow = row as { desc: number; name: string };

      return { desc: typedRow.desc === 1, name: typedRow.name };
    });
}

function columnNames(db: DatabaseSync, table: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => (row as { name: string }).name);
}

function readSettings(db: DatabaseSync): Record<string, unknown> {
  const rows = db
    .prepare("SELECT key, value_json FROM settings")
    .all() as Array<{
    key: string;
    value_json: string;
  }>;

  return Object.fromEntries(
    rows.map((row) => [row.key, JSON.parse(row.value_json)]),
  );
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
    expect(tableExists(db, "recording_storage_path_migrations")).toBe(true);
    expect(tableExists(db, "editor_projects")).toBe(true);
    expect(tableExists(db, "editor_project_source_leagues")).toBe(true);
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
    expect(
      indexExists(db, "idx_recording_storage_path_migrations_status"),
    ).toBe(true);
    expect(indexExists(db, "idx_editor_projects_updated_at")).toBe(true);
    expect(columnNames(db, "editor_projects")).toEqual(
      expect.arrayContaining([
        "history_edit_count",
        "source_game",
        "source_league",
        "source_size_bytes",
      ]),
    );
    expect(indexExists(db, "idx_editor_projects_saved_edits_all_updated")).toBe(
      true,
    );
    expect(indexExists(db, "idx_editor_projects_saved_edits_all_created")).toBe(
      true,
    );
    expect(
      indexExists(db, "idx_editor_projects_saved_edits_all_duration"),
    ).toBe(true);
    expect(indexExists(db, "idx_editor_projects_saved_edits_all_history")).toBe(
      true,
    );
    expect(indexExists(db, "idx_editor_projects_saved_edits_all_size")).toBe(
      true,
    );
    expect(indexExists(db, "idx_editor_projects_saved_edits_all_title")).toBe(
      true,
    );
    expect(indexExists(db, "idx_editor_project_source_leagues_scope")).toBe(
      true,
    );
    expect(indexExists(db, "idx_editor_project_source_leagues_league")).toBe(
      true,
    );
    expect(indexColumns(db, "idx_editor_project_source_leagues_scope")).toEqual(
      [
        { desc: false, name: "source_game" },
        { desc: false, name: "source_league" },
        { desc: false, name: "project_id" },
      ],
    );
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

  it("keeps saved edit metadata migration idempotent on upgraded editor tables", () => {
    const db = createDatabase();

    db.exec(`
      CREATE TABLE editor_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration_seconds REAL NOT NULL,
        clip_count INTEGER NOT NULL DEFAULT 0,
        project_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO editor_projects (
        id,
        title,
        duration_seconds,
        clip_count,
        project_json,
        created_at,
        updated_at
      )
      VALUES (
        'project-1',
        'Boss edit',
        10,
        1,
        '{"sourceGame":"poe2","sourceLeague":"Runes of Aldur","history":{"editCount":2,"labels":["Split","Mute","Clear gaps"]},"assets":[{"assetKey":"clip:1","sourceGame":"poe1","sourceLeague":"Standard","sizeBytes":4096}],"tracks":[{"clips":[{"assetKey":"clip:1"}]}]}',
        '2026-06-18T00:00:00.000Z',
        '2026-06-18T00:00:00.000Z'
      ),
      (
        'project-2',
        'Asset scoped edit',
        10,
        1,
        '{"history":{"editCount":5,"labels":["Split"]},"assets":[{"assetKey":"clip:2","sourceGame":"poe1","sourceLeague":"Standard","sizeBytes":1024},{"assetKey":"clip:2","sourceGame":"poe1","sourceLeague":"Standard","sizeBytes":2048},{"assetKey":"clip:3","sourceGame":"poe1","sourceLeague":"Standard","sizeBytes":4096}],"tracks":[{"clips":[{"assetKey":"clip:2"},{"assetKey":"clip:3"}]}]}',
        '2026-06-18T00:00:00.000Z',
        '2026-06-18T00:00:00.000Z'
      ),
      (
        'project-3',
        'Mixed edit',
        10,
        1,
        '{"history":{"editCount":0,"labels":[]},"assets":[{"assetKey":"clip:4","sourceGame":"poe1","sourceLeague":"Standard","sizeBytes":100},{"assetKey":"clip:5","sourceGame":"poe2","sourceLeague":"Standard","sizeBytes":200}],"tracks":[{"clips":[{"assetKey":"clip:4"},{"assetKey":"clip:5"}]}]}',
        '2026-06-18T00:00:00.000Z',
        '2026-06-18T00:00:00.000Z'
      );
    `);

    migration_20260628_000000_editor_project_saved_edit_metadata.up(db);
    migration_20260628_000000_editor_project_saved_edit_metadata.up(db);

    expect(columnNames(db, "editor_projects")).toEqual(
      expect.arrayContaining([
        "history_edit_count",
        "source_game",
        "source_league",
        "source_size_bytes",
      ]),
    );
    expect(indexExists(db, "idx_editor_projects_saved_edits_all_updated")).toBe(
      true,
    );
    expect(indexExists(db, "idx_editor_projects_saved_edits_all_size")).toBe(
      true,
    );
    expect(tableExists(db, "editor_project_source_leagues")).toBe(true);
    expect(indexExists(db, "idx_editor_project_source_leagues_scope")).toBe(
      true,
    );
    expect(
      db
        .prepare(
          `
          SELECT id, source_game, source_league, source_size_bytes, history_edit_count
          FROM editor_projects
          ORDER BY id ASC
        `,
        )
        .all(),
    ).toEqual([
      {
        history_edit_count: 3,
        id: "project-1",
        source_game: "poe1",
        source_league: "Standard",
        source_size_bytes: 4096,
      },
      {
        history_edit_count: 5,
        id: "project-2",
        source_game: "poe1",
        source_league: "Standard",
        source_size_bytes: 6144,
      },
      {
        history_edit_count: 0,
        id: "project-3",
        source_game: null,
        source_league: "Standard",
        source_size_bytes: 300,
      },
    ]);
    expect(
      db
        .prepare(
          `
          SELECT project_id, source_game, source_league
          FROM editor_project_source_leagues
          ORDER BY project_id ASC, source_game ASC, source_league ASC
        `,
        )
        .all(),
    ).toEqual([
      {
        project_id: "project-1",
        source_game: "poe1",
        source_league: "Standard",
      },
      {
        project_id: "project-2",
        source_game: "poe1",
        source_league: "Standard",
      },
      {
        project_id: "project-3",
        source_game: "poe1",
        source_league: "Standard",
      },
      {
        project_id: "project-3",
        source_game: "poe2",
        source_league: "Standard",
      },
    ]);
  });

  it("rolls back saved edit metadata schema", () => {
    const db = createDatabase();

    db.exec(`
      CREATE TABLE editor_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration_seconds REAL NOT NULL DEFAULT 0,
        clip_count INTEGER NOT NULL DEFAULT 0,
        project_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    migration_20260628_000000_editor_project_saved_edit_metadata.up(db);
    migration_20260628_000000_editor_project_saved_edit_metadata.down(db);

    expect(tableExists(db, "editor_project_source_leagues")).toBe(false);
    expect(columnNames(db, "editor_projects")).not.toEqual(
      expect.arrayContaining([
        "history_edit_count",
        "source_game",
        "source_league",
        "source_size_bytes",
      ]),
    );
  });

  it("keeps saved edit metadata rollback idempotent before columns exist", () => {
    const db = createDatabase();

    db.exec(`
      CREATE TABLE editor_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration_seconds REAL NOT NULL DEFAULT 0,
        clip_count INTEGER NOT NULL DEFAULT 0,
        project_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    migration_20260628_000000_editor_project_saved_edit_metadata.down(db);

    expect(columnNames(db, "editor_projects")).toEqual([
      "id",
      "title",
      "duration_seconds",
      "clip_count",
      "project_json",
      "created_at",
      "updated_at",
    ]);
    expect(tableExists(db, "editor_project_source_leagues")).toBe(false);
  });

  it("backfills saved edit source league memberships when metadata columns already exist", () => {
    const db = createDatabase();

    db.exec(`
      CREATE TABLE editor_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration_seconds REAL NOT NULL,
        clip_count INTEGER NOT NULL DEFAULT 0,
        history_edit_count INTEGER NOT NULL DEFAULT 0,
        project_json TEXT NOT NULL,
        source_game TEXT,
        source_league TEXT,
        source_size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO editor_projects (
        id,
        title,
        duration_seconds,
        clip_count,
        history_edit_count,
        project_json,
        source_game,
        source_league,
        source_size_bytes,
        created_at,
        updated_at
      )
      VALUES (
        'project-1',
        'Mixed league edit',
        10,
        2,
        1,
        '{"assets":[{"assetKey":"clip:1","sourceGame":"poe2","sourceLeague":"Standard","sizeBytes":100},{"assetKey":"clip:2","sourceGame":"poe2","sourceLeague":"Runes of Aldur","sizeBytes":200}],"tracks":[{"clips":[{"assetKey":"clip:1"},{"assetKey":"clip:2"}]}]}',
        'poe2',
        NULL,
        300,
        '2026-06-18T00:00:00.000Z',
        '2026-06-18T00:00:00.000Z'
      );
    `);

    migration_20260628_000000_editor_project_saved_edit_metadata.up(db);
    migration_20260628_000000_editor_project_saved_edit_metadata.up(db);

    expect(indexExists(db, "idx_editor_project_source_leagues_scope")).toBe(
      true,
    );
    expect(
      db
        .prepare(
          `
          SELECT project_id, source_game, source_league
          FROM editor_project_source_leagues
          ORDER BY source_league ASC
        `,
        )
        .all(),
    ).toEqual([
      {
        project_id: "project-1",
        source_game: "poe2",
        source_league: "Runes of Aldur",
      },
      {
        project_id: "project-1",
        source_game: "poe2",
        source_league: "Standard",
      },
    ]);
  });

  it("cleans obsolete settings and preserves explicit split overlay settings", () => {
    const db = createDatabase();
    const updatedAt = "2026-06-30T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const insertSetting = db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    );
    insertSetting.run(
      "recordingHideOverlaysFromCapture",
      JSON.stringify(false),
      updatedAt,
    );
    insertSetting.run(
      "recordingHideOverlaysFromRecording",
      JSON.stringify(true),
      updatedAt,
    );
    insertSetting.run(
      "recordingHideOverlaysFromRewind",
      JSON.stringify(true),
      updatedAt,
    );
    insertSetting.run("deathClipSeconds", JSON.stringify(120), updatedAt);
    insertSetting.run("activeGame", JSON.stringify("poe2"), updatedAt);
    insertSetting.run(
      "obsoleteSetting",
      JSON.stringify("remove me"),
      updatedAt,
    );

    migration_20260630_000000_settings_cleanup.up(db);
    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toMatchObject({
      activeGame: "poe2",
      deathClipSeconds: 60,
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
    });
    expect(readSettings(db)).not.toHaveProperty(
      "recordingHideOverlaysFromCapture",
    );
    expect(readSettings(db)).not.toHaveProperty("obsoleteSetting");
  });

  it("backfills both split overlay settings from the obsolete combined setting", () => {
    const db = createDatabase();
    const updatedAt = "2026-06-30T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("recordingHideOverlaysFromCapture", JSON.stringify(true), updatedAt);

    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toMatchObject({
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
    });
  });

  it("resets malformed and invalid current settings while pruning obsolete settings", () => {
    const db = createDatabase();
    const updatedAt = "2026-06-30T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const insertSetting = db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    );
    insertSetting.run("recordingHideOverlaysFromCapture", "{bad", updatedAt);
    insertSetting.run("deathClipSeconds", "{bad", updatedAt);
    insertSetting.run("recordingHideOverlaysFromRecording", "{bad", updatedAt);
    insertSetting.run("activeGame", JSON.stringify("poe3"), updatedAt);
    insertSetting.run("recordingMaxStorageGb", JSON.stringify(25), updatedAt);

    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toEqual({
      activeGame: "poe1",
      deathClipSeconds: 10,
      recordingHideOverlaysFromRecording: true,
      recordingMaxStorageGb: 25,
    });
  });

  it("creates the recording storage path migration journal idempotently", () => {
    const db = createDatabase();

    migration_20260630_010000_recording_storage_path_migrations.up(db);
    migration_20260630_010000_recording_storage_path_migrations.up(db);

    expect(tableExists(db, "recording_storage_path_migrations")).toBe(true);
    expect(
      indexExists(db, "idx_recording_storage_path_migrations_status"),
    ).toBe(true);
    expect(() =>
      db
        .prepare(
          `
          INSERT INTO recording_storage_path_migrations (
            from_path,
            to_path,
            status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        )
        .run(
          "recordings/Manual Clips/manual.mp4",
          "recordings/Manual Replays/manual.mp4",
          "failed",
          "2026-06-30T00:00:00.000Z",
          "2026-06-30T00:00:00.000Z",
        ),
    ).toThrow();

    migration_20260630_010000_recording_storage_path_migrations.down(db);

    expect(tableExists(db, "recording_storage_path_migrations")).toBe(false);
  });

  it("creates the recording storage path migration journal after settings cleanup was already applied", () => {
    const db = createDatabase();
    const runner = new MigrationRunner(db);

    db.prepare(
      "INSERT INTO migrations (id, description, applied_at) VALUES (?, ?, ?)",
    ).run(
      migration_20260630_000000_settings_cleanup.id,
      migration_20260630_000000_settings_cleanup.description,
      "2026-06-30T00:00:00.000Z",
    );

    runner.runMigrations([
      migration_20260630_000000_settings_cleanup,
      migration_20260630_010000_recording_storage_path_migrations,
    ]);

    expect(tableExists(db, "recording_storage_path_migrations")).toBe(true);
    expect(runner.getAppliedMigrationIds()).toEqual([
      migration_20260630_000000_settings_cleanup.id,
      migration_20260630_010000_recording_storage_path_migrations.id,
    ]);
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
    expect(tableExists(db, "recording_storage_path_migrations")).toBe(false);
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
