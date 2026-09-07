import { describe, expect, it } from "vitest";

import { resolveAuraPlacementGeometry } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createPlacementPropertiesUpdate } from "./useAuraOverlayPlacementProperties.utils";

describe("useAuraOverlayPlacementProperties utils", () => {
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

  it("edits center-relative aura coordinates across reference-resolution projection", () => {
    const crop = {
      height: 100,
      id: "crop-1",
      label: "Aura",
      width: 20,
      x: 0,
      y: 0,
    };
    const result = createPlacementPropertiesUpdate(
      {
        cropRegionId: "crop-1",
        height: 100,
        id: "placement-1",
        opacity: 1,
        referenceHeight: 1080,
        referenceWidth: 1920,
        rotationDegrees: 90,
        scale: 1,
        width: 20,
        x: 100,
        y: 200,
      },
      crop,
      { centerOffsetX: -240, centerOffsetY: -300 },
      { height: 1440, width: 2560 },
      null,
    );
    const visualBounds = resolveAuraPlacementGeometry(
      crop,
      result.placement,
      { height: 1440, width: 2560 },
      null,
    ).visualBounds;

    expect(visualBounds.x + visualBounds.width / 2 - 2560 / 2).toBeCloseTo(
      -240,
      5,
    );
    expect(1440 / 2 - (visualBounds.y + visualBounds.height / 2)).toBeCloseTo(
      -300,
      5,
    );
  });

  it("scales a rotated placement without moving its visual center", () => {
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
      x: 90,
      y: 150,
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

  it("keeps rotated pointer aura centers fixed when their sample size changes", () => {
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
      x: 95,
      y: 185,
    });
  });

  it("resets configurable properties while preserving identity and visual center", () => {
    const crop = {
      height: 80,
      id: "crop-1",
      label: "Aura",
      width: 120,
      x: 0,
      y: 0,
    };
    const placement = {
      clipShape: "circle" as const,
      contentZoomPercent: 160,
      cornerRadius: 4,
      cropRegionId: "crop-1",
      height: 140,
      hideResizeControls: true,
      iconOffsetX: 12,
      iconOffsetY: -8,
      id: "placement-1",
      mirrored: true,
      opacity: 0.5,
      outlineColor: "#123456",
      outlineThickness: 3,
      rotationDegrees: 90 as const,
      scale: 2,
      shadowColor: "#654321",
      shadowSpread: 6,
      width: 200,
      x: 100,
      y: 200,
    };
    const viewport = { height: 1080, width: 1920 };
    const before = resolveAuraPlacementGeometry(
      crop,
      placement,
      viewport,
    ).visualBounds;

    const reset = createPlacementPropertiesUpdate(
      placement,
      crop,
      { resetToDefaults: true },
      viewport,
      null,
    ).placement;
    const after = resolveAuraPlacementGeometry(
      crop,
      reset,
      viewport,
    ).visualBounds;

    expect(Object.keys(reset).sort()).toEqual([
      "cropRegionId",
      "id",
      "opacity",
      "scale",
      "x",
      "y",
    ]);
    expect(reset).toMatchObject({
      cropRegionId: "crop-1",
      id: "placement-1",
      opacity: 1,
      scale: 1,
    });
    expect(after.x + after.width / 2).toBeCloseTo(before.x + before.width / 2);
    expect(after.y + after.height / 2).toBeCloseTo(
      before.y + before.height / 2,
    );
  });

  it("restores pointer spacing defaults when resetting", () => {
    const reset = createPlacementPropertiesUpdate(
      {
        cropRegionId: "crop-1",
        id: "placement-1",
        opacity: 0.5,
        pointGap: 4,
        pointSampleSize: 40,
        scale: 2,
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
      { resetToDefaults: true },
      { height: 1080, width: 1920 },
      null,
    ).placement;

    expect(reset).toMatchObject({
      opacity: 1,
      pointGap: 20,
      pointSampleSize: 20,
      scale: 1,
    });
  });

  it("applies and removes bounded per-aura effects", () => {
    const placement = {
      cornerRadius: 3,
      cropRegionId: "crop-1",
      hideResizeControls: false,
      id: "placement-1",
      opacity: 1,
      outlineColor: "#111111",
      outlineThickness: 2,
      scale: 1,
      shadowColor: "#222222",
      shadowSpread: 4,
      x: 10,
      y: 20,
    };
    const crop = {
      height: 80,
      id: "crop-1",
      label: "Aura",
      width: 120,
      x: 100,
      y: 120,
    };

    expect(
      createPlacementPropertiesUpdate(
        placement,
        crop,
        {
          clipShape: "shield",
          contentZoomPercent: -10,
          cornerRadius: 999,
          hideResizeControls: true,
          iconOffsetX: 12.7,
          iconOffsetY: -200_000,
          outlineColor: "#ABCDEF",
          outlineThickness: 999,
          shadowColor: "#fedcba",
          shadowSpread: 999,
        },
        { height: 1080, width: 1920 },
        null,
      ).placement,
    ).toMatchObject({
      clipShape: "shield",
      contentZoomPercent: 10,
      cornerRadius: 10,
      hideResizeControls: true,
      iconOffsetX: 13,
      iconOffsetY: -100_000,
      outlineColor: "#abcdef",
      outlineThickness: 20,
      shadowColor: "#fedcba",
      shadowSpread: 32,
    });

    const cleared = createPlacementPropertiesUpdate(
      placement,
      crop,
      {
        clipShape: null,
        cornerRadius: null,
        outlineColor: null,
        outlineThickness: null,
        shadowColor: null,
        shadowSpread: null,
      },
      { height: 1080, width: 1920 },
      null,
    ).placement;
    expect(cleared.clipShape).toBeUndefined();
    expect(cleared.cornerRadius).toBeUndefined();
    expect(cleared.outlineThickness).toBeUndefined();
    expect(cleared.outlineColor).toBeUndefined();
    expect(cleared.shadowSpread).toBeUndefined();
    expect(cleared.shadowColor).toBeUndefined();

    const resetZoom = createPlacementPropertiesUpdate(
      {
        ...placement,
        contentZoomPercent: 60,
        iconOffsetX: 12,
        iconOffsetY: -8,
      },
      crop,
      { contentZoomPercent: 100, iconOffsetX: 0, iconOffsetY: 0 },
      { height: 1080, width: 1920 },
      null,
    ).placement;
    expect(resetZoom.contentZoomPercent).toBeUndefined();
    expect(resetZoom.iconOffsetX).toBeUndefined();
    expect(resetZoom.iconOffsetY).toBeUndefined();
  });
});
