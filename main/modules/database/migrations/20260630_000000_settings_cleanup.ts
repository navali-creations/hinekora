import {
  type AppSettingsKey,
  AppSettingsSchema,
  createDefaultSettings,
} from "~/types";
import type { Migration } from "./Migration.interface";

type Database = Parameters<Migration["up"]>[0];
const invalidSettingValue = Symbol("invalidSettingValue");

const legacyOverlayCaptureSettingKey = "recordingHideOverlaysFromCapture";
const recordingOverlayCaptureSettingKey = "recordingHideOverlaysFromRecording";
const rewindOverlayCaptureSettingKey = "recordingHideOverlaysFromRewind";
const deathClipSecondsSettingKey = "deathClipSeconds";
const minRewindSaveSeconds = 1;
const maxRewindSaveSeconds = 60;
const defaultRewindSaveSeconds = 10;
const validSettingKeyMap = {
  activeGame: true,
  activeLeague: true,
  appCloseBehavior: true,
  appLaunchOnStartup: true,
  appStartMinimized: true,
  captureModeInfoAlertDismissed: true,
  deathClipSeconds: true,
  editorAutoPruneProjects: true,
  groupPlayDeathAlertDismissed: true,
  installedGames: true,
  lastSeenAppVersion: true,
  mainWindowBounds: true,
  onboardingDismissedBeacons: true,
  poe1CharacterName: true,
  poe1ClientTxtPath: true,
  poe1SelectedLeague: true,
  poe2CharacterName: true,
  poe2ClientTxtPath: true,
  poe2SelectedLeague: true,
  recorderOverlayBounds: true,
  recorderSettingsInfoAlertDismissed: true,
  recordingAudioInputDeviceId: true,
  recordingAudioOutputDeviceId: true,
  recordingClipQuality: true,
  recordingEncoder: true,
  recordingFps: true,
  recordingHideOverlaysFromRecording: true,
  recordingHideOverlaysFromRewind: true,
  recordingMaxStorageGb: true,
  recordingOutputResolution: true,
  recordingRunQuality: true,
  recordingStoragePath: true,
  setupCompleted: true,
  setupStep: true,
  setupVersion: true,
  telemetryCrashReporting: true,
  telemetryUsageAnalytics: true,
} as const satisfies Record<AppSettingsKey, true>;
const validSettingKeys = new Set<string>(Object.keys(validSettingKeyMap));

interface StoredSettingRow {
  key: string;
  value_json: string;
  updated_at: string;
}

function readSetting(db: Database, key: string): StoredSettingRow | undefined {
  return db
    .prepare(
      `
        SELECT key, value_json, updated_at
        FROM settings
        WHERE key = ?
      `,
    )
    .get(key) as StoredSettingRow | undefined;
}

function parseSettingValue(valueJson: string): unknown {
  try {
    return JSON.parse(valueJson);
  } catch {
    return invalidSettingValue;
  }
}

function isInvalidSettingValue(
  value: unknown,
): value is typeof invalidSettingValue {
  return value === invalidSettingValue;
}

function clampRewindSaveSeconds(seconds: number): number {
  return Math.min(
    maxRewindSaveSeconds,
    Math.max(minRewindSaveSeconds, Math.round(seconds)),
  );
}

function upsertSetting(
  db: Database,
  key: string,
  value: unknown,
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

function migrateLegacyOverlayCaptureSetting(db: Database): void {
  const legacySetting = readSetting(db, legacyOverlayCaptureSettingKey);
  if (!legacySetting) {
    return;
  }

  const legacyValue = parseSettingValue(legacySetting.value_json);
  if (typeof legacyValue !== "boolean") {
    return;
  }

  if (!readSetting(db, recordingOverlayCaptureSettingKey)) {
    upsertSetting(
      db,
      recordingOverlayCaptureSettingKey,
      legacyValue,
      legacySetting.updated_at,
    );
  }

  if (!readSetting(db, rewindOverlayCaptureSettingKey)) {
    upsertSetting(
      db,
      rewindOverlayCaptureSettingKey,
      legacyValue,
      legacySetting.updated_at,
    );
  }
}

function clampStoredRewindDuration(db: Database): void {
  const setting = readSetting(db, deathClipSecondsSettingKey);
  if (!setting) {
    return;
  }

  const value = parseSettingValue(setting.value_json);
  if (
    isInvalidSettingValue(value) ||
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    upsertSetting(
      db,
      deathClipSecondsSettingKey,
      defaultRewindSaveSeconds,
      setting.updated_at,
    );
    return;
  }

  const clampedValue = clampRewindSaveSeconds(value);
  if (clampedValue === value) {
    return;
  }

  upsertSetting(
    db,
    deathClipSecondsSettingKey,
    clampedValue,
    setting.updated_at,
  );
}

function resetInvalidCurrentSettings(db: Database): void {
  const storedSettings = db
    .prepare("SELECT key, value_json, updated_at FROM settings")
    .all() as unknown as StoredSettingRow[];
  const defaultSettings = createDefaultSettings();

  for (const setting of storedSettings) {
    if (!validSettingKeys.has(setting.key)) {
      continue;
    }

    const key = setting.key as AppSettingsKey;
    const value = parseSettingValue(setting.value_json);
    if (
      !isInvalidSettingValue(value) &&
      AppSettingsSchema.shape[key].safeParse(value).success
    ) {
      continue;
    }

    upsertSetting(db, key, defaultSettings[key], setting.updated_at);
  }
}

function pruneObsoleteSettings(db: Database): void {
  const storedSettings = db.prepare("SELECT key FROM settings").all() as Array<{
    key: string;
  }>;
  const deleteSetting = db.prepare("DELETE FROM settings WHERE key = ?");

  // Settings are first-party and schema-owned; unknown persisted keys are reset
  // during this cleanup instead of being kept as unsupported legacy state.
  for (const setting of storedSettings) {
    if (!validSettingKeys.has(setting.key)) {
      deleteSetting.run(setting.key);
    }
  }
}

const migration_20260630_000000_settings_cleanup: Migration = {
  id: "20260630_000000_settings_cleanup",
  description: "Clean obsolete settings keys",
  up(db) {
    migrateLegacyOverlayCaptureSetting(db);
    clampStoredRewindDuration(db);
    resetInvalidCurrentSettings(db);
    pruneObsoleteSettings(db);
  },
  down() {
    // Data cleanup is intentionally not reversible.
  },
};

export { migration_20260630_000000_settings_cleanup };
