import { describe, expect, it } from "vitest";

import {
  AppSettingsSchema,
  CapturePreviewSourceSchema,
  createCoordinateReferenceDimensions,
  createDefaultSettings,
  normalizeRecordingEncoderChoice,
  ProfileSchema,
  StateBundleSchema,
} from "./schemas";

describe("shared schemas", () => {
  it("creates bounded default settings", () => {
    expect(createDefaultSettings()).toEqual({
      setupCompleted: false,
      setupStep: 0,
      setupVersion: 1,
      appCloseBehavior: "exit",
      appLaunchOnStartup: false,
      appStartMinimized: false,
      installedGames: ["poe1"],
      recordingStoragePath: null,
      recordingOutputResolution: "native",
      recordingFps: 30,
      recordingEncoder: "hardware_h264",
      recordingClipQuality: "high",
      recordingRunQuality: "moderate",
      recordingAudioInputDeviceId: null,
      recordingAudioOutputDeviceId: null,
      recordingHideOverlaysFromCapture: false,
      recordingMaxStorageGb: 50,
      poe1ClientTxtPath: null,
      poe2ClientTxtPath: null,
      activeGame: "poe1",
      activeLeague: "Standard",
      poe1SelectedLeague: "Standard",
      poe2SelectedLeague: "Standard",
      editorAutoPruneProjects: false,
      deathClipSeconds: 10,
      telemetryCrashReporting: false,
      telemetryUsageAnalytics: false,
      lastSeenAppVersion: null,
      onboardingDismissedBeacons: [],
    });
  });

  it("rejects empty active leagues", () => {
    expect(() => AppSettingsSchema.parse({ activeLeague: "" })).toThrow();
  });

  it("accepts and normalizes legacy recording encoder values", () => {
    expect(AppSettingsSchema.parse({ recordingEncoder: "auto" })).toMatchObject(
      {
        recordingEncoder: "auto",
      },
    );
    expect(normalizeRecordingEncoderChoice("obs_nvenc_hevc_tex")).toBe(
      "hardware_h265",
    );
    expect(normalizeRecordingEncoderChoice("av1_texture_amf")).toBe(
      "hardware_av1",
    );
    expect(normalizeRecordingEncoderChoice("obs_nvenc_h264_tex")).toBe(
      "hardware_h264",
    );
  });

  it("accepts bounded capture preview sources", () => {
    expect(
      CapturePreviewSourceSchema.parse({
        id: "screen:1:0",
        name: "Entire Screen",
        kind: "screen",
        displayId: "1",
        width: 2560,
        height: 1440,
        thumbnailDataUrl: "data:image/png;base64,abc",
      }),
    ).toEqual({
      id: "screen:1:0",
      name: "Entire Screen",
      kind: "screen",
      displayId: "1",
      width: 2560,
      height: 1440,
      thumbnailDataUrl: "data:image/png;base64,abc",
    });
  });

  it("accepts aura coordinate references while keeping legacy profiles valid", () => {
    const profile = {
      id: "profile-1",
      name: "Default",
      game: "poe1",
      targetFps: 30,
      captureTarget: null,
      cropRegions: [
        {
          id: "crop-1",
          label: "Aura 1",
          x: 10,
          y: 20,
          width: 100,
          height: 40,
        },
      ],
      overlayPlacements: [
        {
          id: "placement-1",
          cropRegionId: "crop-1",
          x: 30,
          y: 40,
          scale: 1,
          opacity: 1,
        },
      ],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };

    expect(ProfileSchema.parse(profile)).toEqual(profile);
    expect(
      ProfileSchema.parse({
        ...profile,
        cropRegions: [
          {
            ...profile.cropRegions[0],
            referenceWidth: 1920,
            referenceHeight: 1080,
          },
        ],
        overlayPlacements: [
          {
            ...profile.overlayPlacements[0],
            referenceWidth: 1920,
            referenceHeight: 1080,
          },
        ],
      }),
    ).toMatchObject({
      cropRegions: [
        {
          referenceWidth: 1920,
          referenceHeight: 1080,
        },
      ],
      overlayPlacements: [
        {
          referenceWidth: 1920,
          referenceHeight: 1080,
        },
      ],
    });
  });

  it("creates rounded coordinate reference dimensions", () => {
    expect(
      createCoordinateReferenceDimensions({
        width: 2559.6,
        height: 1439.4,
      }),
    ).toEqual({
      referenceWidth: 2560,
      referenceHeight: 1439,
    });
  });

  it("accepts versioned portable bundles", () => {
    const settings = createDefaultSettings();

    expect(() =>
      StateBundleSchema.parse({
        format: "hinekora-state",
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        appVersion: "0.0.0",
        sections: {
          profiles: [],
          settings,
          replayClips: [],
        },
      }),
    ).not.toThrow();
  });

  it("ignores obsolete ffmpeg job state in legacy portable bundles", () => {
    const settings = createDefaultSettings();

    expect(
      StateBundleSchema.parse({
        format: "hinekora-state",
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        appVersion: "0.0.0",
        sections: {
          profiles: [],
          settings,
          replayClips: [],
          ffmpegJobs: [],
        },
      }),
    ).toEqual({
      format: "hinekora-state",
      formatVersion: 1,
      exportedAt: expect.any(String),
      appVersion: "0.0.0",
      sections: {
        profiles: [],
        settings,
        replayClips: [],
      },
    });
  });
});
