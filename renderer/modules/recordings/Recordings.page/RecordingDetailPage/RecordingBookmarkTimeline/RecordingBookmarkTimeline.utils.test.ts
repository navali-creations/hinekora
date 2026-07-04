import { describe, expect, it } from "vitest";

import { resolveRecordingClipTargetRulerSegment } from "./RecordingBookmarkTimeline.utils";

describe("RecordingBookmarkTimeline utils", () => {
  it("splits early replay clips into event and processing tail spans", () => {
    expect(
      resolveRecordingClipTargetRulerSegment({
        durationSeconds: 34.5,
        offsetSeconds: 30,
        targetDurationSeconds: 50,
      }),
    ).toEqual({
      endSeconds: 34.5,
      eventDurationSeconds: 30,
      startSeconds: 0,
      tailDurationSeconds: 4.5,
      triggerSeconds: 30,
    });
  });

  it("falls back to requested duration before finalized media duration is known", () => {
    expect(
      resolveRecordingClipTargetRulerSegment({
        durationSeconds: null,
        offsetSeconds: 30,
        targetDurationSeconds: 50,
      }),
    ).toEqual({
      endSeconds: 50,
      eventDurationSeconds: 30,
      startSeconds: 0,
      tailDurationSeconds: 20,
      triggerSeconds: 30,
    });
  });

  it("keeps full-buffer replay clips as event spans without processing tail", () => {
    expect(
      resolveRecordingClipTargetRulerSegment({
        durationSeconds: 50,
        offsetSeconds: 90,
        targetDurationSeconds: 50,
      }),
    ).toEqual({
      endSeconds: 90,
      eventDurationSeconds: 50,
      startSeconds: 40,
      tailDurationSeconds: 0,
      triggerSeconds: 90,
    });
  });
});
