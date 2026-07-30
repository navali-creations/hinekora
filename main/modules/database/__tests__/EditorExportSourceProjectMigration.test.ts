import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { migration_20260619_000000_editor_projects } from "../migrations/20260619_000000_editor_projects";
import { migration_20260723_000000_editor_export_videos } from "../migrations/20260723_000000_editor_export_videos";
import { migration_20260729_000000_editor_export_source_project } from "../migrations/20260729_000000_editor_export_source_project";
import { columnNames, indexExists } from "./MigrationRunner.test-utils";

let database: DatabaseSync | null = null;

function createDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  return database;
}

describe("Editor export source project migration", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("adds the nullable project relation idempotently and rolls it back", () => {
    const db = createDatabase();
    migration_20260619_000000_editor_projects.up(db);
    migration_20260723_000000_editor_export_videos.up(db);

    migration_20260729_000000_editor_export_source_project.up(db);
    migration_20260729_000000_editor_export_source_project.up(db);

    expect(columnNames(db, "editor_export_videos")).toContain("project_id");
    expect(indexExists(db, "editor_export_videos_project_id_idx")).toBe(true);

    db.prepare(`
      INSERT INTO editor_projects (
        id,
        title,
        duration_seconds,
        clip_count,
        project_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "project-1",
      "Boss edit",
      12,
      1,
      "{}",
      "2026-07-29T00:00:00.000Z",
      "2026-07-29T00:00:00.000Z",
    );
    db.prepare(`
      INSERT INTO editor_export_videos (
        path,
        device_id,
        inode,
        size_bytes,
        modified_at_ms,
        created_at,
        updated_at,
        project_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "C:\\Exports\\boss.mp4",
      1,
      2,
      3,
      4,
      "2026-07-29T00:00:00.000Z",
      "2026-07-29T00:00:00.000Z",
      "project-1",
    );

    db.prepare("DELETE FROM editor_projects WHERE id = ?").run("project-1");
    expect(
      db
        .prepare("SELECT project_id FROM editor_export_videos WHERE path = ?")
        .get("C:\\Exports\\boss.mp4"),
    ).toEqual({ project_id: null });

    migration_20260729_000000_editor_export_source_project.down(db);

    expect(columnNames(db, "editor_export_videos")).not.toContain("project_id");
    expect(indexExists(db, "editor_export_videos_project_id_idx")).toBe(false);
  });
});
