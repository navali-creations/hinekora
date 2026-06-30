import type {
  EditorMediaAsset,
  EditorTimelineClip,
} from "~/main/modules/editor";

import {
  normalizeEditorDuration,
  roundToMilliseconds,
} from "./EditorTime.utils";

type TimelineTrimEdge = "end" | "start";

interface TimelineClipSourceRange {
  sourceInSeconds: number;
  sourceOutSeconds: number;
}

const minimumTimelineClipDurationSeconds = 0.1;

function clampTrimRange(input: {
  asset: EditorMediaAsset | null;
  inSeconds: number;
  outSeconds: number;
}): {
  durationSeconds: number;
  inSeconds: number;
  outSeconds: number;
} {
  const assetDuration = normalizeEditorDuration(
    input.asset?.durationSeconds ?? null,
  );
  const minimumDuration = resolveMinimumClipDuration(assetDuration);
  const inSeconds = clampSeconds(
    input.inSeconds,
    0,
    assetDuration - minimumDuration,
  );
  const outSeconds = clampSeconds(
    input.outSeconds,
    inSeconds + minimumDuration,
    assetDuration,
  );

  return {
    durationSeconds: roundToMilliseconds(outSeconds - inSeconds),
    inSeconds,
    outSeconds,
  };
}

function trimTimelineClipEdge(input: {
  assetDurationSeconds: number;
  clip: EditorTimelineClip;
  edge: TimelineTrimEdge;
  maxEndSeconds: number;
  minStartSeconds: number;
  timelineSeconds: number;
}): EditorTimelineClip {
  if (input.edge === "start") {
    return trimTimelineClipStart(input);
  }

  return trimTimelineClipEnd(input);
}

function createEditorTrimHistoryLabel(edge: TimelineTrimEdge): string {
  return edge === "start" ? "Trim start" : "Trim end";
}

function trimTimelineClipStart(input: {
  assetDurationSeconds: number;
  clip: EditorTimelineClip;
  minStartSeconds: number;
  timelineSeconds: number;
}): EditorTimelineClip {
  const sourceRange = resolveTimelineClipSourceRange({
    assetDurationSeconds: input.assetDurationSeconds,
    clip: input.clip,
  });
  const currentRange = resolveTimelineClipCurrentRange({
    clip: input.clip,
    sourceRange,
  });
  const clipEndSeconds = roundToMilliseconds(
    input.clip.startSeconds + input.clip.durationSeconds,
  );
  const earliestStartSeconds = Math.max(
    input.minStartSeconds,
    clipEndSeconds - (currentRange.outSeconds - sourceRange.sourceInSeconds),
  );
  const latestStartSeconds =
    clipEndSeconds - currentRange.minimumDurationSeconds;
  const startSeconds = clampSeconds(
    input.timelineSeconds,
    earliestStartSeconds,
    latestStartSeconds,
  );
  const durationSeconds = roundToMilliseconds(clipEndSeconds - startSeconds);

  return {
    ...input.clip,
    durationSeconds,
    inSeconds: roundToMilliseconds(currentRange.outSeconds - durationSeconds),
    outSeconds: currentRange.outSeconds,
    sourceInSeconds: sourceRange.sourceInSeconds,
    sourceOutSeconds: sourceRange.sourceOutSeconds,
    startSeconds,
  };
}

function trimTimelineClipEnd(input: {
  assetDurationSeconds: number;
  clip: EditorTimelineClip;
  maxEndSeconds: number;
  timelineSeconds: number;
}): EditorTimelineClip {
  const sourceRange = resolveTimelineClipSourceRange({
    assetDurationSeconds: input.assetDurationSeconds,
    clip: input.clip,
  });
  const currentRange = resolveTimelineClipCurrentRange({
    clip: input.clip,
    sourceRange,
  });
  const earliestEndSeconds = roundToMilliseconds(
    input.clip.startSeconds + currentRange.minimumDurationSeconds,
  );
  const latestEndSeconds = Math.min(
    input.maxEndSeconds,
    input.clip.startSeconds +
      sourceRange.sourceOutSeconds -
      currentRange.inSeconds,
  );
  const endSeconds = clampSeconds(
    input.timelineSeconds,
    earliestEndSeconds,
    latestEndSeconds,
  );
  const durationSeconds = roundToMilliseconds(
    endSeconds - input.clip.startSeconds,
  );

  return {
    ...input.clip,
    durationSeconds,
    inSeconds: currentRange.inSeconds,
    outSeconds: roundToMilliseconds(currentRange.inSeconds + durationSeconds),
    sourceInSeconds: sourceRange.sourceInSeconds,
    sourceOutSeconds: sourceRange.sourceOutSeconds,
  };
}

function resolveTimelineClipSourceRange(input: {
  assetDurationSeconds: number;
  clip: EditorTimelineClip;
}): TimelineClipSourceRange {
  const assetDurationSeconds = normalizeEditorDuration(
    Math.max(
      input.assetDurationSeconds,
      input.clip.sourceOutSeconds ?? 0,
      input.clip.outSeconds,
      input.clip.inSeconds + input.clip.durationSeconds,
    ),
  );
  const minimumDurationSeconds =
    resolveMinimumClipDuration(assetDurationSeconds);
  const sourceInSeconds = 0;
  const sourceOutSeconds = clampSeconds(
    assetDurationSeconds,
    sourceInSeconds + minimumDurationSeconds,
    assetDurationSeconds,
  );

  return {
    sourceInSeconds,
    sourceOutSeconds,
  };
}

function resolveTimelineClipCurrentRange(input: {
  clip: EditorTimelineClip;
  sourceRange: TimelineClipSourceRange;
}): {
  inSeconds: number;
  minimumDurationSeconds: number;
  outSeconds: number;
} {
  const sourceDurationSeconds = roundToMilliseconds(
    input.sourceRange.sourceOutSeconds - input.sourceRange.sourceInSeconds,
  );
  const minimumDurationSeconds = resolveMinimumClipDuration(
    sourceDurationSeconds,
  );
  const inSeconds = clampSeconds(
    input.clip.inSeconds,
    input.sourceRange.sourceInSeconds,
    input.sourceRange.sourceOutSeconds - minimumDurationSeconds,
  );
  const outSeconds = clampSeconds(
    input.clip.outSeconds,
    inSeconds + minimumDurationSeconds,
    input.sourceRange.sourceOutSeconds,
  );

  return {
    inSeconds,
    minimumDurationSeconds,
    outSeconds,
  };
}

function resolveMinimumClipDuration(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0.001;
  }

  return roundToMilliseconds(
    Math.min(minimumTimelineClipDurationSeconds, durationSeconds),
  );
}

function clampSeconds(value: number, min: number, max: number): number {
  if (max < min) {
    return roundToMilliseconds(min);
  }

  if (!Number.isFinite(value)) {
    return min;
  }

  return roundToMilliseconds(Math.min(Math.max(value, min), max));
}

export type { TimelineTrimEdge };
export {
  clampTrimRange,
  createEditorTrimHistoryLabel,
  minimumTimelineClipDurationSeconds,
  resolveTimelineClipSourceRange,
  trimTimelineClipEdge,
};
