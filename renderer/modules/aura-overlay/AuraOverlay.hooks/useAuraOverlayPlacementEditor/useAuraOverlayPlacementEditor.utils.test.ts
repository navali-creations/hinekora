import { describe, expect, it } from "vitest";

import { createPlacementPropertiesUpdate } from "./useAuraOverlayPlacementEditor.utils";

describe("useAuraOverlayPlacementEditor utils", () => {
  it("updates crop labels and placement opacity from property patches", () => {
    const result = createPlacementPropertiesUpdate(
      {
        cropRegionId: "crop-1",
        id: "placement-1",
        opacity: 1,
        scale: 1,
        x: 10,
        y: 20,
      },
      {
        height: 80,
        id: "crop-1",
        label: "Aura",
        width: 120,
        x: 100,
        y: 120,
      },
      {
        label: " Renamed aura ",
        opacity: 0.45,
      },
      { width: 1920, height: 1080 },
      null,
    );

    expect(result.crop.label).toBe("Renamed aura");
    expect(result.placement.opacity).toBe(0.45);
  });

  it("edits rotated visual dimensions while preserving the visual top-left", () => {
    const result = createPlacementPropertiesUpdate(
      {
        cropRegionId: "crop-1",
        height: 100,
        id: "placement-1",
        opacity: 1,
        rotationDegrees: 90,
        scale: 1,
        width: 20,
        x: 100,
        y: 200,
      },
      {
        height: 100,
        id: "crop-1",
        label: "Aura",
        width: 20,
        x: 0,
        y: 0,
      },
      { displayWidth: 120 },
      { height: 1080, width: 1920 },
      null,
    );

    expect(result.placement).toMatchObject({
      height: 120,
      width: 20,
      x: 110,
      y: 190,
    });
  });

  it("scales a rotated placement without moving its visual top-left", () => {
    const result = createPlacementPropertiesUpdate(
      {
        cropRegionId: "crop-1",
        height: 100,
        id: "placement-1",
        opacity: 1,
        rotationDegrees: 90,
        scale: 1,
        width: 20,
        x: 100,
        y: 200,
      },
      {
        height: 100,
        id: "crop-1",
        label: "Aura",
        width: 20,
        x: 0,
        y: 0,
      },
      { scale: 2 },
      { height: 1080, width: 1920 },
      null,
    );

    expect(result.placement).toMatchObject({
      scale: 2,
      x: 140,
      y: 160,
    });
  });

  it("preserves negative content coordinates at a rotated viewport edge", () => {
    const result = createPlacementPropertiesUpdate(
      {
        cropRegionId: "crop-1",
        height: 20,
        id: "placement-1",
        opacity: 1,
        rotationDegrees: 90,
        scale: 1,
        width: 100,
        x: -40,
        y: 40,
      },
      {
        height: 20,
        id: "crop-1",
        label: "Aura",
        width: 100,
        x: 0,
        y: 0,
      },
      { displayWidth: 40 },
      { height: 1080, width: 1920 },
      null,
    );

    expect(result.placement).toMatchObject({
      height: 40,
      width: 100,
      x: -30,
      y: 30,
    });
  });

  it("keeps rotated pointer auras anchored when their sample size changes", () => {
    const result = createPlacementPropertiesUpdate(
      {
        cropRegionId: "crop-1",
        id: "placement-1",
        opacity: 1,
        pointGap: 20,
        pointSampleSize: 20,
        rotationDegrees: 90,
        scale: 1,
        x: 100,
        y: 200,
      },
      {
        height: 100,
        id: "crop-1",
        label: "Pointer",
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 50 },
          { x: 90, y: 90 },
        ],
        shape: "points",
        width: 100,
        x: 0,
        y: 0,
      },
      { pointSampleSize: 30 },
      { height: 1080, width: 1920 },
      null,
    );

    expect(result.placement).toMatchObject({
      pointSampleSize: 30,
      x: 110,
      y: 190,
    });
  });
});
