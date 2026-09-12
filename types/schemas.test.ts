import { describe, expect, it } from "vitest";

import {
  getCurrentLeague,
  PoeLeagueProviderRecordSchema,
} from "./game-leagues";
import { clampRewindSaveSeconds } from "./recording";
import {
  AppSettingsSchema,
  AppSettingsUpdateSchema,
  AuraPlacementScaleSettings,
  AuraPointPlacementSettings,
  appSettingsKeys,
  CapturePreviewSourceSchema,
  CaptureProfileCreateInputSchema,
  CaptureProfileSchema,
  CaptureProfileSettingsSchema,
  CaptureProfileUpdateInputSchema,
  captureProfileSettingKeys,
  createCoordinateReferenceDimensions,
  createDefaultCaptureProfile,
  createDefaultSettings,
  normalizePersistedRecordingOutputResolution,
  normalizeRecordingEncoderChoice,
  OverlayPlacementSchema,
  ProfileCreateInputSchema,
  ProfileDuplicateInputSchema,
  ProfileSchema,
  ProfileUpdateInputSchema,
  RecorderOverlayBoundsSchema,
  RecordingOutputResolutionSchema,
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
      overlayDevToolsEnabled: false,
      recorderOverlayShowOnStartup: true,
      recorderOverlayStartMinimized: false,
      recorderOverlayIgnoreGameFocus: false,
      auraOverlayIgnoreGameFocus: false,
      overlayWindowsIncludeInCaptures: false,
      auraOverlayEnableSnapping: false,
      auraOverlayHideLabels: false,
      auraOverlayHidePropertiesPanel: false,
      auraOverlayShowCenterGuides: false,
      auraOverlayShowEditingFrame: true,
      auraOverlayShowEditingGrid: false,
      clipPreviewOverlayIgnoreGameFocus: false,
      gridLinesOverlayIgnoreGameFocus: false,
      installedGames: ["poe1"],
      recordingStoragePath: null,
      editorExportStoragePath: null,
      editorExportMaxStorageGb: 50,
      keybindManualBookmark: "Alt+B",
      keybindManualReplay: "Alt+C",
      replayClipPreviewResolution: "720p",
      recordingOutputResolution: "native",
      recordingFps: 30,
      recordingEncoder: "hardware_h264",
      recordingClipQuality: "high",
      recordingRunQuality: "moderate",
      recordingAudioInputDeviceId: null,
      recordingAudioOutputDeviceId: null,
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
      recordingTrackBookmarksInRewind: true,
      recordingAutoStartMode: "off",
      manualReplayShowPreview: true,
      selectedCaptureProfileId: null,
      selectedCaptureProfileIdsByGame: {},
      selectedProfileId: null,
      recordingMaxStorageGb: 50,
      poe1ClientTxtPath: null,
      poe2ClientTxtPath: null,
      poe1CharacterName: "",
      poe2CharacterName: "",
      captureModeInfoAlertDismissed: false,
      clipPreviewInfoAlertDismissed: false,
      groupPlayDeathAlertDismissed: false,
      recorderSettingsInfoAlertDismissed: false,
      captureTemplatesBannerDismissed: false,
      activeGame: "poe1",
      activeLeague: getCurrentLeague("poe1"),
      poe1SelectedLeague: getCurrentLeague("poe1"),
      poe2SelectedLeague: getCurrentLeague("poe2"),
      poe1MediaLibraryLeague: null,
      poe2MediaLibraryLeague: null,
      clipsLibraryView: "death",
      editorMediaFilter: "death-clip",
      editorAutoPruneProjects: true,
      editorLogEnabled: false,
      deathClipsEnabled: true,
      deathClipSeconds: 10,
      manualReplaySeconds: 10,
      telemetryCrashReporting: true,
      lastSeenAppVersion: null,
      onboardingDismissedBeacons: [],
    });
  });

  it("tracks app settings keys from the schema", () => {
    expect(new Set(appSettingsKeys)).toEqual(
      new Set(Object.keys(createDefaultSettings())),
    );
    expect(appSettingsKeys).toContain("recordingHideOverlaysFromRecording");
    expect(appSettingsKeys).toContain("keybindManualBookmark");
    expect(appSettingsKeys).toContain("replayClipPreviewResolution");
    expect(appSettingsKeys).toContain("recorderOverlayShowOnStartup");
    expect(appSettingsKeys).toContain("recorderOverlayStartMinimized");
    expect(appSettingsKeys).toContain("recorderOverlayIgnoreGameFocus");
    expect(appSettingsKeys).toContain("auraOverlayIgnoreGameFocus");
    expect(appSettingsKeys).toContain("overlayDevToolsEnabled");
    expect(appSettingsKeys).toContain("overlayWindowsIncludeInCaptures");
    expect(appSettingsKeys).toContain("auraOverlayEnableSnapping");
    expect(appSettingsKeys).toContain("auraOverlayHideLabels");
    expect(appSettingsKeys).toContain("auraOverlayHidePropertiesPanel");
    expect(appSettingsKeys).toContain("auraOverlayShowCenterGuides");
    expect(appSettingsKeys).toContain("auraOverlayShowEditingFrame");
    expect(appSettingsKeys).toContain("auraOverlayShowEditingGrid");
    expect(appSettingsKeys).toContain("clipPreviewOverlayIgnoreGameFocus");
    expect(appSettingsKeys).toContain("gridLinesOverlayIgnoreGameFocus");
    expect(appSettingsKeys).not.toContain("recordingHideOverlaysFromCapture");
  });

  it("validates strict settings deltas without materializing defaults", () => {
    expect(AppSettingsUpdateSchema.parse({ appStartMinimized: true })).toEqual({
      appStartMinimized: true,
    });
    expect(
      AppSettingsUpdateSchema.parse({ keybindManualBookmark: "ctrl + m" }),
    ).toEqual({ keybindManualBookmark: "Ctrl+M" });
    expect(() =>
      AppSettingsUpdateSchema.parse({ unsupportedSetting: true }),
    ).toThrow();
    expect(() =>
      AppSettingsUpdateSchema.parse({ appStartMinimized: undefined }),
    ).toThrow();
  });

  it("accepts only supported replay clip preview resolutions", () => {
    expect(
      AppSettingsSchema.parse({ replayClipPreviewResolution: "1080p" })
        .replayClipPreviewResolution,
    ).toBe("1080p");
    expect(() =>
      AppSettingsSchema.parse({ replayClipPreviewResolution: "4k" }),
    ).toThrow();
  });

  it("normalizes legacy recording resolutions and rejects unsupported sizes", () => {
    expect(RecordingOutputResolutionSchema.parse("1080p")).toBe("1920x1080");
    expect(RecordingOutputResolutionSchema.parse("4K")).toBe("3840x2160");
    expect(RecordingOutputResolutionSchema.parse("3440x1440")).toBe(
      "3440x1440",
    );

    for (const resolution of ["854x480", "999999x999999", "", 1080]) {
      expect(
        RecordingOutputResolutionSchema.safeParse(resolution).success,
      ).toBe(false);
    }
  });

  it("falls back safely when a persisted recording resolution is unsupported", () => {
    expect(normalizePersistedRecordingOutputResolution("1080p")).toBe(
      "1920x1080",
    );
    expect(normalizePersistedRecordingOutputResolution("854x480")).toBe(
      "native",
    );
    expect(normalizePersistedRecordingOutputResolution(null)).toBe("native");
  });

  it("tracks capture profile setting keys from the profile settings schema", () => {
    expect(new Set(captureProfileSettingKeys)).toEqual(
      new Set(Object.keys(CaptureProfileSettingsSchema.shape)),
    );
    expect(captureProfileSettingKeys).toContain("recordingAutoStartMode");
    expect(captureProfileSettingKeys).toContain("deathClipsEnabled");
    expect(captureProfileSettingKeys).toContain("manualReplayShowPreview");
    expect(captureProfileSettingKeys).toContain("deathClipSeconds");
    expect(captureProfileSettingKeys).toContain("manualReplaySeconds");
  });

  it("accepts the compact recorder overlay width", () => {
    expect(
      RecorderOverlayBoundsSchema.safeParse({
        x: 0,
        y: 0,
        width: 216,
        height: 42,
      }).success,
    ).toBe(true);
    expect(
      RecorderOverlayBoundsSchema.safeParse({
        x: 0,
        y: 0,
        width: 215,
        height: 42,
      }).success,
    ).toBe(false);
  });

  it("keeps omitted capture profile update settings omitted", () => {
    expect(CaptureProfileUpdateInputSchema.parse({ id: "profile-1" })).toEqual({
      id: "profile-1",
    });
  });

  it("accepts capture settings when creating a capture profile", () => {
    expect(
      CaptureProfileCreateInputSchema.parse({
        captureTarget: {
          game: "poe2",
          id: "window:poe2:1",
          kind: "window",
          label: "Path of Exile 2",
        },
        game: "poe2",
        name: "Balanced 1080p60",
        recordingEncoder: "hardware_h264",
        recordingFps: 60,
        recordingOutputResolution: "1920x1080",
        recordingRunQuality: "moderate",
      }),
    ).toEqual({
      captureTarget: {
        game: "poe2",
        id: "window:poe2:1",
        kind: "window",
        label: "Path of Exile 2",
      },
      game: "poe2",
      name: "Balanced 1080p60",
      recordingEncoder: "hardware_h264",
      recordingFps: 60,
      recordingOutputResolution: "1920x1080",
      recordingRunQuality: "moderate",
    });
  });

  it("defaults and creates capture profile identity fields", () => {
    expect(
      CaptureProfileSchema.parse({
        id: "profile-1",
        name: "Profile 1",
        game: "poe1",
        captureTarget: null,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: "profile-1",
      isDefault: false,
    });
    expect(
      createDefaultCaptureProfile(
        {
          captureTarget: {
            id: "display-1",
            kind: "display",
            label: "Primary display",
          },
          name: "Default PoE Capture",
          game: "poe1",
          recordingEncoder: "hardware_h265",
          recordingFps: 60,
          recordingOutputResolution: "1280x720",
        },
        { id: "default-capture-poe1", isDefault: true },
      ),
    ).toMatchObject({
      id: "default-capture-poe1",
      isDefault: true,
      captureTarget: {
        id: "display-1",
        kind: "display",
        label: "Primary display",
      },
      recordingEncoder: "hardware_h265",
      recordingFps: 60,
      recordingOutputResolution: "1280x720",
    });
  });

  it("rejects empty active leagues", () => {
    expect(() => AppSettingsSchema.parse({ activeLeague: "" })).toThrow();
  });

  it("validates PoE league provider timestamps as ISO datetimes with offsets", () => {
    expect(
      PoeLeagueProviderRecordSchema.parse({
        endAt: null,
        id: "Next League",
        isCurrent: true,
        name: "Next League",
        startAt: "2026-09-01T00:00:00+02:00",
        updatedAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toMatchObject({ id: "Next League" });

    expect(() =>
      PoeLeagueProviderRecordSchema.parse({
        endAt: null,
        id: "Next League",
        isCurrent: true,
        name: "Next League",
        startAt: "2026-09-01",
        updatedAt: null,
      }),
    ).toThrow();
  });

  it("limits rewind save duration to 60 seconds", () => {
    expect(
      AppSettingsSchema.parse({
        deathClipSeconds: 60,
        manualReplaySeconds: 1,
      }),
    ).toMatchObject({
      deathClipSeconds: 60,
      manualReplaySeconds: 1,
    });
    expect(() => AppSettingsSchema.parse({ deathClipSeconds: 61 })).toThrow();
    expect(() =>
      AppSettingsSchema.parse({ manualReplaySeconds: 61 }),
    ).toThrow();
  });

  it("accepts bounded recording auto-start modes", () => {
    expect(
      AppSettingsSchema.parse({ recordingAutoStartMode: "recording" }),
    ).toMatchObject({
      recordingAutoStartMode: "recording",
    });
    expect(
      AppSettingsSchema.parse({ recordingAutoStartMode: "rewind" }),
    ).toMatchObject({
      recordingAutoStartMode: "rewind",
    });
    expect(() =>
      AppSettingsSchema.parse({ recordingAutoStartMode: "session" }),
    ).toThrow();
  });

  it("accepts nullable and normalized global keybind settings", () => {
    expect(
      AppSettingsSchema.parse({
        keybindManualBookmark: null,
        keybindManualReplay: "shift+alt+c",
      }),
    ).toMatchObject({
      keybindManualBookmark: null,
      keybindManualReplay: "Alt+Shift+C",
    });
    expect(
      AppSettingsSchema.parse({ keybindManualBookmark: "b" }),
    ).toMatchObject({
      keybindManualBookmark: "B",
    });
    expect(
      AppSettingsSchema.parse({ keybindManualBookmark: "alt+semicolon" }),
    ).toMatchObject({
      keybindManualBookmark: "Alt+;",
    });
    expect(
      AppSettingsSchema.parse({ keybindManualBookmark: "alt+plus" }),
    ).toMatchObject({
      keybindManualBookmark: "Alt+Plus",
    });
    expect(() =>
      AppSettingsSchema.parse({ keybindManualBookmark: "Mouse4" }),
    ).toThrow();
    expect(() =>
      AppSettingsSchema.parse({ keybindManualBookmark: "xbutton2" }),
    ).toThrow();
    expect(() =>
      AppSettingsSchema.parse({ keybindManualBookmark: "scrollclick" }),
    ).toThrow();
    expect(() =>
      AppSettingsSchema.parse({ keybindManualBookmark: "MouseMiddle" }),
    ).toThrow();
  });

  it("accepts bounded per-game capture profile selection memory", () => {
    expect(
      AppSettingsSchema.parse({
        selectedCaptureProfileIdsByGame: {
          poe1: "capture-poe1",
          poe2: "capture-poe2",
        },
      }),
    ).toMatchObject({
      selectedCaptureProfileIdsByGame: {
        poe1: "capture-poe1",
        poe2: "capture-poe2",
      },
    });
    expect(() =>
      AppSettingsSchema.parse({
        selectedCaptureProfileIdsByGame: {
          poe1: "",
        },
      }),
    ).toThrow();
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

  it("accepts optional per-aura editing and visual effects", () => {
    const placement = {
      clipShape: "shield",
      contentZoomPercent: 75,
      cornerRadius: 6,
      cropRegionId: "crop-1",
      hideResizeControls: true,
      iconOffsetX: -12,
      iconOffsetY: 8,
      id: "placement-1",
      opacity: 1,
      outlineColor: "#12abef",
      outlineThickness: 3,
      scale: 1,
      shadowColor: "#654321",
      shadowSpread: 8,
      x: 30,
      y: 40,
    };

    expect(OverlayPlacementSchema.parse(placement)).toEqual(placement);
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, outlineThickness: 21 }),
    ).toThrow();
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, shadowSpread: 33 }),
    ).toThrow();
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, outlineColor: "black" }),
    ).toThrow();
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, cornerRadius: 11 }),
    ).toThrow();
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, clipShape: "triangle" }),
    ).toThrow();
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, contentZoomPercent: 9 }),
    ).toThrow();
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, contentZoomPercent: 201 }),
    ).toThrow();
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, iconOffsetX: 1.5 }),
    ).toThrow();
    expect(() =>
      OverlayPlacementSchema.parse({ ...placement, iconOffsetY: 100_001 }),
    ).toThrow();
  });

  it("defaults aura profiles to all games and accepts optional game scope updates", () => {
    const profile = {
      id: "profile-1",
      name: "Default",
      game: null,
      targetFps: 30,
      captureTarget: null,
      cropRegions: [],
      overlayPlacements: [],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };

    expect(ProfileSchema.parse(profile)).toEqual(profile);
    expect(ProfileCreateInputSchema.parse({ name: "Mapper" })).toEqual({
      name: "Mapper",
      game: null,
    });
    expect(
      ProfileDuplicateInputSchema.parse({
        sourceId: "profile-1",
        name: "Mapper Copy",
      }),
    ).toEqual({ sourceId: "profile-1", name: "Mapper Copy" });
    expect(
      ProfileUpdateInputSchema.parse({ id: "profile-1", game: null }),
    ).toEqual({
      id: "profile-1",
      game: null,
    });
    expect(
      ProfileCreateInputSchema.parse({ name: "  Mapper  " }),
    ).toMatchObject({ name: "Mapper" });
    expect(
      ProfileDuplicateInputSchema.parse({
        sourceId: "profile-1",
        name: "  Mapper Copy  ",
      }),
    ).toMatchObject({ name: "Mapper Copy" });
    expect(
      ProfileUpdateInputSchema.parse({
        id: "profile-1",
        name: "  Updated  ",
      }),
    ).toMatchObject({ name: "Updated" });
    expect(() => ProfileCreateInputSchema.parse({ name: "   " })).toThrow();
    expect(() =>
      ProfileDuplicateInputSchema.parse({
        sourceId: "profile-1",
        name: "   ",
      }),
    ).toThrow();
    expect(() =>
      ProfileUpdateInputSchema.parse({ id: "profile-1", name: "   " }),
    ).toThrow();
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

  it("normalizes the legacy overlay capture preference in portable bundles", () => {
    const settings = createDefaultSettings() as Record<string, unknown>;
    delete settings.overlayWindowsIncludeInCaptures;
    settings.auraOverlayIncludeInCaptures = true;

    const bundle = StateBundleSchema.parse({
      format: "hinekora-state",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: "0.14.0",
      sections: {
        profiles: [],
        settings,
        replayClips: [],
      },
    });

    expect(bundle.sections.settings.overlayWindowsIncludeInCaptures).toBe(true);
    expect(bundle.sections.settings).not.toHaveProperty(
      "auraOverlayIncludeInCaptures",
    );
  });

  it("defaults a missing portable overlay capture preference", () => {
    const bundle = StateBundleSchema.parse({
      format: "hinekora-state",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: "0.14.0",
      sections: {
        profiles: [],
        settings: {},
        replayClips: [],
      },
    });

    expect(bundle.sections.settings.overlayWindowsIncludeInCaptures).toBe(
      false,
    );
  });

  it.each([null, 42, []])(
    "rejects invalid portable settings input %#",
    (settings) => {
      expect(() =>
        StateBundleSchema.parse({
          format: "hinekora-state",
          formatVersion: 1,
          exportedAt: new Date().toISOString(),
          appVersion: "0.14.0",
          sections: {
            profiles: [],
            settings,
            replayClips: [],
          },
        }),
      ).toThrow();
    },
  );

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
        captureProfiles: [],
        settings,
        replayClips: [],
      },
    });
  });
});
