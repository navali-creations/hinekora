import { describe, expect, it } from "vitest";

import { createPlacementContentTransform } from "./AuraOverlayPlacement.utils";

describe("AuraOverlayPlacement utilities", () => {
  it("creates the placement rotation and mirror transform", () => {
    expect(
      createPlacementContentTransform({
        cropRegionId: "crop-1",
        id: "placement-1",
        mirrored: true,
        opacity: 1,
        rotationDegrees: 90,
        scale: 1,
        x: 0,
        y: 0,
      }),
    ).toBe("rotate(90deg) scaleX(-1)");
  });
});
