import { describe, expect, it, vi } from "vitest";

import {
  formatEditorTimelineRailLeft,
  formatEditorTimelineRailWidth,
  resolveEditorTimelineFollowScroll,
  resolveEditorTimelineHoverSeconds,
  resolveEditorTimelineUseCompactTrimHandles,
  resolveEditorTimelineWheelZoom,
  resolveTrimEdgeHoverSeconds,
} from "./EditorTimeline.utils";

function createTrackWithClipDurations(durationsSeconds: number[]) {
  return {
    clips: durationsSeconds.map((durationSeconds) => ({
      durationSeconds,
    })),
  } as Parameters<
    typeof resolveEditorTimelineUseCompactTrimHandles
  >[0]["videoTracks"][number];
}

describe("EditorTimeline utils", () => {
  it("resolves trim edge hover seconds from clip metadata", () => {
    const trimStart = document.createElement("button");
    trimStart.dataset.clipDurationSeconds = "5";
    trimStart.dataset.clipStartSeconds = "2";
    trimStart.dataset.trimEdge = "start";
    const trimEnd = document.createElement("button");
    trimEnd.dataset.clipDurationSeconds = "5";
    trimEnd.dataset.clipStartSeconds = "2";
    trimEnd.dataset.trimEdge = "end";

    expect(resolveTrimEdgeHoverSeconds(trimStart)).toBe(2);
    expect(resolveTrimEdgeHoverSeconds(trimEnd)).toBe(7);
  });

  it("resolves marker-zone hover seconds from the timeline grid", () => {
    const timelineGrid = document.createElement("div");
    const markerZone = document.createElement("div");
    markerZone.dataset.timelineMarkerZone = "true";
    timelineGrid.append(markerZone);
    vi.spyOn(timelineGrid, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 1_100,
      toJSON: () => ({}),
      top: 0,
      width: 1_100,
      x: 0,
      y: 0,
    });

    expect(
      resolveEditorTimelineHoverSeconds({
        clientX: 550,
        railPaddingPixels: 100,
        target: markerZone,
        timelineGrid,
        visibleDurationSeconds: 10,
      }),
    ).toBe(5);
  });

  it("resolves ctrl wheel zoom steps inside timeline bounds", () => {
    expect(
      resolveEditorTimelineWheelZoom({
        deltaY: -100,
        isTimelineFitToEdit: false,
        zoom: 1,
      }),
    ).toBe(1.25);
    expect(
      resolveEditorTimelineWheelZoom({
        deltaY: 100,
        isTimelineFitToEdit: false,
        zoom: 1.25,
      }),
    ).toBe(1);
    expect(
      resolveEditorTimelineWheelZoom({
        deltaY: 100,
        isTimelineFitToEdit: false,
        zoom: 1,
      }),
    ).toBe(null);
    expect(
      resolveEditorTimelineWheelZoom({
        deltaY: 100,
        isTimelineFitToEdit: true,
        zoom: 1,
      }),
    ).toBe(1);
    expect(
      resolveEditorTimelineWheelZoom({
        deltaY: 0,
        isTimelineFitToEdit: false,
        zoom: 2,
      }),
    ).toBe(null);
  });

  it("formats rail positions with symmetric internal padding", () => {
    expect(formatEditorTimelineRailLeft(25, 24)).toBe(
      "calc(24px + (100% - 48px) * 0.25)",
    );
    expect(formatEditorTimelineRailWidth(40, 24)).toBe(
      "calc((100% - 48px) * 0.4)",
    );
  });

  it("formats rail positions as percentages without internal padding", () => {
    expect(formatEditorTimelineRailLeft(25, 0)).toBe("25%");
    expect(formatEditorTimelineRailWidth(40, 0)).toBe("40%");
  });

  it("uses compact trim handles once any clip cannot fit handles and a frame", () => {
    expect(
      resolveEditorTimelineUseCompactTrimHandles({
        railPaddingPixels: 24,
        timelineGridWidthPixels: 1_100,
        videoTracks: [createTrackWithClipDurations([20, 1])],
        visibleDurationSeconds: 100,
      }),
    ).toBe(true);
    expect(
      resolveEditorTimelineUseCompactTrimHandles({
        railPaddingPixels: 24,
        timelineGridWidthPixels: 1_100,
        videoTracks: [createTrackWithClipDurations([20, 10])],
        visibleDurationSeconds: 100,
      }),
    ).toBe(false);
    expect(
      resolveEditorTimelineUseCompactTrimHandles({
        railPaddingPixels: 24,
        timelineGridWidthPixels: 0,
        videoTracks: [createTrackWithClipDurations([1])],
        visibleDurationSeconds: 100,
      }),
    ).toBe(true);
  });

  it("resolves playback follow scrolling with viewport padding", () => {
    const baseInput = {
      paddingPixels: 96,
      scrollClientWidth: 500,
      scrollWidth: 1_000,
      railPaddingPixels: 132,
      timelineGridWidth: 1_000,
      visibleDurationSeconds: 100,
    };

    expect(
      resolveEditorTimelineFollowScroll({
        ...baseInput,
        playbackSeconds: 55,
        scrollLeft: 0,
      }),
    ).toBe(133);
    expect(
      resolveEditorTimelineFollowScroll({
        ...baseInput,
        playbackSeconds: 20,
        scrollLeft: 500,
      }),
    ).toBe(51);
    expect(
      resolveEditorTimelineFollowScroll({
        ...baseInput,
        playbackSeconds: 45,
        scrollLeft: 200,
      }),
    ).toBe(null);
  });
});
