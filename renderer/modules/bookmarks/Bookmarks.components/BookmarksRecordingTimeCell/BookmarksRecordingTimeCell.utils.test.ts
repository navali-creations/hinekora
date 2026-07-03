import { describe, expect, it } from "vitest";

import { calculateBookmarkRecordingProgressPercent } from "./BookmarksRecordingTimeCell.utils";

describe("calculateBookmarkRecordingProgressPercent", () => {
  it("rounds bookmark offset progress inside a recording", () => {
    expect(
      calculateBookmarkRecordingProgressPercent({
        durationSeconds: 120,
        offsetSeconds: 30,
      }),
    ).toBe(25);
  });

  it("clamps invalid or out-of-range recording progress", () => {
    expect(
      calculateBookmarkRecordingProgressPercent({
        durationSeconds: 120,
        offsetSeconds: 180,
      }),
    ).toBe(100);
    expect(
      calculateBookmarkRecordingProgressPercent({
        durationSeconds: null,
        offsetSeconds: 30,
      }),
    ).toBeNull();
  });
});
