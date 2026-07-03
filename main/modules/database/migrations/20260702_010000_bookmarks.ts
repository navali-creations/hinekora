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
        target_kind TEXT NOT NULL CHECK(target_kind IN ('recording')),
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

      CREATE INDEX IF NOT EXISTS idx_bookmarks_library
        ON bookmarks(source_game, source_league, category, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_dedupe
        ON bookmarks(dedupe_key);
      CREATE INDEX IF NOT EXISTS idx_bookmark_links_target
        ON bookmark_links(target_kind, target_id, archived);
      CREATE INDEX IF NOT EXISTS idx_bookmark_links_bookmark
        ON bookmark_links(bookmark_id, archived);
    `);

    upsertMissingBooleanSetting(db, bookmarkRewindTrackingSettingKey, true);
  },
  down(db) {
    db.exec(`
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

export { migration_20260702_010000_bookmarks };
