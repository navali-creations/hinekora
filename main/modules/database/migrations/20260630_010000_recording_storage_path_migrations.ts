import type { Migration } from "./Migration.interface";

const migration_20260630_010000_recording_storage_path_migrations: Migration = {
  id: "20260630_010000_recording_storage_path_migrations",
  description: "Add recording storage path migration journal",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS recording_storage_path_migrations (
        from_path TEXT PRIMARY KEY,
        to_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'completed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recording_storage_path_migrations_status
        ON recording_storage_path_migrations(status, created_at);
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_recording_storage_path_migrations_status;
      DROP TABLE IF EXISTS recording_storage_path_migrations;
    `);
  },
};

export { migration_20260630_010000_recording_storage_path_migrations };
