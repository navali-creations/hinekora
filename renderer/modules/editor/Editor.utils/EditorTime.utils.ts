import { formatMediaTime } from "~/renderer/modules/media-playback/MediaTimeline.utils/MediaTimeline.utils";

const fallbackTimelineDurationSeconds = 10;

function normalizeEditorDuration(durationSeconds: number | null): number {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return fallbackTimelineDurationSeconds;
  }

  return Math.max(0.001, roundToMilliseconds(durationSeconds));
}

function formatEditorTime(seconds: number | null | undefined): string {
  return formatMediaTime(seconds);
}

function formatEditorTimestamp(seconds: number | null | undefined): string {
  return formatMediaTime(seconds, true);
}

function roundToMilliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export {
  formatEditorTime,
  formatEditorTimestamp,
  normalizeEditorDuration,
  roundToMilliseconds,
};
