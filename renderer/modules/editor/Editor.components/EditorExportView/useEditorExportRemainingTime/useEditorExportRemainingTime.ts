import { useEffect, useState } from "react";

import { resolveEditorExportRemainingTime } from "../EditorExportView.utils";

const exportEstimateRefreshMs = 1_000;

function useEditorExportRemainingTime(input: {
  isExporting: boolean;
  progress: number;
  startedAt: string | null;
}): string | null {
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  useEffect(() => {
    if (!input.isExporting) {
      return;
    }

    setCurrentTimeMs(Date.now());
    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, exportEstimateRefreshMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [input.isExporting]);

  if (!input.isExporting) {
    return null;
  }

  const parsedStartedAtMs = input.startedAt
    ? Date.parse(input.startedAt)
    : Number.NaN;
  const startedAtMs = Number.isFinite(parsedStartedAtMs)
    ? parsedStartedAtMs
    : currentTimeMs;

  return resolveEditorExportRemainingTime({
    elapsedMs: Math.max(0, currentTimeMs - startedAtMs),
    progress: input.progress,
  });
}

export { useEditorExportRemainingTime };
