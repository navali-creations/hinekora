import { describe, expect, it } from "vitest";

import { ReplayClipDuplicateTracker } from "../ReplayClips.duplicates";

describe("ReplayClipDuplicateTracker", () => {
  it("tracks recent hashes and prunes stale entries", () => {
    const tracker = new ReplayClipDuplicateTracker();

    expect(tracker.isDuplicate("old-hash", 0)).toBe(false);
    expect(tracker.isDuplicate("fresh-hash", 31_000)).toBe(false);
    expect(tracker.isDuplicate("fresh-hash", 31_001)).toBe(true);
    expect(tracker.isDuplicate("old-hash", 31_002)).toBe(false);
  });
});
