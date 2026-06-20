import { describe, expect, it } from "vitest";

import type { ManagedRecorderStatus } from "~/types";
import {
  createCapturePrimaryDisabledReason,
  createRecorderOverlayDisabledReason,
} from "./CaptureModePageHeader.utils";

function createStatus(
  overrides: Partial<ManagedRecorderStatus> = {},
): ManagedRecorderStatus {
  return {
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
    runRecordingPath: null,
    runRecordingStartedAt: null,
    runtime: "packaged_obs",
    runtimePath: "obs.exe",
    ...overrides,
  };
}

describe("CaptureModePageHeader utils", () => {
  it("creates dashboard start disabled reasons by priority", () => {
    expect(
      createCapturePrimaryDisabledReason({
        selectedMode: "rewind",
        status: null,
      }),
    ).toBe("Recorder status is still loading.");
    expect(
      createCapturePrimaryDisabledReason({
        selectedMode: "rewind",
        status: createStatus({
          gameRunning: false,
          isStartingRecording: true,
        }),
      }),
    ).toBe("Recording is starting. Wait for the current action to finish.");
    expect(
      createCapturePrimaryDisabledReason({
        selectedMode: "rewind",
        status: createStatus({ isStoppingRecording: true }),
      }),
    ).toBe("Recording is stopping. Wait for the current action to finish.");
    expect(
      createCapturePrimaryDisabledReason({
        selectedMode: "rewind",
        status: createStatus({ available: false, error: "OBS missing" }),
      }),
    ).toBe("Recorder is unavailable: OBS missing");
    expect(
      createCapturePrimaryDisabledReason({
        selectedMode: "rewind",
        status: createStatus({ gameRunning: false }),
      }),
    ).toBe("Start the selected Path of Exile game before recording.");
    expect(
      createCapturePrimaryDisabledReason({
        selectedMode: "session",
        status: createStatus({ bufferActive: true }),
      }),
    ).toBe("Disable Rewind before starting a session recording.");
    expect(
      createCapturePrimaryDisabledReason({
        selectedMode: "rewind",
        status: createStatus({ runRecordingActive: true }),
      }),
    ).toBe("Stop the session recording before enabling Rewind.");
    expect(
      createCapturePrimaryDisabledReason({
        selectedMode: "rewind",
        status: createStatus(),
      }),
    ).toBeNull();
  });

  it("creates appbar overlay disabled reasons without blocking active recording states", () => {
    expect(createRecorderOverlayDisabledReason(null)).toBe(
      "Recorder status is still loading.",
    );
    expect(
      createRecorderOverlayDisabledReason(
        createStatus({
          gameRunning: false,
          isStartingRecording: true,
        }),
      ),
    ).toBe("Recording is starting. Wait for the current action to finish.");
    expect(
      createRecorderOverlayDisabledReason(
        createStatus({ isStoppingRecording: true }),
      ),
    ).toBe("Recording is stopping. Wait for the current action to finish.");
    expect(
      createRecorderOverlayDisabledReason(
        createStatus({ available: false, error: "OBS missing" }),
      ),
    ).toBe("Recorder is unavailable: OBS missing");
    expect(
      createRecorderOverlayDisabledReason(createStatus({ gameRunning: false })),
    ).toBe(
      "Start the selected Path of Exile game before opening the recorder overlay.",
    );
    expect(
      createRecorderOverlayDisabledReason(createStatus({ bufferActive: true })),
    ).toBeNull();
    expect(
      createRecorderOverlayDisabledReason(
        createStatus({ runRecordingActive: true }),
      ),
    ).toBeNull();
    expect(createRecorderOverlayDisabledReason(createStatus())).toBeNull();
  });
});
