import { describe, expect, it, vi } from "vitest";

import type { Profile } from "~/types";
import {
  createAuraProfileUpdateFromSelection,
  createPlacementForCrop,
  getSelectedProfile,
  resolveActiveAuraCropRegionId,
  resolveSelectionPlacementViewport,
} from "./CropEditor.utils";

const profile: Profile = {
  id: "profile-1",
  name: "Default",
  game: "poe1",
  targetFps: 30,
  captureTarget: null,
  cropRegions: [
    {
      id: "crop-1",
      label: "Source 1",
      x: 10,
      y: 20,
      width: 300,
      height: 120,
    },
    {
      id: "crop-2",
      label: "Source 2",
      x: 30,
      y: 40,
      width: 220,
      height: 80,
    },
  ],
  overlayPlacements: [
    {
      id: "placement-1",
      cropRegionId: "crop-1",
      x: 24,
      y: 24,
      scale: 1,
      opacity: 1,
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("CropEditor utils", () => {
  it("centers default aura placements in the selection viewport", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000000",
    );

    expect(
      createPlacementForCrop(profile.cropRegions[0]!, 2, {
        width: 1920,
        height: 1080,
      }),
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000000",
      cropRegionId: "crop-1",
      x: 846,
      y: 516,
      scale: 1,
      opacity: 1,
      referenceWidth: 1920,
      referenceHeight: 1080,
    });
  });

  it("keeps a visible fallback placement without viewport dimensions", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000000",
    );

    expect(createPlacementForCrop(profile.cropRegions[0]!, 2)).toEqual({
      id: "00000000-0000-4000-8000-000000000000",
      cropRegionId: "crop-1",
      x: 60,
      y: 60,
      scale: 1,
      opacity: 1,
    });
  });

  it("creates an aura crop, placement, and profile update from a selection", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");

    const result = createAuraProfileUpdateFromSelection(profile, {
      x: 100,
      y: 120,
      width: 50,
      height: 60,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    expect(result.crop).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      label: "Aura 3",
      x: 100,
      y: 120,
      width: 50,
      height: 60,
      referenceWidth: 1920,
      referenceHeight: 1080,
    });
    expect(result.placement).toEqual({
      id: "00000000-0000-4000-8000-000000000002",
      cropRegionId: "00000000-0000-4000-8000-000000000001",
      x: 953,
      y: 528,
      scale: 1,
      opacity: 1,
      referenceWidth: 1920,
      referenceHeight: 1080,
    });
    expect(result.profileUpdate).toEqual({
      id: "profile-1",
      cropRegions: [...profile.cropRegions, result.crop],
      overlayPlacements: [...profile.overlayPlacements, result.placement],
    });
  });

  it("resolves viewport dimensions from crop selections", () => {
    expect(
      resolveSelectionPlacementViewport({
        viewportWidth: 1920,
        viewportHeight: 1080,
      }),
    ).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(resolveSelectionPlacementViewport({})).toBeUndefined();
    expect(
      resolveSelectionPlacementViewport({
        viewportWidth: 0,
        viewportHeight: 1080,
      }),
    ).toBeUndefined();
  });

  it("resolves the selected profile with an active-game fallback", () => {
    const otherProfile = {
      ...profile,
      game: "poe2" as const,
      id: "profile-2",
      name: "Other",
    };

    expect(
      getSelectedProfile([profile, otherProfile], "profile-2", "poe2"),
    ).toBe(otherProfile);
    expect(
      getSelectedProfile([profile, otherProfile], "profile-2", "poe1"),
    ).toBe(profile);
    expect(getSelectedProfile([profile, otherProfile], "missing", "poe2")).toBe(
      otherProfile,
    );
    expect(getSelectedProfile([profile], "profile-1", "poe2")).toBeNull();
    expect(getSelectedProfile([], null, "poe1")).toBeNull();
  });

  it("resolves the selected aura with a first-source fallback", () => {
    expect(resolveActiveAuraCropRegionId(profile, "crop-2")).toBe("crop-2");
    expect(resolveActiveAuraCropRegionId(profile, "missing")).toBe("crop-1");
    expect(resolveActiveAuraCropRegionId(profile, null)).toBe("crop-1");
    expect(
      resolveActiveAuraCropRegionId({ ...profile, cropRegions: [] }, "crop-1"),
    ).toBeNull();
    expect(resolveActiveAuraCropRegionId(null, "crop-1")).toBeNull();
  });
});
