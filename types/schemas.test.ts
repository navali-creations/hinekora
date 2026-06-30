import { describe, expect, it } from "vitest";

import { clampRewindSaveSeconds } from "./recording";
import {
  AppSettingsSchema,
  AuraPlacementScaleSettings,
  AuraPointPlacementSettings,
  appSettingsKeys,
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
      mainWindowBounds: null,
      recorderOverlayBounds: null,
      installedGames: ["poe1"],
      recordingStoragePath: null,
      recordingOutputResolution: "native",
      recordingFps: 30,
      recordingEncoder: "hardware_h264",
      recordingClipQuality: "high",
      recordingRunQuality: "moderate",
      recordingAudioInputDeviceId: null,
      recordingAudioOutputDeviceId: null,
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
      recordingMaxStorageGb: 50,
      poe1ClientTxtPath: null,
      poe2ClientTxtPath: null,
      poe1CharacterName: "",
      poe2CharacterName: "",
      captureModeInfoAlertDismissed: false,
      groupPlayDeathAlertDismissed: false,
      recorderSettingsInfoAlertDismissed: false,
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

  it("tracks app settings keys from the schema", () => {
    expect(new Set(appSettingsKeys)).toEqual(
      new Set(Object.keys(createDefaultSettings())),
    );
    expect(appSettingsKeys).toContain("recordingHideOverlaysFromRecording");
    expect(appSettingsKeys).not.toContain("recordingHideOverlaysFromCapture");
  });

  it("rejects empty active leagues", () => {
    expect(() => AppSettingsSchema.parse({ activeLeague: "" })).toThrow();
  });

  it("limits rewind save duration to 60 seconds", () => {
    expect(AppSettingsSchema.parse({ deathClipSeconds: 60 })).toMatchObject({
      deathClipSeconds: 60,
    });
    expect(() => AppSettingsSchema.parse({ deathClipSeconds: 61 })).toThrow();
  });

  it("clamps rewind save durations for runtime settings", () => {
    expect(clampRewindSaveSeconds(0)).toBe(1);
    expect(clampRewindSaveSeconds(10.6)).toBe(11);
    expect(clampRewindSaveSeconds(90)).toBe(60);
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

  it("accepts capture preview window game metadata", () => {
    expect(
      CapturePreviewSourceSchema.parse({
        id: "window:poe:1",
        name: "Path of Exile 2",
        kind: "window",
        game: "poe2",
        displayId: null,
        width: 2560,
        height: 1440,
        thumbnailDataUrl: null,
      }),
    ).toEqual({
      id: "window:poe:1",
      name: "Path of Exile 2",
      kind: "window",
      game: "poe2",
      displayId: null,
      width: 2560,
      height: 1440,
      thumbnailDataUrl: null,
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

  it("normalizes legacy aura placement scales to the minimum scale", () => {
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
          scale: AuraPlacementScaleSettings.minPersistedScale,
          opacity: 1,
        },
      ],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };

    expect(ProfileSchema.parse(profile).overlayPlacements[0]?.scale).toBe(
      AuraPlacementScaleSettings.minScale,
    );
  });

  it("accepts arched aura crop regions with bounded arc metadata", () => {
    const profile = {
      id: "profile-1",
      name: "Default",
      game: "poe1",
      targetFps: 30,
      captureTarget: null,
      cropRegions: [
        {
          id: "crop-1",
          label: "Arched aura 1",
          shape: "arc",
          x: 10,
          y: 20,
          width: 140,
          height: 80,
          arc: {
            startX: 10,
            startY: 70,
            endX: 130,
            endY: 70,
            controlX: 70,
            controlY: 10,
            thickness: 20,
          },
        },
      ],
      overlayPlacements: [],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    const cropRegion = profile.cropRegions[0]!;

    expect(ProfileSchema.parse(profile)).toEqual(profile);
    expect(() =>
      ProfileSchema.parse({
        ...profile,
        cropRegions: [{ ...cropRegion, arc: undefined }],
      }),
    ).toThrow("Arched crop regions require arc metadata.");
    expect(() =>
      ProfileSchema.parse({
        ...profile,
        cropRegions: [
          {
            ...cropRegion,
            arc: {
              ...cropRegion.arc,
              endX: cropRegion.width + 1,
            },
          },
        ],
      }),
    ).toThrow("Arc coordinates must stay within crop bounds.");
    expect(() =>
      ProfileSchema.parse({
        ...profile,
        cropRegions: [
          {
            ...cropRegion,
            arc: {
              ...cropRegion.arc,
              controlY: cropRegion.height + 1,
            },
          },
        ],
      }),
    ).toThrow("Arc coordinates must stay within crop bounds.");
  });

  it("accepts pointer aura crop regions with bounded point metadata", () => {
    const profile = {
      id: "profile-1",
      name: "Default",
      game: "poe1",
      targetFps: 30,
      captureTarget: null,
      cropRegions: [
        {
          id: "crop-1",
          label: "Pointer aura 1",
          shape: "points",
          x: 10,
          y: 20,
          width: 80,
          height: 120,
          points: [
            { x: 5, y: 5 },
            { x: 20, y: 60 },
          ],
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
          pointGap: AuraPointPlacementSettings.defaultGap,
          pointSampleSize: AuraPointPlacementSettings.defaultSampleSize,
        },
      ],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    const cropRegion = profile.cropRegions[0]!;

    expect(ProfileSchema.parse(profile)).toEqual(profile);
    expect(() =>
      ProfileSchema.parse({
        ...profile,
        overlayPlacements: [
          {
            id: "placement-1",
            cropRegionId: "crop-1",
            x: 30,
            y: 40,
            scale: 1,
            opacity: 1,
            pointGap: AuraPointPlacementSettings.maxGap + 1,
            pointSampleSize: AuraPointPlacementSettings.defaultSampleSize,
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      ProfileSchema.parse({
        ...profile,
        overlayPlacements: [
          {
            id: "placement-1",
            cropRegionId: "crop-1",
            x: 30,
            y: 40,
            scale: 1,
            opacity: 1,
            pointGap: AuraPointPlacementSettings.defaultGap,
            pointSampleSize: AuraPointPlacementSettings.maxSampleSize + 1,
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      ProfileSchema.parse({
        ...profile,
        cropRegions: [{ ...cropRegion, points: undefined }],
      }),
    ).toThrow("Pointer crop regions require point metadata.");
    expect(() =>
      ProfileSchema.parse({
        ...profile,
        cropRegions: [
          {
            ...cropRegion,
            points: [
              {
                x: cropRegion.width + 1,
                y: 5,
              },
            ],
          },
        ],
      }),
    ).toThrow("Pointer coordinates must stay within crop bounds.");
    expect(() =>
      ProfileSchema.parse({
        ...profile,
        cropRegions: [
          {
            ...cropRegion,
            points: [
              {
                x: 5,
                y: cropRegion.height + 1,
              },
            ],
          },
        ],
      }),
    ).toThrow("Pointer coordinates must stay within crop bounds.");
  });

  it("normalizes legacy pointer aura sample sizes to the render minimum", () => {
    const profile = {
      id: "profile-1",
      name: "Default",
      game: "poe1",
      targetFps: 30,
      captureTarget: null,
      cropRegions: [
        {
          id: "crop-1",
          label: "Pointer aura 1",
          shape: "points",
          x: 10,
          y: 20,
          width: 80,
          height: 120,
          points: [{ x: 5, y: 5 }],
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
          pointGap: AuraPointPlacementSettings.defaultGap,
          pointSampleSize: AuraPointPlacementSettings.minSampleSize - 10,
        },
      ],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };

    expect(
      ProfileSchema.parse(profile).overlayPlacements[0]?.pointSampleSize,
    ).toBe(AuraPointPlacementSettings.minSampleSize);
  });

  it("strips obsolete arched aura thickness scale from saved placements", () => {
    const profile = {
      id: "profile-1",
      name: "Default",
      game: "poe1",
      targetFps: 30,
      captureTarget: null,
      cropRegions: [],
      overlayPlacements: [
        {
          id: "placement-1",
          cropRegionId: "crop-1",
          x: 30,
          y: 40,
          scale: 1,
          opacity: 1,
          arcThicknessScale: 2,
        },
      ],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };

    expect(
      ProfileSchema.parse(profile).overlayPlacements[0],
    ).not.toHaveProperty("arcThicknessScale");
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
