import { describe, expect, it } from "vitest";

import {
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
});
