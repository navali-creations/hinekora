import { describe, expect, it } from "vitest";

import {
  createAuraPlacementEffectGeometry,
  resolveAuraPlacementEffectPadding,
} from "./AuraPlacementEffects.utils";

const arcCrop = {
  arc: {
    controlX: 50,
    controlY: 10,
    endX: 90,
    endY: 70,
    startX: 10,
    startY: 70,
    thickness: 20,
  },
  height: 80,
  id: "arc",
  label: "Arc",
  shape: "arc" as const,
  width: 100,
  x: 0,
  y: 0,
};

describe("AuraPlacementEffects utilities", () => {
  it("uses the curved aura boundary for non-straightened arcs", () => {
    const geometry = createAuraPlacementEffectGeometry(
      arcCrop,
      { height: 80, width: 100 },
      false,
      20,
    );

    expect(geometry.shape).toBe("arc");
    expect(geometry.polygonPoints).toMatch(/^\d/);
  });

  it("uses a rectangle for ordinary and straightened placements", () => {
    expect(
      createAuraPlacementEffectGeometry(
        { ...arcCrop, shape: "rect", arc: undefined },
        { height: 80, width: 100 },
        false,
      ),
    ).toEqual({ polygonPoints: null, shape: "rect" });
    expect(
      createAuraPlacementEffectGeometry(
        arcCrop,
        { height: 80, width: 100 },
        true,
        20,
      ),
    ).toEqual({ polygonPoints: null, shape: "rect" });
  });

  it("uses the selected geometry for shaped default auras", () => {
    const rectCrop = { ...arcCrop, shape: "rect" as const, arc: undefined };

    expect(
      createAuraPlacementEffectGeometry(
        rectCrop,
        { height: 80, width: 100 },
        false,
        undefined,
        "circle",
      ),
    ).toEqual({ polygonPoints: null, shape: "circle" });
    expect(
      createAuraPlacementEffectGeometry(
        rectCrop,
        { height: 80, width: 100 },
        false,
        undefined,
        "shield",
      ),
    ).toEqual({
      polygonPoints: expect.stringContaining("50,0"),
      shape: "shield",
    });
  });

  it("pads the filter for the larger bounded effect", () => {
    expect(
      resolveAuraPlacementEffectPadding({
        cropRegionId: "crop-1",
        id: "placement-1",
        opacity: 1,
        outlineThickness: 20,
        scale: 1,
        shadowSpread: 4,
        x: 0,
        y: 0,
      }),
    ).toBe(20);
    expect(
      resolveAuraPlacementEffectPadding({
        cropRegionId: "crop-1",
        id: "placement-1",
        opacity: 1,
        scale: 1,
        shadowSpread: 32,
        x: 0,
        y: 0,
      }),
    ).toBe(44);
  });
});
