import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { migration_20260710_000000_replay_clip_effective_duration_index } from "../migrations/20260710_000000_replay_clip_effective_duration_index";

let database: DatabaseSync | null = null;

function createReplayClipsDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE replay_clips (
      id TEXT PRIMARY KEY,
      source_game TEXT NOT NULL,
      source_league TEXT NOT NULL,
      kind TEXT NOT NULL,
      target_duration_seconds REAL NOT NULL,
      duration_seconds REAL,
      created_at TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX idx_replay_clips_library_duration
      ON replay_clips(
        source_game,
        source_league,
        kind,
        target_duration_seconds
      );
  `);
  return database;
}

describe("replay clip effective duration index migration", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("replaces the legacy index idempotently and supports effective duration sorting", () => {
    const db = createReplayClipsDatabase();

    migration_20260710_000000_replay_clip_effective_duration_index.up(db);
    migration_20260710_000000_replay_clip_effective_duration_index.up(db);

    const index = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?",
      )
      .get("idx_replay_clips_library_duration") as { sql: string };
    expect(index.sql.toLowerCase()).toContain(
      "coalesce(duration_seconds, target_duration_seconds)",
    );
    const plan = db
      .prepare(
        `
        EXPLAIN QUERY PLAN
        SELECT *
        FROM replay_clips
        WHERE source_game = 'poe2'
          AND source_league = 'Standard'
          AND kind = 'manual'
        ORDER BY coalesce(duration_seconds, target_duration_seconds) ASC
        LIMIT 50
      `,
      )
      .all() as Array<{ detail: string }>;
    expect(plan.some((row) => row.detail.includes(indexName))).toBe(true);

    const unscopedPlan = db
      .prepare(
        `
        EXPLAIN QUERY PLAN
        SELECT *
        FROM replay_clips
        WHERE source_game = 'poe2'
          AND kind = 'manual'
        ORDER BY coalesce(duration_seconds, target_duration_seconds) ASC,
          created_at ASC
        LIMIT 50
      `,
      )
      .all() as Array<{ detail: string }>;
    expect(
      unscopedPlan.some((row) => row.detail.includes(unscopedIndexName)),
    ).toBe(true);
    expect(unscopedPlan.some((row) => row.detail.includes("TEMP B-TREE"))).toBe(
      false,
    );
  });

  it("restores the legacy index on rollback", () => {
    const db = createReplayClipsDatabase();
    migration_20260710_000000_replay_clip_effective_duration_index.up(db);

    migration_20260710_000000_replay_clip_effective_duration_index.down(db);

    const index = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?",
      )
      .get(indexName) as { sql: string };
    expect(index.sql.toLowerCase()).not.toContain("coalesce");
    expect(index.sql).toContain("target_duration_seconds");
    const unscopedIndex = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?",
      )
      .get(unscopedIndexName);
    expect(unscopedIndex).toBeUndefined();
  });
});

const indexName = "idx_replay_clips_library_duration";
const unscopedIndexName = "idx_replay_clips_library_duration_unscoped";
