import { useEffect, useState } from "react";

import { useManagedRecorderShallow } from "~/renderer/store";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";

function RecorderOverlayTimer() {
  const startedAt = useManagedRecorderShallow((managedRecorder) => {
    const status = managedRecorder.status;

    return status?.runRecordingStartedAt ?? status?.recordingStartedAt ?? null;
  });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());

    if (!startedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, [startedAt]);

  return (
    <span className={styles.timer} aria-label="Recording timer">
      {formatElapsedTime(startedAt, nowMs)}
    </span>
  );
}

function formatElapsedTime(
  referenceTime: string | null,
  nowMs: number,
): string {
  if (!referenceTime) {
    return "00:00";
  }

  const referenceMs = new Date(referenceTime).getTime();
  if (!Number.isFinite(referenceMs)) {
    return "00:00";
  }

  const totalSeconds = Math.max(0, Math.floor((nowMs - referenceMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = minutes.toString().padStart(2, "0");
  const paddedSeconds = seconds.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}

export { RecorderOverlayTimer };
