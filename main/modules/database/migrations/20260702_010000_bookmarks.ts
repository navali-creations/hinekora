import type { DatabaseSync } from "node:sqlite";

import type { Migration } from "./Migration.interface";

const bookmarkRewindTrackingSettingKey = "recordingTrackBookmarksInRewind";
const defaultSettingsUpdatedAt = "2026-07-02T00:00:00.000Z";

const migration_20260702_010000_bookmarks: Migration = {
  id: "20260702_010000_bookmarks",
  description: "Add gameplay bookmarks",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        source_game TEXT NOT NULL CHECK(source_game IN ('poe1', 'poe2')),
        source_league TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('client-log', 'manual', 'system')),
        category TEXT NOT NULL CHECK(category IN (
          'boss',
          'death',
          'hideout',
          'manual',
          'map',
          'pinnacle',
          'rewind-manual-replay',
          'town'
        )),
        subcategory TEXT CHECK(subcategory IS NULL OR subcategory IN (
          'abyss-depths',
          'trial'
        )),
        label TEXT NOT NULL,
        scene_name TEXT,
        note TEXT,
        occurred_at TEXT NOT NULL,
        dedupe_key TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookmark_links (
        id TEXT PRIMARY KEY,
        bookmark_id TEXT NOT NULL,
        target_kind TEXT NOT NULL CHECK(target_kind IN ('recording', 'activity-session')),
        target_id TEXT NOT NULL,
        offset_seconds REAL,
        duration_seconds REAL,
        archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
        archived_target_title TEXT,
        archived_target_duration_seconds REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
        UNIQUE(bookmark_id, target_kind, target_id)
      );

      CREATE TABLE IF NOT EXISTS activity_sessions (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK(mode IN ('rewind')),
        source_game TEXT NOT NULL CHECK(source_game IN ('poe1', 'poe2')),
        source_league TEXT NOT NULL,
        started_at TEXT NOT NULL,
        stopped_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_session_clips (
        id TEXT PRIMARY KEY,
        activity_session_id TEXT NOT NULL,
        target_kind TEXT NOT NULL CHECK(target_kind IN ('replay-clip')),
        target_id TEXT NOT NULL,
        bookmark_id TEXT,
        offset_seconds REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(activity_session_id) REFERENCES activity_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE SET NULL,
        UNIQUE(activity_session_id, target_kind, target_id)
      );

      CREATE INDEX IF NOT EXISTS idx_bookmarks_library
        ON bookmarks(source_game, source_league, category, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_game_occurred_at
        ON bookmarks(source_game, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmark_links_target_offset
        ON bookmark_links(target_kind, target_id, archived, offset_seconds);
      CREATE INDEX IF NOT EXISTS idx_bookmark_links_bookmark
        ON bookmark_links(bookmark_id, target_kind, archived);
      CREATE INDEX IF NOT EXISTS idx_activity_sessions_game_league_started_at
        ON activity_sessions(source_game, source_league, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_sessions_open
        ON activity_sessions(mode, stopped_at, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_session_clips_session_offset
        ON activity_session_clips(activity_session_id, offset_seconds);
      CREATE INDEX IF NOT EXISTS idx_activity_session_clips_bookmark
        ON activity_session_clips(bookmark_id);
    `);

    if (
      hasTable(db, "replay_clips") &&
      !hasColumn(db, "replay_clips", "duration_seconds")
    ) {
      db.exec("ALTER TABLE replay_clips ADD COLUMN duration_seconds REAL");
    }

    upsertMissingBooleanSetting(db, bookmarkRewindTrackingSettingKey, true);
  },
  down(db) {
    db.exec(`
      DROP TABLE IF EXISTS activity_session_clips;
      DROP TABLE IF EXISTS activity_sessions;
      DROP TABLE IF EXISTS bookmark_links;
      DROP TABLE IF EXISTS bookmarks;
    `);
  },
};

function upsertMissingBooleanSetting(
  db: DatabaseSync,
  key: string,
  value: boolean,
): void {
  db.prepare(
    `
      INSERT INTO settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO NOTHING
    `,
  ).run(key, JSON.stringify(value), defaultSettingsUpdatedAt);
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;

  return rows.some((row) => row.name === column);
}

function hasTable(db: DatabaseSync, table: string): boolean {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `,
    )
    .get(table) as { name: string } | undefined;

  return row?.name === table;
}

export { migration_20260702_010000_bookmarks };
