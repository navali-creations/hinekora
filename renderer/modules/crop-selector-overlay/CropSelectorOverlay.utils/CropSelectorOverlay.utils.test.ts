import { describe, expect, it } from "vitest";

import {
  createArcCropSelection,
  createCropSelection,
  isUsableCropSelection,
} from "./CropSelectorOverlay.utils";

describe("CropSelectorOverlay utils", () => {
  it("normalizes a drag from bottom-right to top-left", () => {
    expect(createCropSelection({ x: 320, y: 240 }, { x: 80, y: 60 })).toEqual({
      x: 80,
      y: 60,
      width: 240,
      height: 180,
    });
  });

  it("requires a usable minimum selection size", () => {
    expect(isUsableCropSelection({ x: 0, y: 0, width: 7, height: 20 })).toBe(
      false,
    );
    expect(isUsableCropSelection({ x: 0, y: 0, width: 20, height: 20 })).toBe(
      true,
    );
  });

  it("creates an arched selection from start, end, and curve points", () => {
    expect(
      createArcCropSelection(
        { x: 100, y: 160 },
        { x: 220, y: 160 },
        { x: 160, y: 100 },
      ),
    ).toEqual({
      shape: "arc",
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
    });
  });
});
