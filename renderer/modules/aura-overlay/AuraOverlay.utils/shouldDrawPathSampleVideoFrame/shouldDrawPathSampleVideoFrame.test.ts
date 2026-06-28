import { describe, expect, it } from "vitest";

import { shouldDrawPathSampleVideoFrame } from "./shouldDrawPathSampleVideoFrame";

describe("shouldDrawPathSampleVideoFrame", () => {
  it("draws the first frame and gates later frames to the 60fps budget", () => {
    expect(shouldDrawPathSampleVideoFrame(1_000, null)).toBe(true);
    expect(shouldDrawPathSampleVideoFrame(1_016, 1_000)).toBe(false);
    expect(shouldDrawPathSampleVideoFrame(1_017, 1_000)).toBe(true);
  });
});
