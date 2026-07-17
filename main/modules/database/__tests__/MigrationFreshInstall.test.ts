import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../migrations";
import {
  columnNames,
  indexColumns,
  indexExists,
  tableExists,
} from "./MigrationRunner.test-utils";

let database: DatabaseSync | null = null;

function createDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  return database;
}

describe("Hinekora fresh-install migrations", () => {
  afterEach(() => {
    database?.close();
    database = null;
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
    expect(tableExists(db, "storage_file_deletion_operations")).toBe(true);
    expect(tableExists(db, "editor_projects")).toBe(true);
    expect(tableExists(db, "editor_project_source_leagues")).toBe(true);
    expect(tableExists(db, "poe_leagues")).toBe(true);
    expect(tableExists(db, "poe_league_sync_state")).toBe(true);
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
    expect(indexExists(db, "idx_activity_sessions_game_started_at")).toBe(true);
    expect(columnNames(db, "activity_sessions")).toEqual(
      expect.arrayContaining(["bookmark_count", "clip_count"]),
    );
    expect(indexExists(db, "idx_activity_sessions_game_bookmark_count")).toBe(
      true,
    );
    expect(indexExists(db, "idx_activity_sessions_game_clip_count")).toBe(true);
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
    expect(indexExists(db, "idx_poe_leagues_game_active")).toBe(true);
    expect(indexColumns(db, "idx_editor_project_source_leagues_scope")).toEqual(
      [
        { desc: false, name: "source_game" },
        { desc: false, name: "source_league" },
        { desc: false, name: "project_id" },
      ],
    );
  });
});
