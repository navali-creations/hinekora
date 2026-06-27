import { describe, expect, it } from "vitest";

import type { Profile } from "~/types";
import {
  createAuraCropClipPath,
  createAuraHistorySnapshot,
  createAuraProfileUpdateDeletingPlacement,
  createAuraProfileUpdateFromSnapshot,
  createAuraVideoStyle,
  createAuraViewportProjection,
  isAuraResizeCorner,
  projectAuraBox,
  readAuraRouteParams,
  readAuraVideoSize,
  resizeAuraPlacementFromCorner,
  resolveAuraPlacementArcVisibleThickness,
  unprojectAuraPoint,
} from "./AuraOverlay.page.utils";

const profile: Profile = {
  id: "profile-1",
  name: "Default",
  game: "poe1",
  targetFps: 30,
  captureTarget: null,
  cropRegions: [
    {
      id: "crop-1",
      label: "Life",
      x: 10,
      y: 20,
      width: 100,
      height: 40,
    },
    {
      id: "crop-2",
      label: "Mana",
      x: 200,
      y: 220,
      width: 80,
      height: 36,
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
    {
      id: "placement-2",
      cropRegionId: "crop-2",
      x: 300,
      y: 340,
      scale: 1,
      opacity: 0.8,
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("AuraOverlay utils", () => {
  it("positions the captured video behind the cropped aura window", () => {
    expect(
      createAuraVideoStyle(
        {
          id: "crop-1",
          label: "Life",
          x: 100,
          y: 50,
          width: 200,
          height: 80,
        },
        {
          id: "placement-1",
          cropRegionId: "crop-1",
          x: 24,
          y: 24,
          scale: 2,
          opacity: 1,
        },
        { width: 1920, height: 1080 },
      ),
    ).toMatchObject({
      left: "-200px",
      top: "-100px",
      width: "3840px",
      height: "2160px",
    });
  });

  it("creates a polygon clip path for arched aura crops", () => {
    const clipPath = createAuraCropClipPath({
      id: "crop-arc",
      label: "Arched aura",
      shape: "arc",
      x: 90,
      y: 90,
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
    });

    expect(clipPath).toMatch(/^polygon\(/);
    expect(clipPath).toContain("%");
    expect(
      createAuraCropClipPath({
        id: "crop-1",
        label: "Life",
        x: 10,
        y: 20,
        width: 100,
        height: 40,
      }),
    ).toBeUndefined();
  });

  it("resolves arched aura thickness from explicit visible thickness or source thickness", () => {
    const crop = {
      id: "crop-arc",
      label: "Shield",
      shape: "arc" as const,
      x: 90,
      y: 90,
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
    };
    const placement = {
      id: "placement-1",
      cropRegionId: "crop-arc",
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
    };

    expect(resolveAuraPlacementArcVisibleThickness(crop, placement)).toBe(20);
    expect(
      resolveAuraPlacementArcVisibleThickness(crop, {
        ...placement,
        arcVisibleThickness: 36,
      }),
    ).toBe(36);
  });

  it("projects legacy 16:9 coordinates into a centered ultrawide safe area", () => {
    const referenceViewport = { width: 1920, height: 1080 };
    const targetViewport = { width: 3440, height: 1440 };

    expect(
      createAuraViewportProjection(referenceViewport, targetViewport),
    ).toEqual({
      offsetX: 440,
      offsetY: 0,
      scale: 4 / 3,
    });

    const projectedBox = projectAuraBox(
      { x: 30, y: 40, width: 100, height: 40 },
      referenceViewport,
      targetViewport,
    );

    expect(projectedBox.x).toBeCloseTo(480);
    expect(projectedBox.y).toBeCloseTo(160 / 3);
    expect(projectedBox.width).toBeCloseTo(400 / 3);
    expect(projectedBox.height).toBeCloseTo(160 / 3);
    expect(
      unprojectAuraPoint(projectedBox, referenceViewport, targetViewport),
    ).toEqual({
      x: 30,
      y: 40,
    });
  });

  it("reads available video dimensions from a aura video element", () => {
    expect(readAuraVideoSize({ videoWidth: 2560, videoHeight: 1440 })).toEqual({
      width: 2560,
      height: 1440,
    });
  });

  it("ignores aura video elements before dimensions are available", () => {
    expect(readAuraVideoSize({ videoWidth: 0, videoHeight: 0 })).toBeNull();
  });

  it("reads aura overlay route query parameters from a hash", () => {
    const params = readAuraRouteParams(
      "#/aura-overlay?profileId=profile-1&startAddingAura=1",
    );

    expect(params.get("profileId")).toBe("profile-1");
    expect(params.get("startAddingAura")).toBe("1");
  });

  it("recognizes supported aura resize corners", () => {
    expect(isAuraResizeCorner("nw")).toBe(true);
    expect(isAuraResizeCorner("middle")).toBe(false);
    expect(isAuraResizeCorner(undefined)).toBe(false);
  });

  it("resizes a aura placement from a corner by updating scale", () => {
    expect(
      resizeAuraPlacementFromCorner(
        {
          id: "crop-1",
          label: "Life",
          x: 100,
          y: 50,
          width: 200,
          height: 80,
        },
        {
          id: "placement-1",
          cropRegionId: "crop-1",
          x: 24,
          y: 24,
          scale: 1,
          opacity: 1,
        },
        "se",
        100,
        10,
      ),
    ).toMatchObject({
      x: 24,
      y: 24,
      scale: 1.5,
    });
  });

  it("resizes projected aura placements without baking in ultrawide offsets", () => {
    expect(
      resizeAuraPlacementFromCorner(
        {
          id: "crop-1",
          label: "Life",
          x: 100,
          y: 50,
          width: 200,
          height: 80,
        },
        {
          id: "placement-1",
          cropRegionId: "crop-1",
          x: 24,
          y: 24,
          scale: 1,
          opacity: 1,
        },
        "nw",
        -40,
        -1,
        { width: 3440, height: 1440 },
        { width: 1920, height: 1080 },
      ),
    ).toMatchObject({
      x: 0,
      y: 12,
      scale: 1.15,
      referenceWidth: 1920,
      referenceHeight: 1080,
    });
  });

  it("creates cloned aura history snapshots and profile updates", () => {
    const snapshot = createAuraHistorySnapshot(profile);

    expect(snapshot).toEqual({
      cropRegions: profile.cropRegions,
      overlayPlacements: profile.overlayPlacements,
    });
    expect(snapshot.cropRegions[0]).not.toBe(profile.cropRegions[0]);
    expect(createAuraProfileUpdateFromSnapshot("profile-1", snapshot)).toEqual({
      id: "profile-1",
      cropRegions: profile.cropRegions,
      overlayPlacements: profile.overlayPlacements,
    });
  });

  it("deletes the selected aura crop and every placement that uses it", () => {
    expect(
      createAuraProfileUpdateDeletingPlacement(profile, "placement-1"),
    ).toEqual({
      id: "profile-1",
      cropRegions: [profile.cropRegions[1]],
      overlayPlacements: [profile.overlayPlacements[1]],
    });
    expect(
      createAuraProfileUpdateDeletingPlacement(profile, "missing"),
    ).toBeNull();
  });
});
