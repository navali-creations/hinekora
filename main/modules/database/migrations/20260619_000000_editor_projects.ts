import type { Migration } from "./Migration.interface";

const migration_20260619_000000_editor_projects: Migration = {
  id: "20260619_000000_editor_projects",
  description: "Add persisted editor projects",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS editor_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration_seconds REAL NOT NULL,
        clip_count INTEGER NOT NULL,
        project_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_editor_projects_updated_at
        ON editor_projects(updated_at DESC);
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_editor_projects_updated_at;
      DROP TABLE IF EXISTS editor_projects;
    `);
  },
};

export { migration_20260619_000000_editor_projects };
