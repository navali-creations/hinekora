import type { EditorProject, EditorTimelineTrack } from "~/main/modules/editor";

import { calculateTimelineProjectDuration } from "~/types";
import { roundToMilliseconds } from "./EditorTime.utils";
import { resolveTimelineClipSourceRange } from "./EditorTimelineTrim.utils";

interface EditorTimelineGap {
  durationSeconds: number;
  endSeconds: number;
  id: string;
  startSeconds: number;
}

const timelineViewportDurationSeconds = 30;
const timelineMinimumDurationSeconds = 10;
const timelineTailPaddingRatio = 0.25;
const timelineMarkerTargetCountPerViewport = 7;
const timelineMarkerMaxCount = 240;
const timelineTerminalMarkerMinimumGapRatio = 0.25;
const timelineMarkerIntervalsSeconds = [
  0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600,
];

function calculateTimelineDuration(tracks: EditorTimelineTrack[]): number {
  return calculateTimelineProjectDuration(tracks);
}

function calculateExpandableTimelineDuration(input: {
  projectDurationSeconds: number;
}): number {
  const durationSeconds = Math.max(input.projectDurationSeconds, 0);
  if (durationSeconds <= 0) {
    return timelineViewportDurationSeconds;
  }

  const paddedDurationSeconds =
    durationSeconds * (1 + timelineTailPaddingRatio);

  return Math.max(
    roundToMilliseconds(paddedDurationSeconds),
    timelineMinimumDurationSeconds,
  );
}

function calculateEditorTimelineDuration(
  project: EditorProject | null,
): number {
  if (!project) {
    return 0;
  }

  const assetDurationByKey = new Map(
    project.assets.map((asset) => [
      asset.assetKey,
      Number.isFinite(asset.durationSeconds ?? Number.NaN)
        ? (asset.durationSeconds ?? 0)
        : 0,
    ]),
  );
  const expandableClipEndSeconds = project.tracks.flatMap((track) =>
    track.clips.map((clip) => {
      const assetDurationSeconds = assetDurationByKey.get(clip.assetKey) ?? 0;
      const sourceRange = resolveTimelineClipSourceRange({
        assetDurationSeconds,
        clip,
      });
      const expandableDurationSeconds = Math.max(
        clip.durationSeconds,
        sourceRange.sourceOutSeconds - clip.inSeconds,
      );

      return roundToMilliseconds(clip.startSeconds + expandableDurationSeconds);
    }),
  );

  return Math.max(project.durationSeconds, ...expandableClipEndSeconds, 0);
}

function calculateTimelineContentScale(input: {
  visibleDurationSeconds: number;
  zoom: number;
}): number {
  if (
    !Number.isFinite(input.zoom) ||
    input.zoom <= 0 ||
    !Number.isFinite(input.visibleDurationSeconds) ||
    input.visibleDurationSeconds <= 0
  ) {
    return 1;
  }

  const fittedDurationScale = Math.max(
    1,
    input.visibleDurationSeconds / timelineViewportDurationSeconds,
  );
  const zoomDelta = Math.max(0, input.zoom - 1);

  return Math.max(1, roundToMilliseconds(1 + zoomDelta * fittedDurationScale));
}

function clampEditorTimelineZoom(input: {
  maxZoom: number;
  minZoom: number;
  zoom: number;
}): number {
  return Math.min(Math.max(input.zoom, input.minZoom), input.maxZoom);
}

function resolveNextEditorTimelineZoom(input: {
  direction: -1 | 1;
  maxZoom: number;
  minZoom: number;
  step: number;
  zoom: number;
}): number {
  return clampEditorTimelineZoom({
    maxZoom: input.maxZoom,
    minZoom: input.minZoom,
    zoom: input.zoom + input.direction * input.step,
  });
}

function calculateTimelineMarkers(input: {
  contentScale: number;
  visibleDurationSeconds: number;
}): number[] {
  if (
    !Number.isFinite(input.visibleDurationSeconds) ||
    input.visibleDurationSeconds <= 0
  ) {
    return [0];
  }

  const markerIntervalSeconds = resolveTimelineMarkerInterval(
    resolveTimelineTargetMarkerInterval(input),
  );
  const markerCount =
    Math.floor(input.visibleDurationSeconds / markerIntervalSeconds) + 1;
  const markers = Array.from({ length: markerCount }, (_, index) =>
    roundToMilliseconds(index * markerIntervalSeconds),
  );
  const durationSeconds = roundToMilliseconds(input.visibleDurationSeconds);
  const lastMarker = markers.at(-1) ?? 0;
  const terminalMarkerGapSeconds = durationSeconds - lastMarker;
  const minimumTerminalMarkerGapSeconds =
    markerIntervalSeconds * timelineTerminalMarkerMinimumGapRatio;

  if (
    terminalMarkerGapSeconds > 0 &&
    terminalMarkerGapSeconds >= minimumTerminalMarkerGapSeconds
  ) {
    markers.push(durationSeconds);
  }

  return markers;
}

function calculateTimelineMinorMarkers(input: {
  contentScale: number;
  visibleDurationSeconds: number;
}): number[] {
  if (
    !Number.isFinite(input.visibleDurationSeconds) ||
    input.visibleDurationSeconds <= 0
  ) {
    return [];
  }

  const markerIntervalSeconds = resolveTimelineMarkerInterval(
    resolveTimelineTargetMarkerInterval(input),
  );
  const minorIntervalSeconds = markerIntervalSeconds / 5;
  const minorMarkerCount = Math.floor(
    input.visibleDurationSeconds / minorIntervalSeconds,
  );

  return Array.from({ length: minorMarkerCount }, (_, index) =>
    roundToMilliseconds((index + 1) * minorIntervalSeconds),
  ).filter(
    (marker) =>
      marker < input.visibleDurationSeconds &&
      !isTimelineMajorMarker(marker, markerIntervalSeconds),
  );
}

function calculateTimelineGaps(
  tracks: EditorTimelineTrack[],
  durationSeconds: number,
): EditorTimelineGap[] {
  const timelineEndSeconds = roundToMilliseconds(Math.max(0, durationSeconds));
  const intervals = tracks
    .flatMap((track) => track.clips)
    .filter((clip) => clip.durationSeconds > 0)
    .map((clip) => ({
      endSeconds: roundToMilliseconds(clip.startSeconds + clip.durationSeconds),
      startSeconds: roundToMilliseconds(clip.startSeconds),
    }))
    .sort(
      (first, second) =>
        first.startSeconds - second.startSeconds ||
        first.endSeconds - second.endSeconds,
    );
  const gaps: EditorTimelineGap[] = [];
  let cursorSeconds = 0;

  for (const interval of intervals) {
    if (interval.startSeconds > cursorSeconds) {
      gaps.push(createTimelineGap(cursorSeconds, interval.startSeconds));
    }

    cursorSeconds = Math.max(cursorSeconds, interval.endSeconds);
  }

  if (timelineEndSeconds > cursorSeconds) {
    gaps.push(createTimelineGap(cursorSeconds, timelineEndSeconds));
  }

  return gaps;
}

function calculateTimelinePercent(
  seconds: number,
  visibleDurationSeconds: number,
): number {
  if (!Number.isFinite(seconds) || visibleDurationSeconds <= 0) {
    return 0;
  }

  return Math.min(Math.max((seconds / visibleDurationSeconds) * 100, 0), 100);
}

function createTimelineGap(
  startSeconds: number,
  endSeconds: number,
): EditorTimelineGap {
  const start = roundToMilliseconds(startSeconds);
  const end = roundToMilliseconds(endSeconds);

  return {
    durationSeconds: roundToMilliseconds(end - start),
    endSeconds: end,
    id: `gap-${start}-${end}`,
    startSeconds: start,
  };
}

function resolveTimelineSecondsFromClientX(input: {
  clientX: number;
  timelineLeft: number;
  timelineWidth: number;
  visibleDurationSeconds: number;
}): number {
  if (input.timelineWidth <= 0 || input.visibleDurationSeconds <= 0) {
    return 0;
  }

  const ratio = Math.min(
    Math.max((input.clientX - input.timelineLeft) / input.timelineWidth, 0),
    1,
  );

  return roundToMilliseconds(ratio * input.visibleDurationSeconds);
}

function resolveTimelineMarkerInterval(targetIntervalSeconds: number): number {
  const interval = timelineMarkerIntervalsSeconds.find(
    (item) => item >= targetIntervalSeconds,
  );

  if (interval !== undefined) {
    return interval;
  }

  return Math.ceil(targetIntervalSeconds / 600) * 600;
}

function resolveTimelineTargetMarkerInterval(input: {
  contentScale: number;
  visibleDurationSeconds: number;
}): number {
  const contentScale =
    Number.isFinite(input.contentScale) && input.contentScale > 0
      ? input.contentScale
      : 1;
  const secondsPerViewport = input.visibleDurationSeconds / contentScale;
  const targetIntervalSeconds =
    secondsPerViewport / timelineMarkerTargetCountPerViewport;
  const cappedIntervalSeconds =
    input.visibleDurationSeconds / timelineMarkerMaxCount;

  return Math.max(targetIntervalSeconds, cappedIntervalSeconds);
}

function isTimelineMajorMarker(
  markerSeconds: number,
  markerIntervalSeconds: number,
): boolean {
  const remainder = markerSeconds % markerIntervalSeconds;

  return (
    Math.abs(remainder) <= 0.001 ||
    Math.abs(remainder - markerIntervalSeconds) <= 0.001
  );
}

export type { EditorTimelineGap };
export {
  calculateEditorTimelineDuration,
  calculateExpandableTimelineDuration,
  calculateTimelineContentScale,
  calculateTimelineDuration,
  calculateTimelineGaps,
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  clampEditorTimelineZoom,
  resolveNextEditorTimelineZoom,
  resolveTimelineSecondsFromClientX,
};
