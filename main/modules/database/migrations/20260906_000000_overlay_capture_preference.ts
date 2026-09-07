import type { DatabaseSync } from "node:sqlite";

import type { Migration } from "./Migration.interface";

const legacySettingKey = "auraOverlayIncludeInCaptures";
const settingKey = "overlayWindowsIncludeInCaptures";
const migrationUpdatedAt = "2026-09-06T00:00:00.000Z";

interface SettingRow {
  updated_at: string;
  value_json: string;
}

function hasSettingsTable(db: DatabaseSync): boolean {
  return (
    db
      .prepare(
        "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
      )
      .get() !== undefined
  );
}

function readSetting(db: DatabaseSync, key: string): SettingRow | null {
  return (
    (db
      .prepare("SELECT value_json, updated_at FROM settings WHERE key = ?")
      .get(key) as SettingRow | undefined) ?? null
  );
}

function readBoolean(row: SettingRow | null): boolean | null {
  if (!row) {
    return null;
  }

  try {
    const value = JSON.parse(row.value_json) as unknown;
    return typeof value === "boolean" ? value : null;
  } catch {
    return null;
  }
}

function writeSetting(
  db: DatabaseSync,
  key: string,
  value: boolean,
  updatedAt: string,
): void {
  db.prepare(
    `
      INSERT INTO settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `,
  ).run(key, JSON.stringify(value), updatedAt);
}

function deleteSetting(db: DatabaseSync, key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

const migration_20260906_000000_overlay_capture_preference: Migration = {
  id: "20260906_000000_overlay_capture_preference",
  description: "Rename the global overlay capture preference",
  up(db) {
    if (!hasSettingsTable(db)) {
      return;
    }

    const current = readSetting(db, settingKey);
    const legacy = readSetting(db, legacySettingKey);
    const currentValue = readBoolean(current);
    const legacyValue = readBoolean(legacy);
    const value = currentValue ?? legacyValue ?? false;
    const updatedAt =
      (currentValue !== null ? current?.updated_at : legacy?.updated_at) ??
      migrationUpdatedAt;

    writeSetting(db, settingKey, value, updatedAt);
    deleteSetting(db, legacySettingKey);
  },
  down(db) {
    if (!hasSettingsTable(db)) {
      return;
    }

    const current = readSetting(db, settingKey);
    if (!current) {
      return;
    }

    const currentValue = readBoolean(current);
    const legacy = readSetting(db, legacySettingKey);
    const value = currentValue ?? readBoolean(legacy) ?? false;
    const updatedAt =
      (currentValue !== null ? current.updated_at : legacy?.updated_at) ??
      migrationUpdatedAt;

    writeSetting(db, legacySettingKey, value, updatedAt);
    deleteSetting(db, settingKey);
  },
};

export { migration_20260906_000000_overlay_capture_preference };
