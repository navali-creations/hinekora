import type { EditorTimelineTrack } from "~/main/modules/editor";

import { roundToMilliseconds } from "./EditorTime.utils";

interface EditorTimelineGap {
  durationSeconds: number;
  endSeconds: number;
  id: string;
  startSeconds: number;
}

const timelineViewportDurationSeconds = 30;
const timelineMarkerTargetCountPerViewport = 5;
const timelineMarkerMaxCount = 240;
const timelineMarkerIntervalsSeconds = [
  0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600,
];

function calculateTimelineDuration(tracks: EditorTimelineTrack[]): number {
  return tracks.reduce(
    (duration, track) =>
      Math.max(
        duration,
        ...track.clips.map((clip) => clip.startSeconds + clip.durationSeconds),
      ),
    0,
  );
}

function calculateExpandableTimelineDuration(input: {
  projectDurationSeconds: number;
  zoom: number;
}): number {
  const zoom = Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  const durationSeconds = Math.max(input.projectDurationSeconds, 0);
  const viewportDurationSeconds = timelineViewportDurationSeconds / zoom;

  return Math.max(
    roundToMilliseconds(durationSeconds),
    roundToMilliseconds(viewportDurationSeconds),
    10,
  );
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

  return Math.max(
    1,
    roundToMilliseconds(
      (input.visibleDurationSeconds * input.zoom) /
        timelineViewportDurationSeconds,
    ),
  );
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

  if (markers.at(-1) !== durationSeconds) {
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
  calculateExpandableTimelineDuration,
  calculateTimelineContentScale,
  calculateTimelineDuration,
  calculateTimelineGaps,
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  resolveTimelineSecondsFromClientX,
};
