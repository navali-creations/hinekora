import { describe, expect, it } from "vitest";

import type { CropRegion, OverlayPlacement, Profile } from "~/types";
import {
  createAuraOverlayScaleSnapContext,
  resizeAuraPlacementWithPeerScaleSnap,
} from "./useAuraOverlayPlacementResize.utils";

const crop: CropRegion = {
  height: 100,
  id: "crop-1",
  label: "Aura 1",
  width: 100,
  x: 0,
  y: 0,
};
const placement: OverlayPlacement = {
  cropRegionId: crop.id,
  id: "placement-1",
  opacity: 1,
  scale: 1,
  x: 300,
  y: 300,
};
const profile: Profile = {
  captureTarget: null,
  createdAt: new Date(0).toISOString(),
  cropRegions: [crop],
  game: "poe1",
  id: "profile-1",
  name: "Default",
  overlayPlacements: [
    placement,
    {
      ...placement,
      id: "placement-2",
      scale: 1.5,
      x: 600,
      y: 300,
    },
  ],
  targetFps: 30,
  updatedAt: new Date(0).toISOString(),
};
const viewport = { height: 1080, width: 1920 };
const scaleSnapContext = createAuraOverlayScaleSnapContext({
  crop,
  placement,
  profile,
  referenceViewport: viewport,
  targetViewport: viewport,
});

describe("useAuraOverlayPlacementResize utilities", () => {
  it("snaps a southeast resize to a peer aura scale within five pixels", () => {
    expect(
      resizeAuraPlacementWithPeerScaleSnap({
        corner: "se",
        crop,
        deltaX: 47,
        deltaY: 47,
        placement,
        referenceViewport: viewport,
        scaleSnapContext,
        targetViewport: viewport,
      }),
    ).toMatchObject({ scale: 1.5, x: 300, y: 300 });
  });

  it("keeps the opposite corner fixed when a northwest resize snaps", () => {
    expect(
      resizeAuraPlacementWithPeerScaleSnap({
        corner: "nw",
        crop,
        deltaX: -47,
        deltaY: -47,
        placement,
        referenceViewport: viewport,
        scaleSnapContext,
        targetViewport: viewport,
      }),
    ).toMatchObject({ scale: 1.5, x: 250, y: 250 });
  });

  it("keeps the free resize scale outside the threshold", () => {
    expect(
      resizeAuraPlacementWithPeerScaleSnap({
        corner: "se",
        crop,
        deltaX: 44,
        deltaY: 44,
        placement,
        referenceViewport: viewport,
        scaleSnapContext,
        targetViewport: viewport,
      }).scale,
    ).toBe(1.44);
  });

  it("ignores placements without a valid aura crop", () => {
    const missingPeerCropContext = createAuraOverlayScaleSnapContext({
      crop,
      placement,
      profile: {
        ...profile,
        overlayPlacements: [
          placement,
          { ...profile.overlayPlacements[1]!, cropRegionId: "missing" },
        ],
      },
      referenceViewport: viewport,
      targetViewport: viewport,
    });

    expect(missingPeerCropContext.peerScales).toEqual([]);
    expect(
      resizeAuraPlacementWithPeerScaleSnap({
        corner: "se",
        crop,
        deltaX: 47,
        deltaY: 47,
        placement,
        referenceViewport: viewport,
        scaleSnapContext: missingPeerCropContext,
        targetViewport: viewport,
      }).scale,
    ).toBe(1.47);
  });

  it("keeps an exact peer scale without a second resize adjustment", () => {
    expect(
      resizeAuraPlacementWithPeerScaleSnap({
        corner: "se",
        crop,
        deltaX: 50,
        deltaY: 50,
        placement,
        referenceViewport: viewport,
        scaleSnapContext,
        targetViewport: viewport,
      }),
    ).toMatchObject({ scale: 1.5, x: 300, y: 300 });
  });

  it("snaps matched explicit dimensions without using the original crop size", () => {
    const matchedPlacement = {
      ...placement,
      height: 75,
      referenceHeight: viewport.height,
      referenceWidth: viewport.width,
      width: 150,
    };
    const matchedScaleSnapContext = createAuraOverlayScaleSnapContext({
      crop,
      placement: matchedPlacement,
      profile: {
        ...profile,
        overlayPlacements: [matchedPlacement, profile.overlayPlacements[1]!],
      },
      referenceViewport: viewport,
      targetViewport: viewport,
    });

    expect(
      resizeAuraPlacementWithPeerScaleSnap({
        corner: "nw",
        crop,
        deltaX: -71,
        deltaY: -35.5,
        placement: matchedPlacement,
        referenceViewport: viewport,
        scaleSnapContext: matchedScaleSnapContext,
        targetViewport: viewport,
      }),
    ).toMatchObject({ scale: 1.5, x: 225, y: 263 });
  });
});
