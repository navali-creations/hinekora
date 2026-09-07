import clsx from "clsx";
import { useEffect } from "react";
import { FiAlertCircle, FiCheckCircle, FiLoader } from "react-icons/fi";

import { OverlayNotice } from "~/renderer/components/OverlayNotice/OverlayNotice";
import { useBoundStore } from "~/renderer/store";

import { readReplayStatusClipId } from "./ReplayStatusOverlay.page.utils";
import styles from "./ReplayStatusOverlayPage.module.css";

function ReplayStatusOverlayPage() {
  const clipId = readReplayStatusClipId();
  const startListening = useBoundStore(
    (state) => state.replayStatusOverlay.startListening,
  );
  const status = useBoundStore((state) => state.replayStatusOverlay.status);

  useEffect(() => startListening(clipId), [clipId, startListening]);

  if (!status) {
    return null;
  }

  const isProcessing = status.status === "processing";
  const isSaved = status.status === "saved";
  const isFailed = status.status === "failed";
  const title = isProcessing
    ? "Processing replay…"
    : isSaved
      ? "Replay saved"
      : "Replay save failed";

  return (
    <OverlayNotice
      className={clsx(
        styles.notification,
        status.dismissing && styles.dismissing,
        isFailed && styles.failed,
      )}
      data-dismissing={status.dismissing}
      data-status={status.status}
      key={status.clipId}
    >
      {isProcessing ? (
        <FiLoader
          aria-hidden="true"
          className={`${styles.icon} animate-spin motion-reduce:animate-none`}
        />
      ) : isSaved ? (
        <FiCheckCircle aria-hidden="true" className={styles.icon} />
      ) : (
        <FiAlertCircle aria-hidden="true" className={styles.icon} />
      )}
      <span className={styles.title}>{title}</span>
      {isFailed && (
        <span className={styles.note}>Open Hinekora for details.</span>
      )}
    </OverlayNotice>
  );
}

export { ReplayStatusOverlayPage };
