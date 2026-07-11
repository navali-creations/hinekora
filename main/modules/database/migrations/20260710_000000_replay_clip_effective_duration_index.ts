import type { Migration } from "./Migration.interface";

const replayClipDurationIndexName = "idx_replay_clips_library_duration";
const replayClipDurationUnscopedIndexName =
  "idx_replay_clips_library_duration_unscoped";

const migration_20260710_000000_replay_clip_effective_duration_index: Migration =
  {
    id: "20260710_000000_replay_clip_effective_duration_index",
    description: "Index effective replay clip duration sorting",
    up(db) {
      db.exec(`
      DROP INDEX IF EXISTS ${replayClipDurationIndexName};
      CREATE INDEX IF NOT EXISTS ${replayClipDurationIndexName}
        ON replay_clips(
          source_game,
          source_league,
          kind,
          coalesce(duration_seconds, target_duration_seconds),
          created_at
        );
      CREATE INDEX IF NOT EXISTS ${replayClipDurationUnscopedIndexName}
        ON replay_clips(
          source_game,
          kind,
          coalesce(duration_seconds, target_duration_seconds),
          created_at
        );
    `);
    },
    down(db) {
      db.exec(`
      DROP INDEX IF EXISTS ${replayClipDurationIndexName};
      DROP INDEX IF EXISTS ${replayClipDurationUnscopedIndexName};
      CREATE INDEX IF NOT EXISTS ${replayClipDurationIndexName}
        ON replay_clips(
          source_game,
          source_league,
          kind,
          target_duration_seconds
        );
    `);
    },
  };

export { migration_20260710_000000_replay_clip_effective_duration_index };
