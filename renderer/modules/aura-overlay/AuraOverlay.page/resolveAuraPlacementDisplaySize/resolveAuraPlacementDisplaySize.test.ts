import { describe, expect, it } from "vitest";

import { AuraPointPlacementSettings } from "~/types";
import {
  resolveAuraPlacementContentDelta,
  resolveAuraPlacementContentPosition,
  resolveAuraPlacementDisplaySize,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementReferencePosition,
  resolveAuraPlacementVisualBounds,
  resolveAuraPlacementVisualPoint,
  resolveAuraPlacementVisualSize,
} from "./resolveAuraPlacementDisplaySize";

describe("resolveAuraPlacementDisplaySize", () => {
  it("resolves pointer aura display size from sample size and point gap", () => {
    expect(
      resolveAuraPlacementDisplaySize(
        {
          id: "crop-points",
          label: "Pointer aura",
          shape: "points",
          x: 90,
          y: 90,
          width: 140,
          height: 80,
          points: [
            { x: 10, y: 10 },
            { x: 90, y: 40 },
            { x: 130, y: 70 },
          ],
        },
        {
          id: "placement-1",
          cropRegionId: "crop-points",
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          pointGap: AuraPointPlacementSettings.defaultGap,
          pointSampleSize: AuraPointPlacementSettings.defaultSampleSize,
        },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ width: 20, height: 100 });
  });

  it("keeps placement scale below one at the minimum scale", () => {
    expect(
      resolveAuraPlacementDisplaySize(
        {
          id: "crop-points",
          label: "Pointer aura",
          shape: "points",
          x: 90,
          y: 90,
          width: 140,
          height: 80,
          points: [
            { x: 10, y: 10 },
            { x: 90, y: 40 },
          ],
        },
        {
          id: "placement-1",
          cropRegionId: "crop-points",
          x: 0,
          y: 0,
          scale: 0.1,
          opacity: 1,
          pointGap: AuraPointPlacementSettings.defaultGap,
          pointSampleSize: AuraPointPlacementSettings.defaultSampleSize,
        },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ width: 20, height: 60 });
  });

  it("clamps tiny persisted aura sizes to the minimum rendered dimension", () => {
    expect(
      resolveAuraPlacementDisplaySize(
        {
          id: "crop-1",
          label: "Life",
          x: 10,
          y: 20,
          width: 100,
          height: 40,
        },
        {
          id: "placement-1",
          cropRegionId: "crop-1",
          height: 1,
          opacity: 1,
          scale: 1,
          width: 1,
          x: 0,
          y: 0,
        },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ width: 10, height: 10 });
  });

  it("swaps quarter-turn visual bounds around the original center", () => {
    const placement = {
      cropRegionId: "crop-1",
      id: "placement-1",
      opacity: 1,
      rotationDegrees: 90 as const,
      scale: 1,
      x: 100,
      y: 200,
    };
    const contentSize = { height: 100, width: 20 };

    expect(resolveAuraPlacementVisualSize(placement, contentSize)).toEqual({
      height: 20,
      width: 100,
    });
    expect(
      resolveAuraPlacementVisualBounds(
        placement,
        { x: 100, y: 200 },
        contentSize,
      ),
    ).toEqual({ height: 20, width: 100, x: 60, y: 240 });
    expect(
      resolveAuraPlacementContentPosition(
        placement,
        { x: 60, y: 240 },
        contentSize,
      ),
    ).toEqual({ x: 100, y: 200 });
  });

  it("keeps half-turn visual bounds unchanged", () => {
    const placement = {
      cropRegionId: "crop-1",
      id: "placement-1",
      opacity: 1,
      rotationDegrees: 180 as const,
      scale: 1,
      x: 100,
      y: 200,
    };

    expect(
      resolveAuraPlacementVisualBounds(
        placement,
        { x: 100, y: 200 },
        { height: 100, width: 20 },
      ),
    ).toEqual({ height: 100, width: 20, x: 100, y: 200 });
  });

  it("keeps a quarter-turn visual box at the viewport edge with negative content coordinates", () => {
    const crop = {
      height: 20,
      id: "crop-1",
      label: "Aura",
      width: 100,
      x: 0,
      y: 0,
    };
    const placement = {
      cropRegionId: "crop-1",
      height: 20,
      id: "placement-1",
      opacity: 1,
      rotationDegrees: 270 as const,
      scale: 1,
      width: 100,
      x: -40,
      y: 40,
    };

    expect(
      resolveAuraPlacementGeometry(
        crop,
        placement,
        { height: 1080, width: 1920 },
        { height: 1080, width: 1920 },
      ).visualBounds,
    ).toEqual({ height: 100, width: 20, x: 0, y: 0 });
    expect(
      resolveAuraPlacementReferencePosition(
        crop,
        placement,
        { x: 0, y: 0 },
        { height: 1080, width: 1920 },
        { height: 1080, width: 1920 },
      ),
    ).toEqual({ x: -40, y: 40 });
  });

  it("applies mirroring and rotation consistently to points and deltas", () => {
    const placement = {
      cropRegionId: "crop-1",
      id: "placement-1",
      mirrored: true,
      opacity: 1,
      rotationDegrees: 90 as const,
      scale: 1,
      x: 0,
      y: 0,
    };

    expect(
      resolveAuraPlacementVisualPoint(placement, { x: 20, y: 70 }),
    ).toEqual({ x: 30, y: 80 });
    expect(
      resolveAuraPlacementContentDelta(placement, { x: 10, y: 20 }),
    ).toEqual({ x: -20, y: -10 });
    expect(
      resolveAuraPlacementVisualPoint(
        { ...placement, rotationDegrees: 270 },
        { x: 20, y: 70 },
      ),
    ).toEqual({ x: 70, y: 20 });
  });
});
