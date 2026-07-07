import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { migration_20260707_000000_keybind_settings } from "../migrations/20260707_000000_keybind_settings";
import { insertSetting, readSettings } from "./MigrationRunner.test-utils";

let database: DatabaseSync | null = null;

function createDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  return database;
}

describe("Keybind settings migration", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("backfills default keybind settings without overwriting user values", () => {
    const db = createDatabase();

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    insertSetting(db, "keybindManualBookmark", "Ctrl+M");

    migration_20260707_000000_keybind_settings.up(db);
    migration_20260707_000000_keybind_settings.up(db);

    expect(readSettings(db)).toMatchObject({
      keybindManualBookmark: "Ctrl+M",
      keybindManualReplay: "Alt+C",
    });

    migration_20260707_000000_keybind_settings.down(db);

    expect(readSettings(db)).toEqual({
      keybindManualBookmark: "Ctrl+M",
    });
  });
});
