import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { migration_20260904_000000_media_frame_rates } from "../migrations/20260904_000000_media_frame_rates";
import { columnNames } from "./MigrationRunner.test-utils";

let database: DatabaseSync | null = null;

function createLegacyMediaDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE replay_clips (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL
    );
    CREATE TABLE run_recordings (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL
    );
    INSERT INTO replay_clips (id, status) VALUES ('clip-1', 'ready');
    INSERT INTO run_recordings (id, path) VALUES ('recording-1', 'run.mp4');
  `);
  return database;
}

describe("media frame rates migration", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("keeps legacy media nullable, validates new rates, and is reversible", () => {
    const db = createLegacyMediaDatabase();

    migration_20260904_000000_media_frame_rates.up(db);
    migration_20260904_000000_media_frame_rates.up(db);

    expect(columnNames(db, "replay_clips")).toContain("frames_per_second");
    expect(columnNames(db, "run_recordings")).toContain("frames_per_second");
    expect(
      db.prepare("SELECT frames_per_second FROM replay_clips").get(),
    ).toEqual({ frames_per_second: null });
    expect(
      db.prepare("SELECT frames_per_second FROM run_recordings").get(),
    ).toEqual({ frames_per_second: null });

    db.prepare(
      "UPDATE replay_clips SET frames_per_second = 60 WHERE id = 'clip-1'",
    ).run();
    db.prepare(
      "UPDATE run_recordings SET frames_per_second = 30 WHERE id = 'recording-1'",
    ).run();
    expect(() =>
      db.prepare("UPDATE replay_clips SET frames_per_second = 0").run(),
    ).toThrow();
    expect(() =>
      db.prepare("UPDATE run_recordings SET frames_per_second = 241").run(),
    ).toThrow();
    expect(() =>
      db.prepare("UPDATE replay_clips SET frames_per_second = 60.5").run(),
    ).toThrow();
    expect(() =>
      db.prepare("UPDATE run_recordings SET frames_per_second = 59.94").run(),
    ).toThrow();

    migration_20260904_000000_media_frame_rates.down(db);
    migration_20260904_000000_media_frame_rates.down(db);

    expect(columnNames(db, "replay_clips")).not.toContain("frames_per_second");
    expect(columnNames(db, "run_recordings")).not.toContain(
      "frames_per_second",
    );
  });
});
