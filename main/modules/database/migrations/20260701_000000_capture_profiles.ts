import type { DatabaseSync, StatementSync } from "node:sqlite";

import type { Migration } from "./Migration.interface";

type GameId = "poe1" | "poe2";

interface ProfileRow {
  id: string;
  name: string;
  game: string;
  data_json: string;
  created_at: string;
  updated_at: string;
}

interface CaptureProfileSeed {
  id: string;
  name: string;
  game: GameId;
  captureTarget: unknown;
  createdAt: string;
  updatedAt: string;
}

interface CaptureProfileSummary {
  id: string;
  game: GameId;
}

const games: GameId[] = ["poe1", "poe2"];
const settingKey = "selectedCaptureProfileId";
const selectionMemorySettingKey = "selectedCaptureProfileIdsByGame";
const defaultCaptureProfileIds: Record<GameId, string> = {
  poe1: "default-capture-poe1",
  poe2: "default-capture-poe2",
};
const defaultCaptureProfileNames: Record<GameId, string> = {
  poe1: "Default PoE Capture",
  poe2: "Default PoE 2 Capture",
};
const defaultCaptureProfileSettings = {
  recordingOutputResolution: "native",
  recordingFps: 30,
  recordingEncoder: "hardware_h264",
  recordingClipQuality: "high",
  recordingRunQuality: "moderate",
  recordingAudioInputDeviceId: null,
  recordingAudioOutputDeviceId: null,
  recordingHideOverlaysFromRecording: true,
  recordingHideOverlaysFromRewind: true,
  recordingAutoStartMode: "off",
  deathClipSeconds: 10,
};
const recordingQualities = new Set(["low", "moderate", "high", "ultra"]);
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
const recordingAutoStartModes = new Set(["off", "recording", "rewind"]);

const migration_20260701_000000_capture_profiles: Migration = {
  id: "20260701_000000_capture_profiles",
  description: "Add capture profiles",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS capture_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_capture_profiles_game_updated_at
        ON capture_profiles(game, updated_at DESC);
    `);

    seedCaptureProfiles(db);
    repairCaptureProfileDefaults(db);
    backfillSelectedCaptureProfileSetting(db);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_capture_profiles_game_updated_at;
      DROP TABLE IF EXISTS capture_profiles;
    `);
    if (tableExists(db, "settings")) {
      db.prepare("DELETE FROM settings WHERE key = ?").run(settingKey);
      db.prepare("DELETE FROM settings WHERE key = ?").run(
        selectionMemorySettingKey,
      );
    }
  },
};

function seedCaptureProfiles(db: DatabaseSync): void {
  const insertedGames = new Set<GameId>();

  if (tableExists(db, "profiles")) {
    const profileRows = db
      .prepare(
        `
        SELECT id, name, game, data_json, created_at, updated_at
        FROM profiles
        ORDER BY updated_at DESC
      `,
      )
      .all() as unknown as ProfileRow[];
    for (const row of profileRows) {
      const game = parseGame(row.game);
      if (!game) {
        continue;
      }

      insertedGames.add(game);
      insertCaptureProfile(db, {
        id: row.id,
        name: `${row.name} Capture`,
        game,
        captureTarget: readCaptureTarget(row.data_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
  }

  const currentProfiles = readCaptureProfileSummaries(db);
  for (const profile of currentProfiles) {
    insertedGames.add(profile.game);
  }

  const now = new Date().toISOString();
  for (const game of games) {
    if (insertedGames.has(game)) {
      continue;
    }

    insertCaptureProfile(db, {
      id: defaultCaptureProfileIds[game],
      name: defaultCaptureProfileNames[game],
      game,
      captureTarget: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function insertCaptureProfile(
  db: DatabaseSync,
  profile: CaptureProfileSeed,
): void {
  const data = {
    id: profile.id,
    name: profile.name,
    game: profile.game,
    captureTarget: profile.captureTarget,
    ...readCaptureSettings(db),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  db.prepare(
    `
    INSERT OR IGNORE INTO capture_profiles (
      id,
      name,
      game,
      data_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(
    profile.id,
    profile.name,
    profile.game,
    JSON.stringify(data),
    profile.createdAt,
    profile.updatedAt,
  );
}

function backfillSelectedCaptureProfileSetting(db: DatabaseSync): void {
  if (!tableExists(db, "settings")) {
    return;
  }

  const existingSelectedId = readStringSetting(db, settingKey);
  const profiles = readCaptureProfileSummaries(db);
  const existingSelectedProfile = existingSelectedId
    ? (profiles.find((profile) => profile.id === existingSelectedId) ?? null)
    : null;
  if (existingSelectedProfile) {
    upsertCaptureProfileSelectionMemory(db, profiles, existingSelectedProfile);
    upsertActiveGameSettings(db, existingSelectedProfile.game);
    return;
  }

  const legacySelectedId = readStringSetting(db, "selectedProfileId");
  const activeGame = readGameSetting(db, "activeGame") ?? "poe1";
  const selectedProfile =
    (legacySelectedId
      ? profiles.find((profile) => profile.id === legacySelectedId)
      : null) ??
    profiles.find((profile) => profile.game === activeGame) ??
    profiles[0]!;

  upsertSetting(db, settingKey, selectedProfile.id);
  upsertCaptureProfileSelectionMemory(db, profiles, selectedProfile);
  upsertActiveGameSettings(db, selectedProfile.game);
}

function upsertCaptureProfileSelectionMemory(
  db: DatabaseSync,
  profiles: CaptureProfileSummary[],
  selectedProfile: CaptureProfileSummary,
): void {
  const current = readCaptureProfileSelectionMemorySetting(db);
  const next: Partial<Record<GameId, string>> = {};

  for (const game of games) {
    const currentProfileId = current[game];
    const currentProfile = currentProfileId
      ? profiles.find(
          (profile) => profile.id === currentProfileId && profile.game === game,
        )
      : null;
    const fallbackProfile = profiles.find((profile) => profile.game === game);

    if (currentProfile) {
      next[game] = currentProfile.id;
    } else if (fallbackProfile) {
      next[game] = fallbackProfile.id;
    }
  }

  next[selectedProfile.game] = selectedProfile.id;
  upsertSetting(db, selectionMemorySettingKey, next);
}

function upsertActiveGameSettings(db: DatabaseSync, game: GameId): void {
  const leagueKey =
    game === "poe1" ? "poe1SelectedLeague" : "poe2SelectedLeague";
  const activeLeague = readStringSetting(db, leagueKey, "Standard", {
    max: 80,
  });

  upsertSetting(db, "activeGame", game);
  upsertSetting(db, "activeLeague", activeLeague);
  upsertSetting(db, leagueKey, activeLeague);
}

function readCaptureProfileSummaries(
  db: DatabaseSync,
): CaptureProfileSummary[] {
  return (
    db
      .prepare(
        `
        SELECT id, game
        FROM capture_profiles
        ORDER BY updated_at DESC
      `,
      )
      .all() as Array<{ id: string; game: string }>
  )
    .map((row) => {
      const game = parseGame(row.game);
      return game ? { id: row.id, game } : null;
    })
    .filter((profile): profile is CaptureProfileSummary => profile !== null);
}

function readCaptureSettings(db: DatabaseSync): Record<string, unknown> {
  return {
    recordingOutputResolution: readStringSetting(
      db,
      "recordingOutputResolution",
      "native",
      { max: 32 },
    ),
    recordingFps: readIntegerSetting(db, "recordingFps", 30, 1, 240),
    recordingEncoder: readEnumSetting(
      db,
      "recordingEncoder",
      recordingEncoders,
      "hardware_h264",
    ),
    recordingClipQuality: readEnumSetting(
      db,
      "recordingClipQuality",
      recordingQualities,
      "high",
    ),
    recordingRunQuality: readEnumSetting(
      db,
      "recordingRunQuality",
      recordingQualities,
      "moderate",
    ),
    recordingAudioInputDeviceId: readNullableStringSetting(
      db,
      "recordingAudioInputDeviceId",
      { max: 512 },
    ),
    recordingAudioOutputDeviceId: readNullableStringSetting(
      db,
      "recordingAudioOutputDeviceId",
      { max: 512 },
    ),
    recordingHideOverlaysFromRecording: readBooleanSetting(
      db,
      "recordingHideOverlaysFromRecording",
      true,
    ),
    recordingHideOverlaysFromRewind: readBooleanSetting(
      db,
      "recordingHideOverlaysFromRewind",
      true,
    ),
    recordingAutoStartMode: readEnumSetting(
      db,
      "recordingAutoStartMode",
      recordingAutoStartModes,
      "off",
    ),
    deathClipSeconds: readIntegerSetting(db, "deathClipSeconds", 10, 1, 60),
  };
}

function repairCaptureProfileDefaults(db: DatabaseSync): void {
  for (const game of games) {
    ensureDefaultCaptureProfile(db, game);
  }
  normalizeNonDefaultCaptureProfiles(db);
}

function ensureDefaultCaptureProfile(db: DatabaseSync, game: GameId): void {
  const rows = readCaptureProfileRows(db);
  const defaultId = defaultCaptureProfileIds[game];
  const existingDefaultRow = rows.find((row) => row.id === defaultId);
  const legacyDefaultRow =
    existingDefaultRow ??
    rows.find((row) => isLegacyDefaultCandidate(row, game)) ??
    null;
  const now = new Date().toISOString();
  const sourceRow = legacyDefaultRow ?? null;
  const createdAt = sourceRow?.created_at ?? now;
  const updatedAt = sourceRow?.updated_at ?? now;

  upsertCaptureProfileRow(db, {
    id: defaultId,
    name: defaultCaptureProfileNames[game],
    game,
    data_json: JSON.stringify(
      createCaptureProfileData({
        row: sourceRow,
        id: defaultId,
        name: defaultCaptureProfileNames[game],
        game,
        isDefault: true,
        createdAt,
        updatedAt,
      }),
    ),
    created_at: createdAt,
    updated_at: updatedAt,
  });

  if (sourceRow && sourceRow.id !== defaultId) {
    db.prepare("DELETE FROM capture_profiles WHERE id = ?").run(sourceRow.id);
    replaceSelectedCaptureProfileId(db, sourceRow.id, defaultId);
  }
}

function normalizeNonDefaultCaptureProfiles(db: DatabaseSync): void {
  for (const row of readCaptureProfileRows(db)) {
    const game = parseGame(row.game);
    if (!game || row.id === defaultCaptureProfileIds[game]) {
      continue;
    }

    upsertCaptureProfileRow(db, {
      ...row,
      data_json: JSON.stringify(
        createCaptureProfileData({
          row,
          id: row.id,
          name: row.name,
          game,
          isDefault: false,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
      ),
    });
  }
}

function createCaptureProfileData({
  row,
  id,
  name,
  game,
  isDefault,
  createdAt,
  updatedAt,
}: {
  row: ProfileRow | null;
  id: string;
  name: string;
  game: GameId;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}): Record<string, unknown> {
  const data = parseObjectJson(row?.data_json);

  return {
    ...defaultCaptureProfileSettings,
    ...data,
    id,
    name,
    game,
    isDefault,
    captureTarget: readCaptureTargetFromData(data),
    createdAt,
    updatedAt,
  };
}

function readCaptureTargetFromData(data: Record<string, unknown>): unknown {
  const target = data.captureTarget;
  if (!isObject(target)) {
    return null;
  }

  if (
    (target.kind !== "display" && target.kind !== "window") ||
    typeof target.id !== "string" ||
    typeof target.label !== "string"
  ) {
    return null;
  }

  return target;
}

function isLegacyDefaultCandidate(row: ProfileRow, game: GameId): boolean {
  if (row.game !== game) {
    return false;
  }

  const data = parseObjectJson(row.data_json);

  return data.isDefault === true;
}

function upsertCaptureProfileRow(db: DatabaseSync, row: ProfileRow): void {
  db.prepare(
    `
    INSERT INTO capture_profiles (
      id,
      name,
      game,
      data_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      game = excluded.game,
      data_json = excluded.data_json,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `,
  ).run(
    row.id,
    row.name,
    row.game,
    row.data_json,
    row.created_at,
    row.updated_at,
  );
}

function replaceSelectedCaptureProfileId(
  db: DatabaseSync,
  oldId: string,
  newId: string,
): void {
  if (!tableExists(db, "settings")) {
    return;
  }

  db.prepare(
    `
    UPDATE settings
    SET value_json = ?
    WHERE key = 'selectedCaptureProfileId' AND value_json = ?
  `,
  ).run(JSON.stringify(newId), JSON.stringify(oldId));

  const memory = readCaptureProfileSelectionMemorySetting(db);
  let changed = false;
  for (const game of games) {
    if (memory[game] === oldId) {
      memory[game] = newId;
      changed = true;
    }
  }
  if (changed) {
    upsertSetting(db, selectionMemorySettingKey, memory);
  }
}

function readCaptureProfileRows(db: DatabaseSync): ProfileRow[] {
  return db
    .prepare(
      `
      SELECT id, name, game, data_json, created_at, updated_at
      FROM capture_profiles
      ORDER BY updated_at DESC
    `,
    )
    .all() as unknown as ProfileRow[];
}

function tableExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare(
      `
      SELECT 1 AS found
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `,
    )
    .get(name) as { found: number } | undefined;

  return row !== undefined;
}

function readCaptureTarget(dataJson: string): unknown {
  const data = parseJson(dataJson);
  if (!isObject(data) || !isObject(data.captureTarget)) {
    return null;
  }

  const target = data.captureTarget;
  if (
    (target.kind !== "display" && target.kind !== "window") ||
    typeof target.id !== "string" ||
    typeof target.label !== "string"
  ) {
    return null;
  }

  return target;
}

function readGameSetting(db: DatabaseSync, key: string): GameId | null {
  const value = readSetting(db, key);
  return typeof value === "string" ? parseGame(value) : null;
}

function readStringSetting(
  db: DatabaseSync,
  key: string,
  fallback?: string,
  options: { max: number } = { max: 128 },
): string | null {
  const value = readSetting(db, key);
  if (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= options.max
  ) {
    return value;
  }

  return fallback ?? null;
}

function readNullableStringSetting(
  db: DatabaseSync,
  key: string,
  options: { max: number },
): string | null {
  const value = readSetting(db, key);
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= options.max
  ) {
    return value;
  }

  return null;
}

function readIntegerSetting(
  db: DatabaseSync,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = readSetting(db, key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function readBooleanSetting(
  db: DatabaseSync,
  key: string,
  fallback: boolean,
): boolean {
  const value = readSetting(db, key);
  return typeof value === "boolean" ? value : fallback;
}

function readEnumSetting(
  db: DatabaseSync,
  key: string,
  allowedValues: Set<string>,
  fallback: string,
): string {
  const value = readSetting(db, key);
  return typeof value === "string" && allowedValues.has(value)
    ? value
    : fallback;
}

function readSetting(db: DatabaseSync, key: string): unknown {
  if (!tableExists(db, "settings")) {
    return undefined;
  }

  const row = db
    .prepare("SELECT value_json FROM settings WHERE key = ?")
    .get(key) as { value_json: string } | undefined;

  return row ? parseJson(row.value_json) : undefined;
}

function readCaptureProfileSelectionMemorySetting(
  db: DatabaseSync,
): Partial<Record<GameId, string>> {
  const value = readSetting(db, selectionMemorySettingKey);
  if (!isObject(value)) {
    return {};
  }

  const result: Partial<Record<GameId, string>> = {};
  for (const game of games) {
    const selectedProfileId = value[game];
    if (typeof selectedProfileId === "string" && selectedProfileId.length > 0) {
      result[game] = selectedProfileId;
    }
  }

  return result;
}

function upsertSetting(db: DatabaseSync, key: string, value: unknown): void {
  const now = new Date().toISOString();
  const statement = db.prepare(`
    INSERT INTO settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `) as StatementSync;

  statement.run(key, JSON.stringify(value), now);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseObjectJson(value: string | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseGame(value: string): GameId | null {
  return value === "poe1" || value === "poe2" ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { migration_20260701_000000_capture_profiles };
