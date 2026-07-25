import type { Migration } from "./Migration.interface";

const migration_20260723_000000_editor_export_videos: Migration = {
  id: "20260723_000000_editor_export_videos",
  description: "Track editor export videos owned by Hinekora",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS editor_export_videos (
        path TEXT PRIMARY KEY,
        device_id INTEGER NOT NULL,
        inode INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL,
        modified_at_ms INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS editor_export_videos_updated_at_idx
        ON editor_export_videos(updated_at);
    `);
  },
  down(db) {
    db.exec("DROP TABLE IF EXISTS editor_export_videos;");
  },
};

export { migration_20260723_000000_editor_export_videos };
