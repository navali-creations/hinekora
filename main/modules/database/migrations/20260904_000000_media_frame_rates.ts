import type { DatabaseSync } from "node:sqlite";

import type { Migration } from "./Migration.interface";

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).some((row) => row.name === column);
}

const migration_20260904_000000_media_frame_rates: Migration = {
  id: "20260904_000000_media_frame_rates",
  description: "Store the effective frame rate of newly captured media",
  up(db) {
    if (!hasColumn(db, "replay_clips", "frames_per_second")) {
      db.exec(`
        ALTER TABLE replay_clips
        ADD COLUMN frames_per_second INTEGER
          CHECK (
            frames_per_second IS NULL OR
            (
              typeof(frames_per_second) = 'integer' AND
              frames_per_second BETWEEN 1 AND 240
            )
          );
      `);
    }
    if (!hasColumn(db, "run_recordings", "frames_per_second")) {
      db.exec(`
        ALTER TABLE run_recordings
        ADD COLUMN frames_per_second INTEGER
          CHECK (
            frames_per_second IS NULL OR
            (
              typeof(frames_per_second) = 'integer' AND
              frames_per_second BETWEEN 1 AND 240
            )
          );
      `);
    }
  },
  down(db) {
    if (hasColumn(db, "run_recordings", "frames_per_second")) {
      db.exec("ALTER TABLE run_recordings DROP COLUMN frames_per_second;");
    }
    if (hasColumn(db, "replay_clips", "frames_per_second")) {
      db.exec("ALTER TABLE replay_clips DROP COLUMN frames_per_second;");
    }
  },
};

export { migration_20260904_000000_media_frame_rates };
