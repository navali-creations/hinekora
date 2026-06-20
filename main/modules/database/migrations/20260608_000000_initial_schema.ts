import type { Migration } from "./Migration.interface";

const migration_20260608_000000_initial_schema: Migration = {
  id: "20260608_000000_initial_schema",
  description: "Create initial Hinekora persistence schema",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        game TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS replay_clips (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL DEFAULT 'death',
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

      CREATE TABLE IF NOT EXISTS run_recordings (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        source_game TEXT NOT NULL,
        source_league TEXT NOT NULL,
        started_at TEXT NOT NULL,
        stopped_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_replay_clips_created_at
        ON replay_clips(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_replay_clips_game_league_created_at
        ON replay_clips(source_game, source_league, created_at DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_run_recordings_path
        ON run_recordings(path);

      CREATE INDEX IF NOT EXISTS idx_run_recordings_game_league_created_at
        ON run_recordings(source_game, source_league, created_at DESC);
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_run_recordings_game_league_created_at;
      DROP INDEX IF EXISTS idx_run_recordings_path;
      DROP INDEX IF EXISTS idx_replay_clips_game_league_created_at;
      DROP INDEX IF EXISTS idx_replay_clips_created_at;
      DROP TABLE IF EXISTS run_recordings;
      DROP TABLE IF EXISTS replay_clips;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS profiles;
    `);
  },
};

export { migration_20260608_000000_initial_schema };
