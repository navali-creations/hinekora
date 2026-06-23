import { describe, expect, it } from "vitest";

import {
  AppSettingsSchema,
  CapturePreviewSourceSchema,
  createDefaultSettings,
  normalizeRecordingEncoderChoice,
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
      recordingHideOverlaysFromCapture: false,
      recordingMaxStorageGb: 50,
      poe1ClientTxtPath: null,
      poe2ClientTxtPath: null,
      activeGame: "poe1",
      activeLeague: "Standard",
      poe1SelectedLeague: "Standard",
      poe2SelectedLeague: "Standard",
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
