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
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return "0:00";
  }

  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatEditorTimestamp(seconds: number | null | undefined): string {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return "0:00.00";
  }

  const roundedCentiseconds = Math.round(seconds * 100);
  const minutes = Math.floor(roundedCentiseconds / 6_000);
  const remainingCentiseconds = roundedCentiseconds % 6_000;
  const wholeSeconds = Math.floor(remainingCentiseconds / 100);
  const centiseconds = remainingCentiseconds % 100;

  return `${minutes}:${wholeSeconds.toString().padStart(2, "0")}.${centiseconds
    .toString()
    .padStart(2, "0")}`;
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
