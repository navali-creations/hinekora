import { describe, expect, it } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import {
  getCellClassName,
  getHeaderClassName,
  hasPlayableClip,
  resolveSortBy,
} from "./ReplayClipsPanel.utils";

describe("ReplayClipsPanel utils", () => {
  it("detects playable clips from available media paths", () => {
    expect(hasPlayableClip(createReplayClip())).toBe(false);
    expect(
      hasPlayableClip(createReplayClip({ processedClipPath: "clip.mp4" })),
    ).toBe(true);
    expect(
      hasPlayableClip(createReplayClip({ originalObsPath: "original.mp4" })),
    ).toBe(true);
  });

  it("resolves supported sort keys with a created-at fallback", () => {
    expect(resolveSortBy("name")).toBe("name");
    expect(resolveSortBy("sizeBytes")).toBe("sizeBytes");
    expect(resolveSortBy("unknown")).toBe("createdAt");
    expect(resolveSortBy(undefined)).toBe("createdAt");
  });

  it("returns stable table cell and header classes", () => {
    expect(getHeaderClassName("select")).toContain("w-12");
    expect(getHeaderClassName("actions")).toContain("text-right");
    expect(getCellClassName("name")).toContain("max-w-0");
    expect(getCellClassName("targetDurationSeconds")).toContain("tabular-nums");
  });
});
