import { describe, expect, it } from "vitest";

import {
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  clampTimelineSeconds,
  formatTimelineRailLeft,
  formatTimelineRailWidth,
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

  it("clamps seconds and percentages", () => {
    expect(calculateTimelinePercent(null, 100)).toBe(0);
    expect(calculateTimelinePercent(25, 100)).toBe(25);
    expect(calculateTimelinePercent(125, 100)).toBe(100);
    expect(clampTimelineSeconds(Number.NaN, 100)).toBe(0);
    expect(clampTimelineSeconds(-1, 100)).toBe(0);
    expect(clampTimelineSeconds(101, 100)).toBe(100);
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
