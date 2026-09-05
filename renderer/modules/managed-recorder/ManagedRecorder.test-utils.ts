import type {
  ManagedRecorderStatus,
  ManagedRunRecordingSession,
} from "~/types";

function createManagedRunRecordingSessionTestFixture(
  overrides: Partial<ManagedRunRecordingSession> = {},
): ManagedRunRecordingSession {
  return {
    framesPerSecond: 60,
    path: "C:\\Videos\\2026-09-05 03-20-00.mp4",
    sourceGame: "poe2",
    sourceLeague: "Runes of Aldur",
    startedAt: "2026-09-05T03:20:00.000Z",
    state: "recording",
    stoppedAt: null,
    ...overrides,
  };
}

function createManagedRecorderStatusTestFixture(
  overrides: Partial<ManagedRecorderStatus> = {},
): ManagedRecorderStatus {
  return {
    activeGame: null,
    activeSessionDirectory: null,
    available: true,
    bufferActive: false,
    encoder: "h264",
    error: null,
    fps: 60,
    gameRunning: true,
    initialized: true,
    isStartingRecording: false,
    isStoppingRecording: false,
    lastRecordingPath: null,
    outputDirectory: "C:\\Videos",
    outputResolution: "1920x1080",
    recording: false,
    recordingStartedAt: null,
    runRecordingActive: false,
    runRecordingSession: null,
    runtime: "packaged_obs",
    runtimePath: "obs.exe",
    ...overrides,
  };
}

export {
  createManagedRecorderStatusTestFixture,
  createManagedRunRecordingSessionTestFixture,
};
