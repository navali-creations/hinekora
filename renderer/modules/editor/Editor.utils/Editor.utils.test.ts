import { describe, expect, it } from "vitest";

import type {
  EditorMediaAsset,
  EditorTimelineTrack,
} from "~/main/modules/editor";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../Editor.slice/Editor.slice.test-utils";
import {
  calculateEditorTimelineDuration,
  calculateExpandableTimelineDuration,
  calculateFittedTimelineDuration,
  calculateTimelineContentScale,
  calculateTimelineDuration,
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  clampEditorTimelineZoom,
  clampTrimRange,
  createTimelineClipFromAsset,
  formatEditorTime,
  formatEditorTimestamp,
  minimumTimelineClipDurationSeconds,
  moveTimelineClipWithinTrack,
  normalizeEditorDuration,
  resolveNextEditorTimelineZoom,
  resolveTimelineClipSnap,
  resolveTimelineSecondsFromClientX,
  trimTimelineClipEdge,
} from "./Editor.utils";

const asset: EditorMediaAsset = {
  assetKey: "clip:clip-1",
  category: "death-clip",
  createdAt: "2026-06-12T10:00:00.000Z",
  durationSeconds: 12,
  exists: true,
  id: "clip-1",
  kind: "clip",
  mediaUrl: "hinekora-media://replay-clip/clip-1",
  name: "clip.mp4",
  sizeBytes: 1024,
  sourceGame: "poe1",
  sourceLeague: "Standard",
  status: "ready",
  subtitle: "Death clip - Standard",
};

describe("Editor utils", () => {
  it("formats and normalizes timeline durations", () => {
    expect(formatEditorTime(null)).toBe("0:00");
    expect(formatEditorTime(65)).toBe("1:05");
    expect(formatEditorTimestamp(9.63)).toBe("0:09.63");
    expect(normalizeEditorDuration(null)).toBe(10);
    expect(normalizeEditorDuration(2.4)).toBe(2.4);
    expect(calculateTimelinePercent(5, 20)).toBe(25);
    expect(calculateTimelinePercent(40, 20)).toBe(100);
    expect(
      resolveTimelineSecondsFromClientX({
        clientX: 150,
        timelineLeft: 100,
        timelineWidth: 200,
        visibleDurationSeconds: 20,
      }),
    ).toBe(5);
  });

  it("creates timeline clips and calculates project duration", () => {
    const clip = createTimelineClipFromAsset({
      asset,
      id: "timeline-1",
      startSeconds: 8,
      trackId: "video-track",
    });
    const tracks: EditorTimelineTrack[] = [
      { clips: [clip], id: "video-track", kind: "video", label: "Video" },
    ];

    expect(clip).toMatchObject({
      assetKey: "clip:clip-1",
      durationSeconds: 12,
      outSeconds: 12,
      sourceInSeconds: 0,
      sourceOutSeconds: 12,
      startSeconds: 8,
    });
    expect(calculateTimelineDuration(tracks)).toBe(20);
  });

  it("moves clips inside gaps and reorders them after crossing a neighbor", () => {
    const firstClip = createTimelineClipFromAsset({
      asset: { ...asset, assetKey: "clip:first", durationSeconds: 4 },
      id: "timeline-first",
      startSeconds: 0,
      trackId: "video-track",
    });
    const secondClip = createTimelineClipFromAsset({
      asset: { ...asset, assetKey: "clip:second", durationSeconds: 3 },
      id: "timeline-second",
      startSeconds: 6,
      trackId: "video-track",
    });

    const movedInsideGap = moveTimelineClipWithinTrack({
      clipId: firstClip.id,
      clips: [firstClip, secondClip],
      timelineSeconds: 2,
    });

    expect(movedInsideGap).toMatchObject({
      didMove: true,
      clips: [
        { id: "timeline-first", startSeconds: 2 },
        { id: "timeline-second", startSeconds: 6 },
      ],
    });

    const movedAfterNeighbor = moveTimelineClipWithinTrack({
      clipId: firstClip.id,
      clips: [firstClip, secondClip],
      timelineSeconds: 6,
    });

    expect(movedAfterNeighbor).toMatchObject({
      didMove: true,
      clips: [
        { id: "timeline-second", startSeconds: 0 },
        { id: "timeline-first", startSeconds: 3 },
      ],
    });

    const movedBeforeNeighbor = moveTimelineClipWithinTrack({
      clipId: secondClip.id,
      clips: [firstClip, secondClip],
      cursorSeconds: 0,
      timelineSeconds: 0,
    });

    expect(movedBeforeNeighbor).toMatchObject({
      didMove: true,
      clips: [
        { id: "timeline-second", startSeconds: 0 },
        { id: "timeline-first", startSeconds: 3 },
      ],
    });

    const contiguousFirstClip = createTimelineClipFromAsset({
      asset: {
        ...asset,
        assetKey: "clip:contiguous-first",
        durationSeconds: 5,
      },
      id: "timeline-contiguous-first",
      startSeconds: 0,
      trackId: "video-track",
    });
    const contiguousSecondClip = createTimelineClipFromAsset({
      asset: {
        ...asset,
        assetKey: "clip:contiguous-second",
        durationSeconds: 5,
      },
      id: "timeline-contiguous-second",
      startSeconds: 5,
      trackId: "video-track",
    });
    const movedAfterNeighborByCursor = moveTimelineClipWithinTrack({
      clipId: contiguousFirstClip.id,
      clips: [contiguousFirstClip, contiguousSecondClip],
      cursorSeconds: 7.6,
      timelineSeconds: 3.1,
    });

    expect(movedAfterNeighborByCursor).toMatchObject({
      didMove: true,
      clips: [
        { id: "timeline-contiguous-second", startSeconds: 0 },
        { id: "timeline-contiguous-first", startSeconds: 5 },
      ],
    });
  });

  it("snaps moving clips to neighboring clip edges", () => {
    const firstClip = createTimelineClipFromAsset({
      asset: { ...asset, assetKey: "clip:first", durationSeconds: 4 },
      id: "timeline-first",
      startSeconds: 0,
      trackId: "video-track",
    });
    const secondClip = createTimelineClipFromAsset({
      asset: { ...asset, assetKey: "clip:second", durationSeconds: 3 },
      id: "timeline-second",
      startSeconds: 6,
      trackId: "video-track",
    });

    expect(
      resolveTimelineClipSnap({
        clipId: firstClip.id,
        clips: [firstClip, secondClip],
        durationSeconds: firstClip.durationSeconds,
        startSeconds: 2.05,
        thresholdSeconds: 0.1,
      }),
    ).toEqual({
      snapSeconds: 6,
      startSeconds: 2,
    });
    expect(
      resolveTimelineClipSnap({
        clipId: firstClip.id,
        clips: [firstClip, secondClip],
        durationSeconds: firstClip.durationSeconds,
        startSeconds: 3,
        thresholdSeconds: 0.1,
      }),
    ).toEqual({
      snapSeconds: null,
      startSeconds: 3,
    });
  });

  it("clamps trim ranges against source media duration", () => {
    expect(
      clampTrimRange({
        asset,
        inSeconds: -5,
        outSeconds: 40,
      }),
    ).toEqual({
      durationSeconds: 12,
      inSeconds: 0,
      outSeconds: 12,
    });
    expect(
      clampTrimRange({
        asset,
        inSeconds: 11,
        outSeconds: 8,
      }),
    ).toEqual({
      durationSeconds: minimumTimelineClipDurationSeconds,
      inSeconds: 11,
      outSeconds: 11.1,
    });
  });

  it("trims timeline clip edges while preserving source bounds", () => {
    const clip = createTimelineClipFromAsset({
      asset,
      id: "timeline-1",
      startSeconds: 8,
      trackId: "video-track",
    });

    expect(
      trimTimelineClipEdge({
        assetDurationSeconds: 12,
        clip,
        edge: "start",
        maxEndSeconds: Number.POSITIVE_INFINITY,
        minStartSeconds: 0,
        timelineSeconds: 11,
      }),
    ).toMatchObject({
      durationSeconds: 9,
      inSeconds: 3,
      outSeconds: 12,
      sourceInSeconds: 0,
      sourceOutSeconds: 12,
      startSeconds: 11,
    });
    expect(
      trimTimelineClipEdge({
        assetDurationSeconds: 12,
        clip: {
          ...clip,
          durationSeconds: 9,
          inSeconds: 3,
          startSeconds: 11,
        },
        edge: "end",
        maxEndSeconds: Number.POSITIVE_INFINITY,
        minStartSeconds: 0,
        timelineSeconds: 16,
      }),
    ).toMatchObject({
      durationSeconds: 5,
      inSeconds: 3,
      outSeconds: 8,
      sourceInSeconds: 0,
      sourceOutSeconds: 12,
      startSeconds: 11,
    });
  });

  it("can expand a shortened clip back through its retained source copy", () => {
    const clip = createTimelineClipFromAsset({
      asset,
      id: "timeline-1",
      startSeconds: 6,
      trackId: "video-track",
    });
    const shortenedClip = {
      ...clip,
      durationSeconds: 4,
      outSeconds: 4,
    };

    expect(
      trimTimelineClipEdge({
        assetDurationSeconds: 12,
        clip: shortenedClip,
        edge: "end",
        maxEndSeconds: Number.POSITIVE_INFINITY,
        minStartSeconds: 0,
        timelineSeconds: 18,
      }),
    ).toMatchObject({
      durationSeconds: 12,
      inSeconds: 0,
      outSeconds: 12,
      sourceInSeconds: 0,
      sourceOutSeconds: 12,
      startSeconds: 6,
    });

    expect(
      trimTimelineClipEdge({
        assetDurationSeconds: 12,
        clip: {
          ...shortenedClip,
          sourceOutSeconds: shortenedClip.outSeconds,
        },
        edge: "end",
        maxEndSeconds: Number.POSITIVE_INFINITY,
        minStartSeconds: 0,
        timelineSeconds: 18,
      }),
    ).toMatchObject({
      durationSeconds: 12,
      inSeconds: 0,
      outSeconds: 12,
      sourceInSeconds: 0,
      sourceOutSeconds: 12,
      startSeconds: 6,
    });
  });

  it("keeps trimmed clips above the minimum editable duration", () => {
    const clip = createTimelineClipFromAsset({
      asset,
      id: "timeline-1",
      startSeconds: 0,
      trackId: "video-track",
    });

    expect(
      trimTimelineClipEdge({
        assetDurationSeconds: 12,
        clip,
        edge: "end",
        maxEndSeconds: Number.POSITIVE_INFINITY,
        minStartSeconds: 0,
        timelineSeconds: 0.001,
      }),
    ).toMatchObject({
      durationSeconds: minimumTimelineClipDurationSeconds,
      inSeconds: 0,
      outSeconds: minimumTimelineClipDurationSeconds,
      startSeconds: 0,
    });
  });

  it("resolves fitted timeline duration and content scale from zoom", () => {
    const sourceAsset = createEditorTestAsset({ durationSeconds: 54.95 });
    const trimmedProject = createEditorTestProject(sourceAsset, {
      durationSeconds: 30,
      tracks: [
        {
          clips: [
            createEditorTestTimelineClip(sourceAsset, {
              durationSeconds: 30,
              outSeconds: 30,
              sourceOutSeconds: 54.95,
            }),
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });

    expect(calculateEditorTimelineDuration(trimmedProject)).toBe(30);
    expect(
      calculateExpandableTimelineDuration({
        projectDurationSeconds: 26,
      }),
    ).toBe(32.5);
    expect(
      calculateExpandableTimelineDuration({
        projectDurationSeconds: 10,
      }),
    ).toBe(12.5);
    expect(
      calculateExpandableTimelineDuration({
        projectDurationSeconds: 5,
      }),
    ).toBe(10);
    expect(
      calculateExpandableTimelineDuration({
        projectDurationSeconds: 0,
      }),
    ).toBe(30);
    expect(
      calculateFittedTimelineDuration({
        projectDurationSeconds: 26,
      }),
    ).toBe(26);
    expect(
      calculateFittedTimelineDuration({
        projectDurationSeconds: 5,
      }),
    ).toBe(5);
    expect(
      calculateTimelineContentScale({
        visibleDurationSeconds: 60,
        zoom: 0.5,
      }),
    ).toBe(1);
    expect(
      calculateTimelineContentScale({
        visibleDurationSeconds: 97.5,
        zoom: 1,
      }),
    ).toBe(1);
    expect(
      calculateTimelineContentScale({
        visibleDurationSeconds: 26,
        zoom: 4,
      }),
    ).toBe(4);
    expect(
      calculateTimelineContentScale({
        visibleDurationSeconds: 97.5,
        zoom: 1.25,
      }),
    ).toBe(1.813);
    expect(
      calculateTimelineContentScale({
        visibleDurationSeconds: Number.NaN,
        zoom: Number.NaN,
      }),
    ).toBe(1);
  });

  it("clamps and steps timeline zoom consistently", () => {
    expect(
      clampEditorTimelineZoom({
        maxZoom: 4,
        minZoom: 1,
        zoom: 0.5,
      }),
    ).toBe(1);
    expect(
      clampEditorTimelineZoom({
        maxZoom: 4,
        minZoom: 1,
        zoom: 8,
      }),
    ).toBe(4);
    expect(
      resolveNextEditorTimelineZoom({
        direction: -1,
        maxZoom: 4,
        minZoom: 1,
        step: 0.25,
        zoom: 1,
      }),
    ).toBe(1);
    expect(
      resolveNextEditorTimelineZoom({
        direction: 1,
        maxZoom: 4,
        minZoom: 1,
        step: 0.25,
        zoom: 1,
      }),
    ).toBe(1.25);
  });

  it("densifies timeline markers as the content stretches", () => {
    expect(
      calculateTimelineMarkers({
        contentScale: 1,
        visibleDurationSeconds: 30,
      }),
    ).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(
      calculateTimelineMarkers({
        contentScale: 4,
        visibleDurationSeconds: 30,
      }),
    ).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]);
    expect(
      calculateTimelineMarkers({
        contentScale: 1,
        visibleDurationSeconds: 3_600,
      }).length,
    ).toBeLessThanOrEqual(241);
    expect(
      calculateTimelineMinorMarkers({
        contentScale: 1,
        visibleDurationSeconds: 30,
      }),
    ).toEqual([
      1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24,
      26, 27, 28, 29,
    ]);
  });

  it("skips cramped terminal timeline labels while keeping useful end labels", () => {
    expect(
      calculateTimelineMarkers({
        contentScale: 1,
        visibleDurationSeconds: 122.03,
      }),
    ).toEqual([0, 30, 60, 90, 120]);
    expect(
      calculateTimelineMarkers({
        contentScale: 1,
        visibleDurationSeconds: 97.5,
      }),
    ).toEqual([0, 15, 30, 45, 60, 75, 90, 97.5]);
  });
});
