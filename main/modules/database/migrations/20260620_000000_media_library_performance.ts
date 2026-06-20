import type { Migration } from "./Migration.interface";

function hasColumn(
  db: Parameters<Migration["up"]>[0],
  table: string,
  columnName: string,
): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;

  return columns.some((column) => column.name === columnName);
}

const migration_20260620_000000_media_library_performance: Migration = {
  id: "20260620_000000_media_library_performance",
  description: "Add cached media library metadata",
  up(db) {
    if (!hasColumn(db, "replay_clips", "size_bytes")) {
      db.exec(
        "ALTER TABLE replay_clips ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!hasColumn(db, "run_recordings", "file_name")) {
      db.exec(
        "ALTER TABLE run_recordings ADD COLUMN file_name TEXT NOT NULL DEFAULT ''",
      );
    }
    if (!hasColumn(db, "run_recordings", "duration_seconds")) {
      db.exec("ALTER TABLE run_recordings ADD COLUMN duration_seconds INTEGER");
    }
    if (!hasColumn(db, "run_recordings", "size_bytes")) {
      db.exec(
        "ALTER TABLE run_recordings ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!hasColumn(db, "run_recordings", "exists_on_disk")) {
      db.exec(
        "ALTER TABLE run_recordings ADD COLUMN exists_on_disk INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!hasColumn(db, "run_recordings", "mtime_ms")) {
      db.exec(
        "ALTER TABLE run_recordings ADD COLUMN mtime_ms INTEGER NOT NULL DEFAULT 0",
      );
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_replay_clips_kind_game_league_size
        ON replay_clips(kind, source_game, source_league, size_bytes DESC);

      CREATE INDEX IF NOT EXISTS idx_run_recordings_game_league_size
        ON run_recordings(source_game, source_league, size_bytes DESC);

      CREATE INDEX IF NOT EXISTS idx_run_recordings_game_league_duration
        ON run_recordings(source_game, source_league, duration_seconds);

      CREATE INDEX IF NOT EXISTS idx_run_recordings_cleanup
        ON run_recordings(exists_on_disk, mtime_ms);
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_run_recordings_cleanup;
      DROP INDEX IF EXISTS idx_run_recordings_game_league_duration;
      DROP INDEX IF EXISTS idx_run_recordings_game_league_size;
      DROP INDEX IF EXISTS idx_replay_clips_kind_game_league_size;
    `);
  },
};

export { migration_20260620_000000_media_library_performance };
