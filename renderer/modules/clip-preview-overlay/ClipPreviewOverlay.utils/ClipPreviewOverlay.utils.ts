import type {
  ReplayClipDetail,
  ReplayClipView,
} from "~/main/modules/replay-clips";

import { type QuickClipTrimRange, quickClipTrimMinimumSeconds } from "~/types";

export type ClipPreviewTrimRange = QuickClipTrimRange;

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

export function resolveClipPreviewDetail(
  detail: ReplayClipDetail | null,
  durationOverrideSeconds: number | null,
) {
  const clip = detail?.clip ?? null;
  const durationSeconds = Math.max(
    0,
    detail?.durationSeconds ??
      durationOverrideSeconds ??
      clip?.durationSeconds ??
      clip?.targetDurationSeconds ??
      0,
  );
  const mediaUrl = detail?.mediaUrl ?? null;

  return {
    clip,
    clipFileName: clip?.fileName ?? null,
    durationSeconds,
    hasPlayableClipFile: Boolean(
      clip?.hasMediaFile && mediaUrl && durationSeconds > 0,
    ),
    mediaUrl,
  };
}

export function resolveClipPreviewHeaderState(input: {
  detail: ReplayClipDetail | null;
  detailError: string | null;
  durationOverrideSeconds: number | null;
}): { subtitle: string; title: string } {
  const { clip } = resolveClipPreviewDetail(
    input.detail,
    input.durationOverrideSeconds,
  );
  if (!clip) {
    return {
      subtitle: input.detailError || "Waiting for clip metadata",
      title: "Loading Replay",
    };
  }
  if (clip.status === "failed") {
    return {
      subtitle: clip.error ?? "Replay save failed",
      title: "Replay Failed",
    };
  }

  const isClipReady = clip.hasMediaFile;
  return {
    subtitle: isClipReady
      ? `${clip.sourceGame.toUpperCase()} - ${new Date(clip.createdAt).toLocaleTimeString()}`
      : "Saving replay file",
    title: isClipReady ? "Replay Ready" : "Preparing Replay",
  };
}

export function resolveClipPreviewMediaState(input: {
  detail: ReplayClipDetail | null;
  durationOverrideSeconds: number | null;
  isCopying: boolean;
  isMediaReady: boolean;
  isSaving: boolean;
  mediaError: string | null;
  mediaVersion: number;
}) {
  const detail = resolveClipPreviewDetail(
    input.detail,
    input.durationOverrideSeconds,
  );
  const baseVideoSrc = detail.mediaUrl;
  const separator = baseVideoSrc?.includes("?") ? "&" : "?";
  const videoSrc = baseVideoSrc
    ? `${baseVideoSrc}${separator}v=${input.mediaVersion}`
    : null;
  const isProcessing = input.isCopying || input.isSaving;
  const canUseClip =
    detail.hasPlayableClipFile && Boolean(videoSrc) && input.isMediaReady;
  const isPreparingClip = Boolean(
    (detail.clip &&
      !detail.hasPlayableClipFile &&
      detail.clip.status !== "failed" &&
      (detail.clip.status === "death_detected" ||
        detail.clip.status === "saving_replay" ||
        detail.clip.status === "processing")) ||
      (detail.hasPlayableClipFile &&
        !input.mediaError &&
        (!videoSrc || !input.isMediaReady)),
  );

  return {
    ...detail,
    canUseClip,
    isPreparingClip,
    isProcessing,
    videoSrc,
  };
}

export function resolveClipPreviewOperationState(input: {
  clip: ReplayClipView | null;
  durationSeconds: number;
  fileTitle: string;
  hasSavedClip: boolean;
  isCopying: boolean;
  isMuted: boolean;
  isSaving: boolean;
  titleDraft: string;
  trim: ClipPreviewTrimRange;
}) {
  const hasTrimChanges =
    input.durationSeconds > 0 &&
    (Math.abs(input.trim.inSeconds) > 0.001 ||
      Math.abs(input.trim.outSeconds - input.durationSeconds) > 0.001);
  const trimmedTitle = input.titleDraft.trim();
  const hasTitleChange =
    trimmedTitle.length > 0 && trimmedTitle !== input.fileTitle.trim();
  const canUseClip = Boolean(
    input.clip?.hasMediaFile && input.durationSeconds > 0,
  );
  const isProcessing = input.isCopying || input.isSaving;

  return {
    canCopy: Boolean(input.clip?.hasMediaFile) && !isProcessing,
    canEdit: canUseClip && !isProcessing,
    canOpenSavedClip:
      Boolean(input.clip) && input.hasSavedClip && !isProcessing,
    canSave:
      canUseClip &&
      (hasTrimChanges || hasTitleChange || input.isMuted) &&
      !isProcessing,
    canUseClip,
    clip: input.clip,
    durationSeconds: input.durationSeconds,
    fileTitle: input.fileTitle,
    hasTitleChange,
    hasTrimChanges,
    isProcessing,
    titlePlaceholder: input.fileTitle || "2026-07-08 01-18-40",
    trimmedTitle,
  };
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
