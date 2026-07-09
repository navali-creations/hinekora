import { quickClipTrimMinimumSeconds } from "~/types";

export function createClipPreviewMediaUrl(clipId: string): string {
  return `hinekora-media://replay-clip/${encodeURIComponent(clipId)}`;
}

export interface ClipPreviewTrimRange {
  inSeconds: number;
  outSeconds: number;
}

export function resolveClipPreviewRouteClipId(hash: string): string | null {
  const [, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  const clipId = params.get("clipId");

  return clipId && clipId.length > 0 ? clipId : null;
}

export function calculateClipPreviewTimelinePercent(
  seconds: number,
  durationSeconds: number,
): number {
  if (!Number.isFinite(seconds) || durationSeconds <= 0) {
    return 0;
  }

  return Math.min(Math.max((seconds / durationSeconds) * 100, 0), 100);
}

export function clampClipPreviewTrimRange(input: {
  durationSeconds: number;
  inSeconds: number;
  outSeconds: number;
}): ClipPreviewTrimRange {
  const durationSeconds = Math.max(
    quickClipTrimMinimumSeconds,
    roundClipPreviewSeconds(input.durationSeconds),
  );
  const inSeconds = clampClipPreviewSeconds(
    input.inSeconds,
    0,
    durationSeconds - quickClipTrimMinimumSeconds,
  );
  const outSeconds = clampClipPreviewSeconds(
    input.outSeconds,
    inSeconds + quickClipTrimMinimumSeconds,
    durationSeconds,
  );

  return { inSeconds, outSeconds };
}

export function moveClipPreviewTrimRange(input: {
  durationSeconds: number;
  inSeconds: number;
  trimDurationSeconds: number;
}): ClipPreviewTrimRange {
  const durationSeconds = Math.max(
    quickClipTrimMinimumSeconds,
    roundClipPreviewSeconds(input.durationSeconds),
  );
  const trimDurationSeconds = clampClipPreviewSeconds(
    input.trimDurationSeconds,
    quickClipTrimMinimumSeconds,
    durationSeconds,
  );
  const inSeconds = clampClipPreviewSeconds(
    input.inSeconds,
    0,
    durationSeconds - trimDurationSeconds,
  );

  return {
    inSeconds,
    outSeconds: roundClipPreviewSeconds(inSeconds + trimDurationSeconds),
  };
}

export function formatClipPreviewTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "00.00";
  }

  const centiseconds = Math.round(seconds * 100);
  const wholeSeconds = Math.floor(centiseconds / 100);
  const fraction = centiseconds % 100;

  return `${wholeSeconds.toString().padStart(2, "0")}.${fraction
    .toString()
    .padStart(2, "0")}`;
}

export function clampClipPreviewPlaybackSeconds(
  seconds: number,
  durationSeconds: number,
): number {
  return clampClipPreviewSeconds(seconds, 0, Math.max(durationSeconds, 0));
}

export function getClipPreviewFileTitle(path: string | null): string {
  if (!path) {
    return "";
  }

  const fileName = path.split(/[\\/]/).pop() ?? path;
  return fileName.replace(/\.[^.]+$/, "");
}

export function resolveClipPreviewTimelineSeconds(input: {
  clientX: number;
  durationSeconds: number;
  rail: HTMLElement | null;
}): number | null {
  if (!input.rail || input.durationSeconds <= 0) {
    return null;
  }

  const bounds = input.rail.getBoundingClientRect();
  if (bounds.width <= 0) {
    return null;
  }

  return clampClipPreviewSeconds(
    ((input.clientX - bounds.left) / bounds.width) * input.durationSeconds,
    0,
    input.durationSeconds,
  );
}

export function roundClipPreviewSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return Math.round(Math.max(seconds, 0) * 1_000) / 1_000;
}

function clampClipPreviewSeconds(
  seconds: number,
  min: number,
  max: number,
): number {
  if (max < min) {
    return roundClipPreviewSeconds(min);
  }

  if (!Number.isFinite(seconds)) {
    return roundClipPreviewSeconds(min);
  }

  return roundClipPreviewSeconds(Math.min(Math.max(seconds, min), max));
}
