function resolveEditorExportRemainingTime(input: {
  elapsedMs: number;
  progress: number;
}): string {
  const progress = Math.min(Math.max(input.progress, 0), 1);
  if (progress >= 0.98) {
    return "Finishing up...";
  }
  if (progress < 0.05 || input.elapsedMs < 2_000) {
    return "Estimating time left...";
  }

  const elapsedSeconds = input.elapsedMs / 1_000;
  const remainingSeconds = Math.max(
    0,
    (elapsedSeconds * (1 - progress)) / progress,
  );

  return formatEditorExportRemainingTime(remainingSeconds);
}

function formatEditorExportRemainingTime(remainingSeconds: number): string {
  if (remainingSeconds < 10) {
    return "Less than 10 seconds left";
  }
  if (remainingSeconds < 60) {
    return `About ${Math.ceil(remainingSeconds / 5) * 5} seconds left`;
  }
  if (remainingSeconds < 3_600) {
    const minutes = Math.ceil(remainingSeconds / 60);
    return `About ${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
  }

  const hours = Math.floor(remainingSeconds / 3_600);
  const minutes = Math.ceil((remainingSeconds % 3_600) / 60);
  return minutes > 0
    ? `About ${hours}h ${minutes}m left`
    : `About ${hours}h left`;
}

export { resolveEditorExportRemainingTime };
