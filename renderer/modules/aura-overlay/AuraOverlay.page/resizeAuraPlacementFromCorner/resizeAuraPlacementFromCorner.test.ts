import { describe, expect, it } from "vitest";

import { resizeAuraPlacementFromCorner } from "./resizeAuraPlacementFromCorner";

describe("resizeAuraPlacementFromCorner", () => {
  it("resizes an aura placement from a corner by updating scale", () => {
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
        -500,
        -500,
      ),
    ).toMatchObject({
      x: 24,
      y: 24,
      scale: 1,
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

  it("uses explicit matched dimensions as the resize base", () => {
    expect(
      resizeAuraPlacementFromCorner(
        {
          id: "crop-1",
          label: "Life",
          x: 100,
          y: 50,
          width: 40,
          height: 40,
        },
        {
          id: "placement-1",
          cropRegionId: "crop-1",
          height: 75,
          opacity: 1,
          scale: 1,
          width: 150,
          x: 24,
          y: 24,
        },
        "nw",
        -10,
        -5,
      ),
    ).toMatchObject({
      x: 14,
      y: 19,
      scale: 1.067,
    });
  });

  it("uses projected explicit dimensions while preserving the opposite corner", () => {
    expect(
      resizeAuraPlacementFromCorner(
        {
          id: "crop-1",
          label: "Life",
          x: 100,
          y: 50,
          width: 40,
          height: 40,
        },
        {
          id: "placement-1",
          cropRegionId: "crop-1",
          height: 75,
          opacity: 1,
          referenceHeight: 1080,
          referenceWidth: 1920,
          scale: 1,
          width: 150,
          x: 300,
          y: 300,
        },
        "nw",
        -75,
        -37.5,
        { width: 1920, height: 1080 },
        { width: 1920, height: 1080 },
      ),
    ).toMatchObject({
      x: 225,
      y: 263,
      scale: 1.5,
    });
  });
});
