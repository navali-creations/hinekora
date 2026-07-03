import type { CaptureProfile } from "~/types";

function createCaptureProfileTestFixture(
  overrides: Partial<CaptureProfile> = {},
): CaptureProfile {
  return {
    captureTarget: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    deathClipSeconds: 10,
    game: "poe1",
    id: "capture-profile-1",
    isDefault: false,
    name: "Default PoE Capture",
    recordingAudioInputDeviceId: null,
    recordingAudioOutputDeviceId: null,
    recordingAutoStartMode: "off",
    recordingClipQuality: "high",
    recordingEncoder: "hardware_h264",
    recordingFps: 60,
    recordingHideOverlaysFromRecording: true,
    recordingHideOverlaysFromRewind: true,
    recordingOutputResolution: "native",
    recordingRunQuality: "moderate",
    recordingTrackBookmarksInRewind: true,
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

export { createCaptureProfileTestFixture };
