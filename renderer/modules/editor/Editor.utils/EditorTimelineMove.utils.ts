import type { EditorTimelineClip } from "~/main/modules/editor";

import { roundToMilliseconds } from "./EditorTime.utils";

interface TimelineClipSnap {
  snapSeconds: number | null;
  startSeconds: number;
}

function moveTimelineClipWithinTrack(input: {
  clipId: string;
  clips: EditorTimelineClip[];
  cursorSeconds?: number;
  timelineSeconds: number;
}): {
  clips: EditorTimelineClip[];
  didMove: boolean;
} {
  const sortedClips = sortTimelineClips(input.clips);
  const clipIndex = sortedClips.findIndex((clip) => clip.id === input.clipId);
  const clip = sortedClips[clipIndex];
  if (!clip) {
    return { clips: input.clips, didMove: false };
  }

  const desiredStartSeconds = roundToMilliseconds(
    Math.max(input.timelineSeconds, 0),
  );
  const targetIndex = resolveTimelineClipMoveTargetIndex({
    clip,
    clipIndex,
    clips: sortedClips,
    cursorSeconds:
      input.cursorSeconds ?? desiredStartSeconds + clip.durationSeconds / 2,
  });

  if (targetIndex === clipIndex) {
    return moveTimelineClipWithinCurrentSlot({
      clip,
      clipIndex,
      clips: sortedClips,
      desiredStartSeconds,
    });
  }

  return reorderTimelineClipSegment({
    clip,
    clipIndex,
    clips: sortedClips,
    targetIndex,
  });
}

function resolveTimelineClipSnap(input: {
  clipId: string;
  clips: EditorTimelineClip[];
  durationSeconds: number;
  startSeconds: number;
  thresholdSeconds: number;
}): TimelineClipSnap {
  const candidates: TimelineClipSnap[] = [
    {
      snapSeconds: 0,
      startSeconds: 0,
    },
  ];

  for (const clip of input.clips) {
    if (clip.id === input.clipId) {
      continue;
    }

    candidates.push({
      snapSeconds: roundToMilliseconds(clip.startSeconds),
      startSeconds: roundToMilliseconds(
        clip.startSeconds - input.durationSeconds,
      ),
    });
    candidates.push({
      snapSeconds: roundToMilliseconds(
        clip.startSeconds + clip.durationSeconds,
      ),
      startSeconds: roundToMilliseconds(
        clip.startSeconds + clip.durationSeconds,
      ),
    });
  }

  const bestCandidate = candidates
    .filter((candidate) => candidate.startSeconds >= 0)
    .map((candidate) => ({
      ...candidate,
      distanceSeconds: Math.abs(candidate.startSeconds - input.startSeconds),
    }))
    .sort(
      (first, second) =>
        first.distanceSeconds - second.distanceSeconds ||
        first.startSeconds - second.startSeconds,
    )[0];

  if (
    !bestCandidate ||
    bestCandidate.distanceSeconds > input.thresholdSeconds
  ) {
    return {
      snapSeconds: null,
      startSeconds: input.startSeconds,
    };
  }

  return {
    snapSeconds: bestCandidate.snapSeconds,
    startSeconds: bestCandidate.startSeconds,
  };
}

function sortTimelineClips(clips: EditorTimelineClip[]): EditorTimelineClip[] {
  return [...clips].sort(
    (first, second) =>
      first.startSeconds - second.startSeconds ||
      first.id.localeCompare(second.id),
  );
}

function resolveTimelineClipMoveTargetIndex(input: {
  clip: EditorTimelineClip;
  clipIndex: number;
  clips: EditorTimelineClip[];
  cursorSeconds: number;
}): number {
  const otherClips = input.clips.filter((clip) => clip.id !== input.clip.id);
  const targetIndex = otherClips.findIndex(
    (clip) =>
      input.cursorSeconds < clip.startSeconds + clip.durationSeconds / 2,
  );

  return targetIndex === -1 ? otherClips.length : targetIndex;
}

function moveTimelineClipWithinCurrentSlot(input: {
  clip: EditorTimelineClip;
  clipIndex: number;
  clips: EditorTimelineClip[];
  desiredStartSeconds: number;
}): {
  clips: EditorTimelineClip[];
  didMove: boolean;
} {
  const previousClip = input.clips[input.clipIndex - 1];
  const nextClip = input.clips[input.clipIndex + 1];
  const minStartSeconds = previousClip
    ? previousClip.startSeconds + previousClip.durationSeconds
    : 0;
  const maxStartSeconds = nextClip
    ? Math.max(
        minStartSeconds,
        nextClip.startSeconds - input.clip.durationSeconds,
      )
    : Number.POSITIVE_INFINITY;
  const startSeconds = roundToMilliseconds(
    Math.min(
      Math.max(input.desiredStartSeconds, minStartSeconds),
      maxStartSeconds,
    ),
  );

  if (startSeconds === input.clip.startSeconds) {
    return { clips: input.clips, didMove: false };
  }

  return {
    clips: input.clips.map((clip) =>
      clip.id === input.clip.id ? { ...clip, startSeconds } : clip,
    ),
    didMove: true,
  };
}

function reorderTimelineClipSegment(input: {
  clip: EditorTimelineClip;
  clipIndex: number;
  clips: EditorTimelineClip[];
  targetIndex: number;
}): {
  clips: EditorTimelineClip[];
  didMove: boolean;
} {
  const withoutMovingClip = input.clips.filter(
    (clip) => clip.id !== input.clip.id,
  );
  const nextOrder = [...withoutMovingClip];
  nextOrder.splice(input.targetIndex, 0, input.clip);
  const segmentStartIndex = Math.min(input.clipIndex, input.targetIndex);
  const segmentEndIndex = Math.max(input.clipIndex, input.targetIndex);
  const segmentClipIds = new Set(
    nextOrder
      .slice(segmentStartIndex, segmentEndIndex + 1)
      .map((clip) => clip.id),
  );
  const segmentStartSeconds = input.clips
    .slice(segmentStartIndex, segmentEndIndex + 1)
    .reduce(
      (startSeconds, clip) => Math.min(startSeconds, clip.startSeconds),
      Number.POSITIVE_INFINITY,
    );
  let nextStartSeconds = Number.isFinite(segmentStartSeconds)
    ? segmentStartSeconds
    : 0;

  return {
    clips: nextOrder.map((clip) => {
      if (!segmentClipIds.has(clip.id)) {
        return clip;
      }

      const movedClip = {
        ...clip,
        startSeconds: roundToMilliseconds(nextStartSeconds),
      };
      nextStartSeconds = roundToMilliseconds(
        nextStartSeconds + clip.durationSeconds,
      );

      return movedClip;
    }),
    didMove: true,
  };
}

export type { TimelineClipSnap };
export { moveTimelineClipWithinTrack, resolveTimelineClipSnap };
