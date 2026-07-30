import { describe, expect, it } from "vitest";

import {
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  clampTimelineSeconds,
  formatMediaTime,
  formatTimelineRailLeft,
  formatTimelineRailWidth,
  resolveMediaClipTargetSegment,
  resolveTimelineSecondsFromClientX,
} from "./MediaTimeline.utils";

describe("MediaTimeline utils", () => {
  it("calculates major and minor timeline markers", () => {
    expect(calculateTimelineMarkers(0)).toEqual([0]);
    expect(calculateTimelineMarkers(30)).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(calculateTimelineMinorMarkers(10)).toEqual([
      0.4, 0.8, 1.2, 1.6, 2.4, 2.8, 3.2, 3.6, 4.4, 4.8, 5.2, 5.6, 6.4, 6.8, 7.2,
      7.6, 8.4, 8.8, 9.2, 9.6,
    ]);
  });

  it("formats padded rail percentages", () => {
    expect(formatTimelineRailLeft(25, 24)).toBe(
      "calc(24px + (100% - 48px) * 0.25)",
    );
    expect(formatTimelineRailWidth(40, 24)).toBe("calc((100% - 48px) * 0.4)");
  });

  it("formats media times with consistent hour and centisecond segments", () => {
    expect(formatMediaTime(12_403.24)).toBe("3:26:43");
    expect(formatMediaTime(12_403.24, true)).toBe("3:26:43.24");
    expect(formatMediaTime(null)).toBe("0:00");
  });

  it("clamps seconds and percentages", () => {
    expect(calculateTimelinePercent(null, 100)).toBe(0);
    expect(calculateTimelinePercent(25, 100)).toBe(25);
    expect(calculateTimelinePercent(125, 100)).toBe(100);
    expect(clampTimelineSeconds(Number.NaN, 100)).toBe(0);
    expect(clampTimelineSeconds(-1, 100)).toBe(0);
    expect(clampTimelineSeconds(101, 100)).toBe(100);
  });

  it("resolves clip target pre-roll and post-event tail segments", () => {
    expect(
      resolveMediaClipTargetSegment({
        durationSeconds: 4,
        offsetSeconds: 2,
        targetDurationSeconds: 50,
      }),
    ).toEqual({
      endSeconds: 4,
      eventDurationSeconds: 2,
      startSeconds: 0,
      tailDurationSeconds: 2,
      triggerSeconds: 2,
    });
    expect(
      resolveMediaClipTargetSegment({
        durationSeconds: null,
        offsetSeconds: 30,
        targetDurationSeconds: 50,
        unknownDurationMode: "trigger-only",
      }),
    ).toEqual({
      endSeconds: 30,
      eventDurationSeconds: 30,
      startSeconds: 0,
      tailDurationSeconds: 0,
      triggerSeconds: 30,
    });
    expect(
      resolveMediaClipTargetSegment({
        durationSeconds: null,
        offsetSeconds: 90,
        targetDurationSeconds: 50,
        unknownDurationMode: "trigger-only",
      }),
    ).toEqual({
      endSeconds: 90,
      eventDurationSeconds: 50,
      startSeconds: 40,
      tailDurationSeconds: 0,
      triggerSeconds: 90,
    });
    expect(
      resolveMediaClipTargetSegment({
        durationSeconds: null,
        offsetSeconds: 0,
        targetDurationSeconds: 50,
        unknownDurationMode: "trigger-only",
      }),
    ).toBeNull();
    expect(
      resolveMediaClipTargetSegment({
        durationSeconds: 0,
        offsetSeconds: 30,
        targetDurationSeconds: 50,
      }),
    ).toBeNull();
  });

  it("falls back to target duration while clip duration is unknown by default", () => {
    expect(
      resolveMediaClipTargetSegment({
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

  it("resolves timeline seconds from client coordinates", () => {
    const element = document.createElement("div");
    element.getBoundingClientRect = () =>
      ({
        bottom: 10,
        height: 10,
        left: 100,
        right: 300,
        top: 0,
        width: 200,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(
      resolveTimelineSecondsFromClientX({
        clientX: 150,
        durationSeconds: 100,
        railPaddingPixels: 25,
        timelineGrid: element,
      }),
    ).toBeCloseTo(16.666);
    expect(
      resolveTimelineSecondsFromClientX({
        clientX: 90,
        durationSeconds: 100,
        railPaddingPixels: 25,
        timelineGrid: element,
      }),
    ).toBeNull();
  });
});
