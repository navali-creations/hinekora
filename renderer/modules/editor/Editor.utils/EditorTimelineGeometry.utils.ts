import type { EditorTimelineTrack } from "~/main/modules/editor";

import { roundToMilliseconds } from "./EditorTime.utils";

interface EditorTimelineGap {
  durationSeconds: number;
  endSeconds: number;
  id: string;
  startSeconds: number;
}

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
  const durationSeconds = Math.max(input.projectDurationSeconds, 10);
  const zoom = Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;

  return Math.max(roundToMilliseconds(durationSeconds / zoom), 10);
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

export type { EditorTimelineGap };
export {
  calculateExpandableTimelineDuration,
  calculateTimelineDuration,
  calculateTimelineGaps,
  calculateTimelinePercent,
  resolveTimelineSecondsFromClientX,
};
