import { afterEach, describe, expect, it } from "vitest";

import { migration_20260906_000000_overlay_capture_preference } from "../migrations/20260906_000000_overlay_capture_preference";
import {
  insertSetting,
  MigrationTestDatabase,
  readSettings,
} from "./MigrationRunner.test-utils";

const databases = new MigrationTestDatabase();

describe("overlay capture preference migration", () => {
  afterEach(() => {
    databases.close();
  });

  it("does nothing when the settings table does not exist", () => {
    const db = databases.createEmptyDatabase();

    expect(() =>
      migration_20260906_000000_overlay_capture_preference.up(db),
    ).not.toThrow();
    expect(() =>
      migration_20260906_000000_overlay_capture_preference.down(db),
    ).not.toThrow();
  });

  it.each([
    true,
    false,
  ])("renames a legacy %s value and remains idempotent", (legacyValue) => {
    const db = databases.createSettingsDatabase();
    insertSetting(db, "auraOverlayIncludeInCaptures", legacyValue);

    migration_20260906_000000_overlay_capture_preference.up(db);
    migration_20260906_000000_overlay_capture_preference.up(db);

    expect(readSettings(db)).toEqual({
      overlayWindowsIncludeInCaptures: legacyValue,
    });
  });

  it("preserves a valid current value and removes the legacy duplicate", () => {
    const db = databases.createSettingsDatabase();
    insertSetting(db, "overlayWindowsIncludeInCaptures", false);
    insertSetting(db, "auraOverlayIncludeInCaptures", true);

    migration_20260906_000000_overlay_capture_preference.up(db);

    expect(readSettings(db)).toEqual({
      overlayWindowsIncludeInCaptures: false,
    });
  });

  it("recovers malformed values and is reversibly idempotent", () => {
    const db = databases.createSettingsDatabase();
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run(
      "overlayWindowsIncludeInCaptures",
      "{bad",
      "2026-09-01T00:00:00.000Z",
    );
    insertSetting(db, "auraOverlayIncludeInCaptures", true);

    migration_20260906_000000_overlay_capture_preference.up(db);
    expect(readSettings(db)).toEqual({
      overlayWindowsIncludeInCaptures: true,
    });

    migration_20260906_000000_overlay_capture_preference.down(db);
    migration_20260906_000000_overlay_capture_preference.down(db);
    expect(readSettings(db)).toEqual({
      auraOverlayIncludeInCaptures: true,
    });
  });

  it("defaults to false when no valid value exists", () => {
    const db = databases.createSettingsDatabase();
    insertSetting(db, "auraOverlayIncludeInCaptures", "invalid");

    migration_20260906_000000_overlay_capture_preference.up(db);

    expect(readSettings(db)).toEqual({
      overlayWindowsIncludeInCaptures: false,
    });
  });

  it("backfills a missing preference with the current default", () => {
    const db = databases.createSettingsDatabase();

    migration_20260906_000000_overlay_capture_preference.up(db);

    expect(readSettings(db)).toEqual({
      overlayWindowsIncludeInCaptures: false,
    });
  });

  it.each([
    { expected: true, legacyValue: true },
    { expected: false, legacyValue: undefined },
  ])("rolls a malformed current value back to $expected", ({
    expected,
    legacyValue,
  }) => {
    const db = databases.createSettingsDatabase();
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run(
      "overlayWindowsIncludeInCaptures",
      "{bad",
      "2026-09-01T00:00:00.000Z",
    );
    if (legacyValue !== undefined) {
      insertSetting(db, "auraOverlayIncludeInCaptures", legacyValue);
    }

    migration_20260906_000000_overlay_capture_preference.down(db);

    expect(readSettings(db)).toEqual({
      auraOverlayIncludeInCaptures: expected,
    });
  });
});
