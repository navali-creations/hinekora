import type { DatabaseSync } from "node:sqlite";

import type { Migration } from "./Migration.interface";

const bookmarkLinksActivitySessionTable =
  "bookmark_links_activity_sessions_old";

const migration_20260703_000000_bookmark_activity_sessions: Migration = {
  id: "20260703_000000_bookmark_activity_sessions",
  description: "Add bookmark activity sessions",
  up(db) {
    ensureBookmarkLinksTargetKinds(db, ["recording", "activity-session"]);

    db.exec(`
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

      CREATE INDEX IF NOT EXISTS idx_activity_sessions_game_league_started_at
        ON activity_sessions(source_game, source_league, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_sessions_open
        ON activity_sessions(mode, stopped_at, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_session_clips_session_offset
        ON activity_session_clips(activity_session_id, offset_seconds);
      CREATE INDEX IF NOT EXISTS idx_activity_session_clips_bookmark
        ON activity_session_clips(bookmark_id);
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_activity_session_clips_bookmark;
      DROP INDEX IF EXISTS idx_activity_session_clips_session_offset;
      DROP INDEX IF EXISTS idx_activity_sessions_open;
      DROP INDEX IF EXISTS idx_activity_sessions_game_league_started_at;
      DROP TABLE IF EXISTS activity_session_clips;
      DROP TABLE IF EXISTS activity_sessions;
      DELETE FROM bookmark_links WHERE target_kind = 'activity-session';
    `);

    ensureBookmarkLinksTargetKinds(db, ["recording"]);
  },
};

function ensureBookmarkLinksTargetKinds(
  db: DatabaseSync,
  targetKinds: string[],
): void {
  const row = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bookmark_links'",
    )
    .get() as { sql: string } | undefined;
  if (!row) {
    createBookmarkLinksTable(db, targetKinds);
    return;
  }

  const hasExpectedKinds = targetKinds.every((kind) =>
    row.sql.includes(`'${kind}'`),
  );
  const hasUnexpectedActivityKind =
    !targetKinds.includes("activity-session") &&
    row.sql.includes("'activity-session'");
  if (hasExpectedKinds && !hasUnexpectedActivityKind) {
    return;
  }

  db.exec("PRAGMA foreign_keys = OFF;");
  try {
    db.exec(`
      DROP TABLE IF EXISTS ${bookmarkLinksActivitySessionTable};
      ALTER TABLE bookmark_links RENAME TO ${bookmarkLinksActivitySessionTable};
    `);
    createBookmarkLinksTable(db, targetKinds);
    db.exec(`
      INSERT INTO bookmark_links (
        id,
        bookmark_id,
        target_kind,
        target_id,
        offset_seconds,
        duration_seconds,
        archived,
        archived_target_title,
        archived_target_duration_seconds,
        created_at,
        updated_at
      )
      SELECT
        id,
        bookmark_id,
        target_kind,
        target_id,
        offset_seconds,
        duration_seconds,
        archived,
        archived_target_title,
        archived_target_duration_seconds,
        created_at,
        updated_at
      FROM ${bookmarkLinksActivitySessionTable}
      WHERE target_kind IN (${targetKinds.map((kind) => `'${kind}'`).join(", ")});

      DROP TABLE IF EXISTS ${bookmarkLinksActivitySessionTable};
    `);
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function createBookmarkLinksTable(
  db: DatabaseSync,
  targetKinds: string[],
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmark_links (
      id TEXT PRIMARY KEY,
      bookmark_id TEXT NOT NULL,
      target_kind TEXT NOT NULL CHECK(target_kind IN (${targetKinds.map((kind) => `'${kind}'`).join(", ")})),
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

    CREATE INDEX IF NOT EXISTS idx_bookmark_links_target
      ON bookmark_links(target_kind, target_id, archived);
    CREATE INDEX IF NOT EXISTS idx_bookmark_links_bookmark
      ON bookmark_links(bookmark_id, archived);
  `);
}

export { migration_20260703_000000_bookmark_activity_sessions };
