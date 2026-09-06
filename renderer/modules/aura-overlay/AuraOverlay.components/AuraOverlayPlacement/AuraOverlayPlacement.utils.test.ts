import { describe, expect, it } from "vitest";

import { createPlacementContentStyle } from "./AuraOverlayPlacement.utils";

describe("AuraOverlayPlacement utilities", () => {
  it("centers transformed content inside its visual selection bounds", () => {
    expect(
      createPlacementContentStyle(
        {
          cropRegionId: "crop-1",
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
      height: "211px",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%) rotate(90deg) scaleX(-1)",
      width: "23px",
    });
  });
});
