import type { Migration } from "./Migration.interface";

const migration_20260618_000000_replay_clip_kind: Migration = {
  id: "20260618_000000_replay_clip_kind",
  description: "Add replay clip kind",
  up(db) {
    const columns = db
      .prepare("PRAGMA table_info(replay_clips)")
      .all() as Array<{
      name: string;
    }>;
    const hasKindColumn = columns.some((column) => column.name === "kind");
    if (!hasKindColumn) {
      db.exec(
        "ALTER TABLE replay_clips ADD COLUMN kind TEXT NOT NULL DEFAULT 'death'",
      );
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_replay_clips_kind_game_league_created_at
        ON replay_clips(kind, source_game, source_league, created_at DESC);
    `);
  },
  down(db) {
    db.exec(
      "DROP INDEX IF EXISTS idx_replay_clips_kind_game_league_created_at",
    );
  },
};

export { migration_20260618_000000_replay_clip_kind };
