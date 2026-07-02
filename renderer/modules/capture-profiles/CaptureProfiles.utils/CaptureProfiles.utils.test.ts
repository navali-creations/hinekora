import { describe, expect, it } from "vitest";

import { type CaptureProfile, createDefaultSettings } from "~/types";
import {
  createSettingsUpdateFromCaptureProfile,
  getCaptureProfileDisplayName,
  isDefaultCaptureProfile,
  resolveActiveGameCaptureProfile,
  resolveCaptureProfileForGame,
  resolveSelectedCaptureProfile,
  sortCaptureProfilesForDisplay,
} from "./CaptureProfiles.utils";

function createProfile(
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
    recordingFps: 30,
    recordingHideOverlaysFromRecording: true,
    recordingHideOverlaysFromRewind: true,
    recordingOutputResolution: "native",
    recordingRunQuality: "moderate",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaptureProfiles utils", () => {
  it("shortens default capture profile names for display", () => {
    expect(
      getCaptureProfileDisplayName(
        createProfile({ isDefault: true, name: "Custom name" }),
      ),
    ).toBe("Default PoE 1 Profile");

    expect(
      getCaptureProfileDisplayName(
        createProfile({
          game: "poe2",
          isDefault: true,
          name: "Custom name",
        }),
      ),
    ).toBe("Default PoE 2 Profile");
    expect(
      getCaptureProfileDisplayName(
        createProfile({ name: "Default PoE Profile Capture" }),
      ),
    ).toBe("Default PoE Profile Capture");
  });

  it("detects default capture profiles by explicit identity", () => {
    expect(isDefaultCaptureProfile(createProfile({ isDefault: true }))).toBe(
      true,
    );
    expect(isDefaultCaptureProfile(createProfile({ name: "Bossing" }))).toBe(
      false,
    );
    expect(
      isDefaultCaptureProfile(
        createProfile({ name: "Default PoE Profile Capture" }),
      ),
    ).toBe(false);
  });

  it("keeps capture profiles grouped by game for stable settings rows", () => {
    const poe2 = createProfile({
      game: "poe2",
      id: "poe2",
      name: "Default PoE 2 Profile Capture",
    });
    const poe1 = createProfile({
      game: "poe1",
      id: "poe1",
      name: "Default PoE Profile Capture",
    });

    expect(
      sortCaptureProfilesForDisplay([poe2, poe1]).map(({ id }) => id),
    ).toEqual(["poe1", "poe2"]);
  });

  it("uses the active-game fallback when the selected profile belongs to another game", () => {
    const poe1 = createProfile({
      game: "poe1",
      id: "poe1",
      name: "PoE 1 Capture",
    });
    const poe2 = createProfile({
      game: "poe2",
      id: "poe2",
      name: "PoE 2 Capture",
    });

    expect(resolveActiveGameCaptureProfile([poe1, poe2], "poe1", "poe2")).toBe(
      poe2,
    );
    expect(
      resolveActiveGameCaptureProfile([poe1, poe2], "missing", "poe2"),
    ).toBe(poe2);
  });

  it("resolves a capture profile only from the requested game", () => {
    const poe1 = createProfile({
      game: "poe1",
      id: "poe1",
      name: "PoE 1 Capture",
    });
    const poe2 = createProfile({
      game: "poe2",
      id: "poe2",
      name: "PoE 2 Capture",
    });

    expect(resolveCaptureProfileForGame([poe1, poe2], "poe1", "poe2")).toBe(
      poe2,
    );
    expect(resolveCaptureProfileForGame([poe1, poe2], "poe2", "poe2")).toBe(
      poe2,
    );
    expect(resolveSelectedCaptureProfile([poe1, poe2], "poe1")).toBe(poe1);
    expect(resolveSelectedCaptureProfile([poe1, poe2], "missing")).toBeNull();
  });

  it("switches active game and reuses that game's stored league setting", () => {
    expect(
      createSettingsUpdateFromCaptureProfile(
        createProfile({ game: "poe1", id: "poe1" }),
        {
          ...createDefaultSettings(),
          activeGame: "poe2",
          activeLeague: "Runes of Aldur",
          poe1SelectedLeague: "Mirage",
          poe2SelectedLeague: "Runes of Aldur",
        },
      ),
    ).toMatchObject({
      activeGame: "poe1",
      activeLeague: "Mirage",
      selectedCaptureProfileId: "poe1",
      selectedCaptureProfileIdsByGame: {
        poe1: "poe1",
      },
    });
  });
});
