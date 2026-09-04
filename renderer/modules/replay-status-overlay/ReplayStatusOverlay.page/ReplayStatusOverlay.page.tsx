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
  const title = isProcessing
    ? "Processing replay…"
    : isSaved
      ? "Replay saved"
      : "Replay save failed";
  const note = isProcessing
    ? "Finishing your clip."
    : isSaved
      ? "You can edit it later."
      : "Open Hinekora for details.";

  return (
    <OverlayNotice
      className={clsx(
        styles.notification,
        status.dismissing && styles.dismissing,
        status.status === "failed" && styles.failed,
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
      <span className={styles.note}>{note}</span>
    </OverlayNotice>
  );
}

export { ReplayStatusOverlayPage };
