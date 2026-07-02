import { describe, expect, it } from "vitest";

import type { Profile } from "~/types";
import {
  getProfilesForGame,
  resolveActiveGameProfile,
  sortProfilesForDisplay,
} from "./Profiles.utils";

function createProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    captureTarget: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    cropRegions: [],
    game: "poe1",
    id: "profile-1",
    name: "PoE 1",
    overlayPlacements: [],
    targetFps: 60,
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveActiveGameProfile", () => {
  it("filters profiles by game", () => {
    const profiles = [
      createProfile(),
      createProfile({ game: "poe2", id: "profile-2", name: "PoE 2" }),
    ];

    expect(getProfilesForGame(profiles, "poe2")).toEqual([profiles[1]]);
  });

  it("uses the selected profile when it belongs to the active game", () => {
    const profiles = [
      createProfile(),
      createProfile({ game: "poe2", id: "profile-2", name: "PoE 2" }),
    ];

    expect(resolveActiveGameProfile(profiles, "profile-2", "poe2")).toBe(
      profiles[1],
    );
  });

  it("falls back to the active game profile when selected profile belongs to another game", () => {
    const profiles = [
      createProfile(),
      createProfile({ game: "poe2", id: "profile-2", name: "PoE 2" }),
    ];

    expect(resolveActiveGameProfile(profiles, "profile-2", "poe1")).toBe(
      profiles[0],
    );
  });

  it("does not fall back to a profile from another game", () => {
    const profiles = [createProfile()];

    expect(resolveActiveGameProfile(profiles, "profile-1", "poe2")).toBeNull();
  });

  it("keeps aura profiles grouped by game for stable settings rows", () => {
    const profiles = [
      createProfile({ game: "poe2", id: "poe2-b", name: "Bossing" }),
      createProfile({ game: "poe1", id: "poe1-b", name: "Mapping" }),
      createProfile({ game: "poe2", id: "poe2-a", name: "Default PoE 2" }),
      createProfile({ game: "poe1", id: "poe1-a", name: "Default PoE 1" }),
    ];

    expect(sortProfilesForDisplay(profiles).map(({ id }) => id)).toEqual([
      "poe1-a",
      "poe1-b",
      "poe2-b",
      "poe2-a",
    ]);
  });
});
