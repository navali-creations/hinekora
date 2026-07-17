import type { Migration } from "./Migration.interface";

const migration_20260717_000000_storage_file_deletion_operations: Migration = {
  id: "20260717_000000_storage_file_deletion_operations",
  description: "Add the durable storage file deletion journal",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS storage_file_deletion_operations (
        operation_id TEXT PRIMARY KEY,
        storage_root TEXT NOT NULL,
        committed_at TEXT NOT NULL
      );
    `);
  },
  down(db) {
    db.exec("DROP TABLE IF EXISTS storage_file_deletion_operations;");
  },
};

export { migration_20260717_000000_storage_file_deletion_operations };
