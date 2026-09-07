import { describe, expect, it } from "vitest";

import type { Profile } from "~/types";
import {
  createAuraOverlayAreaSelectionBounds,
  findAuraPlacementsInArea,
  isUsableAuraAreaSelection,
} from "./useAuraOverlayAreaSelection.utils";

const profile: Profile = {
  captureTarget: null,
  createdAt: new Date(0).toISOString(),
  cropRegions: [
    { height: 40, id: "crop-1", label: "Aura 1", width: 100, x: 0, y: 0 },
    { height: 30, id: "crop-2", label: "Aura 2", width: 30, x: 0, y: 0 },
  ],
  game: "poe1",
  id: "profile-1",
  name: "Default",
  overlayPlacements: [
    {
      cropRegionId: "crop-1",
      id: "placement-1",
      opacity: 1,
      scale: 1,
      x: 30,
      y: 40,
    },
    {
      cropRegionId: "crop-2",
      id: "placement-2",
      opacity: 1,
      scale: 1,
      x: 200,
      y: 220,
    },
  ],
  targetFps: 30,
  updatedAt: new Date(0).toISOString(),
};

describe("aura overlay area selection utilities", () => {
  it("normalizes a rectangle drawn in any direction", () => {
    expect(
      createAuraOverlayAreaSelectionBounds(
        { x: 160, y: 120 },
        { x: 20, y: 30 },
      ),
    ).toEqual({ height: 90, width: 140, x: 20, y: 30 });
  });

  it("requires a visible drag area", () => {
    expect(isUsableAuraAreaSelection({ height: 4, width: 4, x: 0, y: 0 })).toBe(
      true,
    );
    expect(
      isUsableAuraAreaSelection({ height: 3, width: 40, x: 0, y: 0 }),
    ).toBe(false);
  });

  it("selects every aura intersecting the marquee", () => {
    expect(
      findAuraPlacementsInArea({
        bounds: { height: 230, width: 215, x: 20, y: 30 },
        profile,
        referenceViewport: null,
        targetViewport: { height: 1080, width: 1920 },
      }),
    ).toEqual(["placement-1", "placement-2"]);
  });

  it("ignores missing crops and auras outside the marquee", () => {
    expect(
      findAuraPlacementsInArea({
        bounds: { height: 40, width: 100, x: 30, y: 40 },
        profile: {
          ...profile,
          overlayPlacements: [
            profile.overlayPlacements[1]!,
            {
              ...profile.overlayPlacements[0]!,
              cropRegionId: "missing",
            },
          ],
        },
        referenceViewport: null,
        targetViewport: { height: 1080, width: 1920 },
      }),
    ).toEqual([]);
  });
});
