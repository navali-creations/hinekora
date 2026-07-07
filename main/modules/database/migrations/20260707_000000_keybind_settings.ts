import type { DatabaseSync } from "node:sqlite";

import type { Migration } from "./Migration.interface";

const defaultSettingsUpdatedAt = "2026-07-07T00:00:00.000Z";
const keybindSettings = [
  ["keybindManualBookmark", "Alt+B"],
  ["keybindManualReplay", "Alt+C"],
] as const;

const migration_20260707_000000_keybind_settings: Migration = {
  id: "20260707_000000_keybind_settings",
  description: "Add default global keybind settings",
  up(db) {
    for (const [key, value] of keybindSettings) {
      upsertMissingStringSetting(db, key, value);
    }
  },
  down(db) {
    const deleteSetting = db.prepare(
      `
        DELETE FROM settings
        WHERE key = ? AND value_json = ? AND updated_at = ?
      `,
    );

    for (const [key, value] of keybindSettings) {
      deleteSetting.run(key, JSON.stringify(value), defaultSettingsUpdatedAt);
    }
  },
};

function upsertMissingStringSetting(
  db: DatabaseSync,
  key: string,
  value: string,
): void {
  db.prepare(
    `
      INSERT INTO settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO NOTHING
    `,
  ).run(key, JSON.stringify(value), defaultSettingsUpdatedAt);
}

export { migration_20260707_000000_keybind_settings };
