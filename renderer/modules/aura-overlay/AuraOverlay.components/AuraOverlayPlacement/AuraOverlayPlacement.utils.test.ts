import { describe, expect, it } from "vitest";

import {
  createAuraPlacementClipShapePolygonPoints,
  createPlacementContentStyle,
  resolveAuraPlacementClipPath,
} from "./AuraOverlayPlacement.utils";

describe("AuraOverlayPlacement utilities", () => {
  it("centers transformed content inside its visual selection bounds", () => {
    expect(
      createPlacementContentStyle(
        {
          cropRegionId: "crop-1",
          cornerRadius: 6,
          id: "placement-1",
          mirrored: true,
          opacity: 1,
          rotationDegrees: 90,
          scale: 1,
          x: 0,
          y: 0,
        },
        { height: 211, width: 23 },
      ),
    ).toEqual({
      borderRadius: "6px",
      height: "211px",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%) rotate(90deg) scaleX(-1)",
      width: "23px",
    });
  });

  it("resolves default-aura clip paths and effect polygons", () => {
    expect(resolveAuraPlacementClipPath(undefined)).toBeUndefined();
    expect(resolveAuraPlacementClipPath("circle")).toBe(
      "ellipse(50% 50% at 50% 50%)",
    );
    expect(resolveAuraPlacementClipPath("shield")).toMatch(/^polygon\(/);
    expect(resolveAuraPlacementClipPath("octagon")).toMatch(/^polygon\(/);
    expect(
      createAuraPlacementClipShapePolygonPoints("circle", {
        height: 100,
        width: 100,
      }),
    ).toBeNull();
    expect(
      createAuraPlacementClipShapePolygonPoints("shield", {
        height: 200,
        width: 100,
      }),
    ).toContain("50,0");
  });
});
