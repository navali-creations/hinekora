import { describe, expect, it } from "vitest";

import { createReplayClipView } from "~/main/test/factories/replayClip";

import {
  getCellClassName,
  getHeaderClassName,
  getRowClassName,
  resolveSortBy,
} from "./ReplayClipsPanel.utils";

describe("ReplayClipsPanel utils", () => {
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

  it("dims unavailable rows", () => {
    expect(
      getRowClassName(
        createReplayClipView({ hasMediaFile: true, sizeBytes: 1 }),
      ),
    ).toBe("");
    expect(getRowClassName(createReplayClipView())).toContain(
      "text-base-content/45",
    );
  });
});
