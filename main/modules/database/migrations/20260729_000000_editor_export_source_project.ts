import type { DatabaseSync } from "node:sqlite";

import type { Migration } from "./Migration.interface";

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).some((row) => row.name === column);
}

const migration_20260729_000000_editor_export_source_project: Migration = {
  id: "20260729_000000_editor_export_source_project",
  description: "Link saved editor exports to their source draft projects",
  up(db) {
    if (!hasColumn(db, "editor_export_videos", "project_id")) {
      db.exec(`
        ALTER TABLE editor_export_videos
        ADD COLUMN project_id TEXT
          REFERENCES editor_projects(id)
          ON DELETE SET NULL;
      `);
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS editor_export_videos_project_id_idx
        ON editor_export_videos(project_id);
    `);
  },
  down(db) {
    db.exec("DROP INDEX IF EXISTS editor_export_videos_project_id_idx;");
    if (hasColumn(db, "editor_export_videos", "project_id")) {
      db.exec("ALTER TABLE editor_export_videos DROP COLUMN project_id;");
    }
  },
};

export { migration_20260729_000000_editor_export_source_project };
