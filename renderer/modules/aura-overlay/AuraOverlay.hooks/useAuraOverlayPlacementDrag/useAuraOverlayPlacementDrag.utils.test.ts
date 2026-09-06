import { describe, expect, it } from "vitest";

import type { Profile } from "~/types";
import {
  createAuraOverlaySnapContext,
  resolveAuraOverlayDragSnap,
} from "./useAuraOverlayPlacementDrag.utils";

const profile: Profile = {
  captureTarget: null,
  createdAt: new Date(0).toISOString(),
  cropRegions: [
    {
      height: 40,
      id: "crop-1",
      label: "Aura 1",
      width: 100,
      x: 0,
      y: 0,
    },
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
      cropRegionId: "crop-1",
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

describe("useAuraOverlayPlacementDrag utilities", () => {
  it("creates center and peer-aura snap guides in display coordinates", () => {
    expect(
      createAuraOverlaySnapContext({
        fallbackReferenceViewport: { height: 1080, width: 1920 },
        gridCellSize: { height: 30, width: 32 },
        guideViewport: { height: 760, width: 1280 },
        placementId: "placement-1",
        profile,
        targetViewport: { height: 1080, width: 1920 },
      }),
    ).toEqual({
      displayHeight: 40,
      displayWidth: 100,
      gridCellHeight: 30,
      gridCellWidth: 32,
      xGuides: [
        { anchor: "center", kind: "viewport-center", position: 640 },
        { anchor: "start", kind: "placement", position: 200 },
        { anchor: "center", kind: "placement", position: 250 },
        { anchor: "end", kind: "placement", position: 300 },
      ],
      yGuides: [
        { anchor: "center", kind: "viewport-center", position: 380 },
        { anchor: "start", kind: "placement", position: 220 },
        { anchor: "center", kind: "placement", position: 240 },
        { anchor: "end", kind: "placement", position: 260 },
      ],
    });
  });

  it("creates snap dimensions and guides from rotated visual bounds", () => {
    const rotatedProfile = {
      ...profile,
      overlayPlacements: profile.overlayPlacements.map((placement) => ({
        ...placement,
        rotationDegrees: 90 as const,
      })),
    };

    expect(
      createAuraOverlaySnapContext({
        fallbackReferenceViewport: { height: 1080, width: 1920 },
        gridCellSize: { height: 30, width: 32 },
        guideViewport: { height: 760, width: 1280 },
        placementId: "placement-1",
        profile: rotatedProfile,
        targetViewport: { height: 1080, width: 1920 },
      }),
    ).toMatchObject({
      displayHeight: 100,
      displayWidth: 40,
      xGuides: [
        { anchor: "center", kind: "viewport-center", position: 640 },
        { anchor: "start", kind: "placement", position: 230 },
        { anchor: "center", kind: "placement", position: 250 },
        { anchor: "end", kind: "placement", position: 270 },
      ],
      yGuides: [
        { anchor: "center", kind: "viewport-center", position: 380 },
        { anchor: "start", kind: "placement", position: 190 },
        { anchor: "center", kind: "placement", position: 240 },
        { anchor: "end", kind: "placement", position: 290 },
      ],
    });
  });

  it("returns no context when the selected placement or crop is unavailable", () => {
    expect(
      createAuraOverlaySnapContext({
        fallbackReferenceViewport: null,
        gridCellSize: { height: 32, width: 32 },
        guideViewport: { height: 1080, width: 1920 },
        placementId: "missing",
        profile,
        targetViewport: { height: 1080, width: 1920 },
      }),
    ).toBeNull();
    expect(
      createAuraOverlaySnapContext({
        fallbackReferenceViewport: null,
        gridCellSize: { height: 32, width: 32 },
        guideViewport: { height: 1080, width: 1920 },
        placementId: "placement-1",
        profile: { ...profile, cropRegions: [] },
        targetViewport: { height: 1080, width: 1920 },
      }),
    ).toBeNull();
  });

  it("ignores peer placements whose crop no longer exists", () => {
    const context = createAuraOverlaySnapContext({
      fallbackReferenceViewport: null,
      gridCellSize: { height: 32, width: 32 },
      guideViewport: { height: 1080, width: 1920 },
      placementId: "placement-1",
      profile: {
        ...profile,
        overlayPlacements: [
          profile.overlayPlacements[0]!,
          {
            ...profile.overlayPlacements[1]!,
            cropRegionId: "missing-crop",
          },
        ],
      },
      targetViewport: { height: 1080, width: 1920 },
    });

    expect(context?.xGuides).toEqual([
      { anchor: "center", kind: "viewport-center", position: 960 },
    ]);
    expect(context?.yGuides).toEqual([
      { anchor: "center", kind: "viewport-center", position: 540 },
    ]);
  });

  it("snaps close centers to guides and otherwise snaps top-left coordinates to the grid", () => {
    const snapContext = {
      displayHeight: 40,
      displayWidth: 100,
      gridCellHeight: 32,
      gridCellWidth: 32,
      xGuides: [
        {
          anchor: "center" as const,
          kind: "viewport-center" as const,
          position: 640,
        },
        {
          anchor: "center" as const,
          kind: "placement" as const,
          position: 250,
        },
      ],
      yGuides: [
        {
          anchor: "center" as const,
          kind: "viewport-center" as const,
          position: 380,
        },
        {
          anchor: "center" as const,
          kind: "placement" as const,
          position: 240,
        },
      ],
    };

    expect(
      resolveAuraOverlayDragSnap({ rawX: 196, rawY: 217, snapContext }),
    ).toEqual({
      guideX: { anchor: "center", kind: "placement", position: 250 },
      guideY: { anchor: "center", kind: "placement", position: 240 },
      x: 200,
      y: 220,
    });
    expect(
      resolveAuraOverlayDragSnap({ rawX: 589, rawY: 359, snapContext }),
    ).toEqual({
      guideX: {
        anchor: "center",
        kind: "viewport-center",
        position: 640,
      },
      guideY: {
        anchor: "center",
        kind: "viewport-center",
        position: 380,
      },
      x: 590,
      y: 360,
    });
    expect(
      resolveAuraOverlayDragSnap({ rawX: 47, rawY: 77, snapContext }),
    ).toEqual({
      guideX: null,
      guideY: null,
      x: 32,
      y: 64,
    });
  });

  it("uses the closest guide within the configured threshold", () => {
    expect(
      resolveAuraOverlayDragSnap({
        rawX: 199,
        rawY: 0,
        snapContext: {
          displayHeight: 10,
          displayWidth: 100,
          gridCellHeight: 32,
          gridCellWidth: 32,
          xGuides: [
            { anchor: "center", kind: "viewport-center", position: 244 },
            { anchor: "center", kind: "placement", position: 250 },
          ],
          yGuides: [],
        },
      }),
    ).toMatchObject({
      guideX: { anchor: "center", kind: "placement", position: 250 },
      x: 200,
    });
  });

  it("snaps matching placement borders within five pixels", () => {
    const snapContext = {
      displayHeight: 40,
      displayWidth: 100,
      gridCellHeight: 32,
      gridCellWidth: 32,
      xGuides: [
        { anchor: "start" as const, kind: "placement" as const, position: 200 },
      ],
      yGuides: [
        { anchor: "end" as const, kind: "placement" as const, position: 260 },
      ],
    };

    expect(
      resolveAuraOverlayDragSnap({ rawX: 205, rawY: 215, snapContext }),
    ).toEqual({
      guideX: { anchor: "start", kind: "placement", position: 200 },
      guideY: { anchor: "end", kind: "placement", position: 260 },
      x: 200,
      y: 220,
    });
    expect(
      resolveAuraOverlayDragSnap({ rawX: 206, rawY: 214, snapContext }),
    ).toEqual({
      guideX: null,
      guideY: null,
      x: 192,
      y: 224,
    });
  });
});
