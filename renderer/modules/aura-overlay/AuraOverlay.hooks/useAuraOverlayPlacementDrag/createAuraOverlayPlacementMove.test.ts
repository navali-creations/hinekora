import { describe, expect, it } from "vitest";

import type { Profile } from "~/types";
import { createAuraOverlayPlacementMove } from "./createAuraOverlayPlacementMove";

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

describe("createAuraOverlayPlacementMove", () => {
  it("moves every selected aura by the same display delta", () => {
    const result = createAuraOverlayPlacementMove({
      deltaX: 25,
      deltaY: 15,
      placementIds: ["placement-1", "placement-2"],
      primaryPlacementId: "placement-1",
      profile,
      referenceViewport: { height: 1080, width: 1920 },
      targetViewport: { height: 1080, width: 1920 },
    });

    expect(result).toMatchObject({
      deltaX: 25,
      deltaY: 15,
      update: {
        overlayPlacements: [
          { id: "placement-1", x: 55, y: 55 },
          { id: "placement-2", x: 225, y: 235 },
        ],
      },
    });
  });

  it("clamps the whole group together at the viewport edge", () => {
    const result = createAuraOverlayPlacementMove({
      deltaX: -100,
      deltaY: -100,
      placementIds: ["placement-1", "placement-2"],
      primaryPlacementId: "placement-1",
      profile,
      referenceViewport: { height: 1080, width: 1920 },
      targetViewport: { height: 1080, width: 1920 },
    });

    expect(result).toMatchObject({
      deltaX: -30,
      deltaY: -40,
      update: {
        overlayPlacements: [
          { id: "placement-1", x: 0, y: 0 },
          { id: "placement-2", x: 170, y: 180 },
        ],
      },
    });
  });

  it("does not create an update without a valid movement target", () => {
    expect(
      createAuraOverlayPlacementMove({
        deltaX: 0,
        deltaY: 0,
        placementIds: ["placement-1"],
        primaryPlacementId: "placement-1",
        profile,
        referenceViewport: null,
        targetViewport: { height: 1080, width: 1920 },
      }),
    ).toBeNull();
    expect(
      createAuraOverlayPlacementMove({
        deltaX: 10,
        deltaY: 10,
        placementIds: ["missing"],
        primaryPlacementId: "missing",
        profile,
        referenceViewport: null,
        targetViewport: { height: 1080, width: 1920 },
      }),
    ).toBeNull();
  });
});
