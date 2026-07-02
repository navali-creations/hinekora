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
const defaultSettingsUpdatedAt = "2026-06-30T00:00:00.000Z";
const gameIds = new Set(["poe1", "poe2"]);
const setupSteps = new Set([0, 1, 2, 3]);
const appCloseBehaviors = new Set(["exit", "minimize-to-tray"]);
const recordingQualities = new Set(["low", "moderate", "high", "ultra"]);
const recordingAutoStartModes = new Set(["off", "recording", "rewind"]);
const recordingEncoders = new Set([
  "hardware_h264",
  "hardware_h265",
  "hardware_av1",
  "obs_x264",
  "auto",
  "obs_nvenc_h264_tex",
  "obs_nvenc_h264_soft",
  "obs_nvenc_h264_cuda",
  "obs_nvenc_hevc_tex",
  "obs_nvenc_hevc_soft",
  "obs_nvenc_hevc_cuda",
  "obs_nvenc_av1_tex",
  "obs_nvenc_av1_soft",
  "obs_nvenc_av1_cuda",
  "h264_texture_amf",
  "h264_fallback_amf",
  "h265_texture_amf",
  "h265_fallback_amf",
  "av1_texture_amf",
  "av1_fallback_amf",
  "obs_qsv11",
  "obs_qsv11_v2",
  "obs_qsv11_soft",
  "obs_qsv11_soft_v2",
  "obs_qsv11_hevc",
  "obs_qsv11_hevc_soft",
  "obs_qsv11_av1",
  "obs_qsv11_av1_soft",
]);

interface SettingCleanupSpec {
  defaultValue: unknown;
  isValid: (value: unknown) => boolean;
  key: string;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function isNullableStringMax(value: unknown, max: number): boolean {
  return value === null || (typeof value === "string" && value.length <= max);
}

function isBoundedString(
  value: unknown,
  options: { max: number; min?: number },
): boolean {
  const min = options.min ?? 0;

  return (
    typeof value === "string" &&
    value.length >= min &&
    value.length <= options.max
  );
}

function isMainWindowBounds(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return value === null;
  }

  const bounds = value as Record<string, unknown>;

  return (
    isIntegerInRange(bounds.x, -100_000, 100_000) &&
    isIntegerInRange(bounds.y, -100_000, 100_000) &&
    isIntegerInRange(bounds.width, 1200, 100_000) &&
    isIntegerInRange(bounds.height, 800, 100_000)
  );
}

function isRecorderOverlayBounds(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return value === null;
  }

  const bounds = value as Record<string, unknown>;

  return (
    isIntegerInRange(bounds.x, -100_000, 100_000) &&
    isIntegerInRange(bounds.y, -100_000, 100_000) &&
    isIntegerInRange(bounds.width, 236, 100_000) &&
    isIntegerInRange(bounds.height, 42, 100_000)
  );
}

function isInstalledGames(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 2 &&
    value.every((item) => gameIds.has(String(item)))
  );
}

function isStringArray(value: unknown, maxItems: number, maxLength: number) {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.length >= 1 &&
        item.length <= maxLength,
    )
  );
}

function isCaptureProfileSelectionMemory(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([game, selectedProfileId]) =>
      gameIds.has(game) &&
      (selectedProfileId === null ||
        isBoundedString(selectedProfileId, { min: 1, max: 128 })),
  );
}

const settingCleanupSpecs = [
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "setupCompleted",
  },
  {
    defaultValue: 0,
    isValid: (value) => typeof value === "number" && setupSteps.has(value),
    key: "setupStep",
  },
  {
    defaultValue: 1,
    isValid: (value) => isIntegerInRange(value, 1, 1000),
    key: "setupVersion",
  },
  {
    defaultValue: "exit",
    isValid: (value) => appCloseBehaviors.has(String(value)),
    key: "appCloseBehavior",
  },
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "appLaunchOnStartup",
  },
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "appStartMinimized",
  },
  {
    defaultValue: null,
    isValid: isMainWindowBounds,
    key: "mainWindowBounds",
  },
  {
    defaultValue: null,
    isValid: isRecorderOverlayBounds,
    key: "recorderOverlayBounds",
  },
  {
    defaultValue: ["poe1"],
    isValid: isInstalledGames,
    key: "installedGames",
  },
  {
    defaultValue: null,
    isValid: (value) => isNullableStringMax(value, 2_048),
    key: "recordingStoragePath",
  },
  {
    defaultValue: "native",
    isValid: (value) => isBoundedString(value, { min: 1, max: 32 }),
    key: "recordingOutputResolution",
  },
  {
    defaultValue: 30,
    isValid: (value) => isIntegerInRange(value, 1, 240),
    key: "recordingFps",
  },
  {
    defaultValue: "hardware_h264",
    isValid: (value) => recordingEncoders.has(String(value)),
    key: "recordingEncoder",
  },
  {
    defaultValue: "high",
    isValid: (value) => recordingQualities.has(String(value)),
    key: "recordingClipQuality",
  },
  {
    defaultValue: "moderate",
    isValid: (value) => recordingQualities.has(String(value)),
    key: "recordingRunQuality",
  },
  {
    defaultValue: null,
    isValid: (value) =>
      value === null || isBoundedString(value, { min: 1, max: 512 }),
    key: "recordingAudioInputDeviceId",
  },
  {
    defaultValue: null,
    isValid: (value) =>
      value === null || isBoundedString(value, { min: 1, max: 512 }),
    key: "recordingAudioOutputDeviceId",
  },
  {
    defaultValue: true,
    isValid: isBoolean,
    key: "recordingHideOverlaysFromRecording",
  },
  {
    defaultValue: true,
    isValid: isBoolean,
    key: "recordingHideOverlaysFromRewind",
  },
  {
    defaultValue: "off",
    isValid: (value) => recordingAutoStartModes.has(String(value)),
    key: "recordingAutoStartMode",
  },
  {
    defaultValue: null,
    isValid: (value) =>
      value === null || isBoundedString(value, { min: 1, max: 128 }),
    key: "selectedCaptureProfileId",
  },
  {
    defaultValue: {},
    isValid: isCaptureProfileSelectionMemory,
    key: "selectedCaptureProfileIdsByGame",
  },
  {
    defaultValue: null,
    isValid: (value) =>
      value === null || isBoundedString(value, { min: 1, max: 128 }),
    key: "selectedProfileId",
  },
  {
    defaultValue: 50,
    isValid: (value) => isIntegerInRange(value, 0, 100_000),
    key: "recordingMaxStorageGb",
  },
  {
    defaultValue: null,
    isValid: (value) => isNullableStringMax(value, 2_048),
    key: "poe1ClientTxtPath",
  },
  {
    defaultValue: null,
    isValid: (value) => isNullableStringMax(value, 2_048),
    key: "poe2ClientTxtPath",
  },
  {
    defaultValue: "",
    isValid: (value) => isBoundedString(value, { max: 80 }),
    key: "poe1CharacterName",
  },
  {
    defaultValue: "",
    isValid: (value) => isBoundedString(value, { max: 80 }),
    key: "poe2CharacterName",
  },
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "captureModeInfoAlertDismissed",
  },
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "groupPlayDeathAlertDismissed",
  },
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "recorderSettingsInfoAlertDismissed",
  },
  {
    defaultValue: "poe1",
    isValid: (value) => gameIds.has(String(value)),
    key: "activeGame",
  },
  {
    defaultValue: "Standard",
    isValid: (value) => isBoundedString(value, { min: 1, max: 80 }),
    key: "activeLeague",
  },
  {
    defaultValue: "Standard",
    isValid: (value) => isBoundedString(value, { min: 1, max: 80 }),
    key: "poe1SelectedLeague",
  },
  {
    defaultValue: "Standard",
    isValid: (value) => isBoundedString(value, { min: 1, max: 80 }),
    key: "poe2SelectedLeague",
  },
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "editorAutoPruneProjects",
  },
  {
    defaultValue: defaultRewindSaveSeconds,
    isValid: (value) =>
      isIntegerInRange(value, minRewindSaveSeconds, maxRewindSaveSeconds),
    key: deathClipSecondsSettingKey,
  },
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "telemetryCrashReporting",
  },
  {
    defaultValue: false,
    isValid: isBoolean,
    key: "telemetryUsageAnalytics",
  },
  {
    defaultValue: null,
    isValid: (value) =>
      value === null || isBoundedString(value, { min: 1, max: 64 }),
    key: "lastSeenAppVersion",
  },
  {
    defaultValue: [],
    isValid: (value) => isStringArray(value, 128, 128),
    key: "onboardingDismissedBeacons",
  },
] satisfies SettingCleanupSpec[];
const settingCleanupSpecByKey = new Map(
  settingCleanupSpecs.map((spec) => [spec.key, spec]),
);
const validSettingKeys = new Set(settingCleanupSpecByKey.keys());

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

  for (const setting of storedSettings) {
    const spec = settingCleanupSpecByKey.get(setting.key);
    if (!spec) {
      continue;
    }

    const value = parseSettingValue(setting.value_json);
    if (!isInvalidSettingValue(value) && spec.isValid(value)) {
      continue;
    }

    upsertSetting(db, setting.key, spec.defaultValue, setting.updated_at);
  }
}

function backfillMissingCurrentSettings(db: Database): void {
  for (const spec of settingCleanupSpecs) {
    if (readSetting(db, spec.key)) {
      continue;
    }

    upsertSetting(db, spec.key, spec.defaultValue, defaultSettingsUpdatedAt);
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
    backfillMissingCurrentSettings(db);
    resetInvalidCurrentSettings(db);
    pruneObsoleteSettings(db);
  },
  down() {
    // Data cleanup is intentionally not reversible.
  },
};

export { migration_20260630_000000_settings_cleanup };
