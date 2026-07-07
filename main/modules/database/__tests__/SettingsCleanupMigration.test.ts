import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { appSettingsKeys } from "~/types";
import { migration_20260630_000000_settings_cleanup } from "../migrations/20260630_000000_settings_cleanup";
import { migration_20260702_010000_bookmarks } from "../migrations/20260702_010000_bookmarks";
import { migration_20260707_000000_keybind_settings } from "../migrations/20260707_000000_keybind_settings";
import { insertSetting, readSettings } from "./MigrationRunner.test-utils";

let database: DatabaseSync | null = null;

function createDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  return database;
}

describe("Settings cleanup migration", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("cleans obsolete settings and preserves explicit split overlay settings", () => {
    const db = createDatabase();
    const updatedAt = "2026-06-30T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const insertSetting = db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    );
    insertSetting.run(
      "recordingHideOverlaysFromCapture",
      JSON.stringify(false),
      updatedAt,
    );
    insertSetting.run(
      "recordingHideOverlaysFromRecording",
      JSON.stringify(true),
      updatedAt,
    );
    insertSetting.run(
      "recordingHideOverlaysFromRewind",
      JSON.stringify(true),
      updatedAt,
    );
    insertSetting.run("deathClipSeconds", JSON.stringify(120), updatedAt);
    insertSetting.run("activeGame", JSON.stringify("poe2"), updatedAt);
    insertSetting.run(
      "recordingAutoStartMode",
      JSON.stringify("recording"),
      updatedAt,
    );
    insertSetting.run(
      "selectedProfileId",
      JSON.stringify("profile-1"),
      updatedAt,
    );
    insertSetting.run(
      "selectedCaptureProfileIdsByGame",
      JSON.stringify({ poe1: null, poe2: "capture-profile-2" }),
      updatedAt,
    );
    insertSetting.run(
      "obsoleteSetting",
      JSON.stringify("remove me"),
      updatedAt,
    );

    migration_20260630_000000_settings_cleanup.up(db);
    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toMatchObject({
      activeGame: "poe2",
      deathClipSeconds: 60,
      recordingAutoStartMode: "recording",
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
      selectedCaptureProfileIdsByGame: {
        poe1: null,
        poe2: "capture-profile-2",
      },
      selectedProfileId: "profile-1",
    });
    expect(readSettings(db)).not.toHaveProperty(
      "recordingHideOverlaysFromCapture",
    );
    expect(readSettings(db)).not.toHaveProperty("obsoleteSetting");
  });

  it("backfills both split overlay settings from the obsolete combined setting", () => {
    const db = createDatabase();
    const updatedAt = "2026-06-30T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("recordingHideOverlaysFromCapture", JSON.stringify(true), updatedAt);

    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toMatchObject({
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
    });
  });

  it("resets malformed and invalid current settings while pruning obsolete settings", () => {
    const db = createDatabase();
    const updatedAt = "2026-06-30T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const insertSetting = db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    );
    insertSetting.run("recordingHideOverlaysFromCapture", "{bad", updatedAt);
    insertSetting.run("deathClipSeconds", "{bad", updatedAt);
    insertSetting.run("recordingHideOverlaysFromRecording", "{bad", updatedAt);
    insertSetting.run("activeGame", JSON.stringify("poe3"), updatedAt);
    insertSetting.run("recordingMaxStorageGb", JSON.stringify(25), updatedAt);
    insertSetting.run("mainWindowBounds", JSON.stringify({ x: 0 }), updatedAt);
    insertSetting.run(
      "recorderOverlayBounds",
      JSON.stringify({ x: 0 }),
      updatedAt,
    );
    insertSetting.run(
      "onboardingDismissedBeacons",
      JSON.stringify(["x".repeat(129)]),
      updatedAt,
    );
    insertSetting.run(
      "recordingAudioInputDeviceId",
      JSON.stringify(""),
      updatedAt,
    );
    insertSetting.run(
      "recordingAudioOutputDeviceId",
      JSON.stringify("x".repeat(513)),
      updatedAt,
    );
    insertSetting.run(
      "selectedCaptureProfileId",
      JSON.stringify(""),
      updatedAt,
    );
    insertSetting.run(
      "selectedCaptureProfileIdsByGame",
      JSON.stringify(["default-capture-poe1"]),
      updatedAt,
    );
    insertSetting.run("lastSeenAppVersion", JSON.stringify(""), updatedAt);
    insertSetting.run("poe1ClientTxtPath", JSON.stringify(42), updatedAt);
    insertSetting.run(
      "poe2ClientTxtPath",
      JSON.stringify("x".repeat(2_049)),
      updatedAt,
    );

    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toMatchObject({
      activeGame: "poe1",
      deathClipSeconds: 10,
      mainWindowBounds: null,
      onboardingDismissedBeacons: [],
      poe1ClientTxtPath: null,
      poe2ClientTxtPath: null,
      recorderOverlayBounds: null,
      recordingAudioInputDeviceId: null,
      recordingAudioOutputDeviceId: null,
      recordingHideOverlaysFromRecording: true,
      recordingMaxStorageGb: 25,
      selectedCaptureProfileId: null,
      selectedCaptureProfileIdsByGame: {},
      lastSeenAppVersion: null,
    });
    expect(readSettings(db)).not.toHaveProperty(
      "recordingHideOverlaysFromCapture",
    );
  });

  it("resets invalid capture profile selection memory game keys", () => {
    const db = createDatabase();
    const updatedAt = "2026-06-30T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    insertSetting(
      db,
      "selectedCaptureProfileIdsByGame",
      { poe3: "profile-1" },
      updatedAt,
    );

    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toMatchObject({
      selectedCaptureProfileIdsByGame: {},
    });
  });

  it("backfills missing current settings idempotently", () => {
    const db = createDatabase();

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    migration_20260630_000000_settings_cleanup.up(db);
    migration_20260702_010000_bookmarks.up(db);
    migration_20260707_000000_keybind_settings.up(db);
    migration_20260630_000000_settings_cleanup.up(db);
    migration_20260702_010000_bookmarks.up(db);
    migration_20260707_000000_keybind_settings.up(db);

    const settings = readSettings(db);

    expect(new Set(Object.keys(settings))).toEqual(new Set(appSettingsKeys));
    expect(settings).toMatchObject({
      activeGame: "poe1",
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
      recordingAutoStartMode: "off",
      selectedCaptureProfileId: null,
      selectedProfileId: null,
      keybindManualBookmark: "Alt+B",
      keybindManualReplay: "Alt+C",
    });
  });

  it("preserves valid startup settings during settings cleanup", () => {
    const db = createDatabase();
    const updatedAt = "2026-07-01T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("recordingAutoStartMode", JSON.stringify("rewind"), updatedAt);
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("selectedProfileId", JSON.stringify("profile-1"), updatedAt);
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run(
      "mainWindowBounds",
      JSON.stringify({ x: 0, y: 0, width: 1200, height: 800 }),
      updatedAt,
    );
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run(
      "recorderOverlayBounds",
      JSON.stringify({ x: 0, y: 0, width: 236, height: 42 }),
      updatedAt,
    );
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("recordingAudioInputDeviceId", JSON.stringify("mic-1"), updatedAt);
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run(
      "recordingAudioOutputDeviceId",
      JSON.stringify("desktop-1"),
      updatedAt,
    );
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("selectedCaptureProfileId", JSON.stringify("capture-1"), updatedAt);
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("lastSeenAppVersion", JSON.stringify("0.6.0"), updatedAt);

    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toMatchObject({
      lastSeenAppVersion: "0.6.0",
      mainWindowBounds: { x: 0, y: 0, width: 1200, height: 800 },
      recorderOverlayBounds: { x: 0, y: 0, width: 236, height: 42 },
      recordingAudioInputDeviceId: "mic-1",
      recordingAudioOutputDeviceId: "desktop-1",
      recordingAutoStartMode: "rewind",
      selectedCaptureProfileId: "capture-1",
      selectedProfileId: "profile-1",
    });
  });

  it("resets invalid startup settings during settings cleanup", () => {
    const db = createDatabase();
    const updatedAt = "2026-07-01T00:00:00.000Z";

    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("recordingAutoStartMode", JSON.stringify("session"), updatedAt);
    db.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)",
    ).run("selectedProfileId", JSON.stringify(""), updatedAt);

    migration_20260630_000000_settings_cleanup.up(db);

    expect(readSettings(db)).toMatchObject({
      recordingAutoStartMode: "off",
      selectedCaptureProfileIdsByGame: {},
      selectedProfileId: null,
    });
  });
});
