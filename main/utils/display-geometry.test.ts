import { describe, expect, it } from "vitest";

import {
  createDisplayDimensionsLookup,
  getNativeDisplayDimensions,
} from "./display-geometry";

describe("display geometry", () => {
  it("uses native pixel dimensions for scaled displays", () => {
    expect(
      getNativeDisplayDimensions({
        id: 1,
        size: { width: 1280, height: 720 },
        scaleFactor: 1.5,
      }),
    ).toEqual({ width: 1920, height: 1080 });
  });

  it("indexes native dimensions by display id", () => {
    expect(
      createDisplayDimensionsLookup([
        {
          id: 2,
          size: { width: 2560, height: 1440 },
          scaleFactor: 1,
        },
      ]).get("2"),
    ).toEqual({ width: 2560, height: 1440 });
  });
});
