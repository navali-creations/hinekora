function calculateBookmarkRecordingProgressPercent(input: {
  durationSeconds: number | null;
  offsetSeconds: number | null;
}): number | null {
  if (
    input.offsetSeconds === null ||
    input.durationSeconds === null ||
    !Number.isFinite(input.offsetSeconds) ||
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0
  ) {
    return null;
  }

  const percent = (input.offsetSeconds / input.durationSeconds) * 100;

  return Math.min(100, Math.max(0, Math.round(percent)));
}

export { calculateBookmarkRecordingProgressPercent };
