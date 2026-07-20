import { useEffect, useRef, useState } from "react";

import { resolveEditorExportRemainingTime } from "../EditorExportView.utils";

const exportEstimateRefreshMs = 1_000;

function useEditorExportRemainingTime(input: {
  isExporting: boolean;
  progress: number;
}): string | null {
  const startedAtMsRef = useRef<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  useEffect(() => {
    if (!input.isExporting) {
      startedAtMsRef.current = null;
      return;
    }

    const startedAtMs = Date.now();
    startedAtMsRef.current = startedAtMs;
    setCurrentTimeMs(startedAtMs);
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

  return resolveEditorExportRemainingTime({
    elapsedMs: Math.max(
      0,
      currentTimeMs - (startedAtMsRef.current ?? currentTimeMs),
    ),
    progress: input.progress,
  });
}

export { useEditorExportRemainingTime };
