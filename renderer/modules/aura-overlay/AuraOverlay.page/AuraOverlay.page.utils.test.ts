import { describe, expect, it } from "vitest";

import {
  createAuraVideoStyle,
  readAuraVideoSize,
  resizeAuraPlacementFromCorner,
} from "./AuraOverlay.page.utils";

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

  it("reads available video dimensions from a aura video element", () => {
    expect(readAuraVideoSize({ videoWidth: 2560, videoHeight: 1440 })).toEqual({
      width: 2560,
      height: 1440,
    });
  });

  it("ignores aura video elements before dimensions are available", () => {
    expect(readAuraVideoSize({ videoWidth: 0, videoHeight: 0 })).toBeNull();
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
});
