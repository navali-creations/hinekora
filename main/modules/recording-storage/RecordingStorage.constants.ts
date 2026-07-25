const DEFAULT_RECORDING_DIRECTORY_NAME = "Hinekora Recordings";
const RECORDING_STORAGE_LOG_SCOPE = "recording-storage";
const RECORDING_STORAGE_DIRECTORY_NAMES = {
  deathClips: "Death Clips",
  fullRecordings: "Full Recordings",
  manualReplays: "Manual Replays",
} as const;

const LEGACY_RECORDING_STORAGE_DIRECTORY_NAMES = {
  deathClips: [],
  fullRecordings: [],
  manualReplays: ["Manual Clips"],
} as const;

export {
  DEFAULT_RECORDING_DIRECTORY_NAME,
  LEGACY_RECORDING_STORAGE_DIRECTORY_NAMES,
  RECORDING_STORAGE_DIRECTORY_NAMES,
  RECORDING_STORAGE_LOG_SCOPE,
};
