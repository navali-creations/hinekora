import { describe, expect, it } from "vitest";

import { resolveAuraPlacementArcVisibleThickness } from "./resolveAuraPlacementArcVisibleThickness";

describe("resolveAuraPlacementArcVisibleThickness", () => {
  it("resolves explicit visible thickness or source thickness", () => {
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

  it("keeps clamped thickness integral for fractional display sizes", () => {
    const crop = {
      arc: {
        controlX: 30,
        controlY: 0,
        endX: 60,
        endY: 30,
        startX: 0,
        startY: 30,
        thickness: 10,
      },
      height: 30,
      id: "crop-arc",
      label: "Shield",
      shape: "arc" as const,
      width: 60,
      x: 0,
      y: 0,
    };

    expect(
      resolveAuraPlacementArcVisibleThickness(
        crop,
        {
          arcVisibleThickness: 100,
          cropRegionId: crop.id,
          id: "placement-1",
          opacity: 1,
          scale: 1.333,
          x: 0,
          y: 0,
        },
        { height: 39.99, width: 79.98 },
      ),
    ).toBe(79);
  });
});
