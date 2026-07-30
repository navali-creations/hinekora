import {
  type CaptureProfile,
  CaptureProfileSchema,
  createDefaultCaptureProfile,
  type GameId,
  normalizePersistedRecordingOutputResolution,
} from "~/types";

interface CaptureProfileRow {
  id: string;
  name: string;
  game: string;
  data_json: string;
  created_at: string;
  updated_at: string;
}

function mapCaptureProfileRow(row: CaptureProfileRow): CaptureProfile {
  const data = parseJson(row.data_json);
  const parsedData = typeof data === "object" && data !== null ? data : {};
  const defaults = createDefaultCaptureProfile(
    {
      name: row.name,
      game: row.game as GameId,
    },
    { id: row.id, isDefault: false },
  );
  const recordingOutputResolution = Object.hasOwn(
    parsedData,
    "recordingOutputResolution",
  )
    ? normalizePersistedRecordingOutputResolution(
        Reflect.get(parsedData, "recordingOutputResolution"),
      )
    : defaults.recordingOutputResolution;
  const manualReplaySeconds = Object.hasOwn(parsedData, "manualReplaySeconds")
    ? Reflect.get(parsedData, "manualReplaySeconds")
    : Object.hasOwn(parsedData, "deathClipSeconds")
      ? Reflect.get(parsedData, "deathClipSeconds")
      : defaults.manualReplaySeconds;

  return CaptureProfileSchema.parse({
    ...defaults,
    ...parsedData,
    manualReplaySeconds,
    recordingOutputResolution,
    id: row.id,
    name: row.name,
    game: row.game as GameId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export type { CaptureProfileRow };
export { mapCaptureProfileRow };
