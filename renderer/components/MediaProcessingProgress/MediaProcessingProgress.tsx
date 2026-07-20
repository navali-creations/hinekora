import clsx from "clsx";
import type { CSSProperties } from "react";

import { MediaProcessingBackdrop } from "../MediaProcessingBackdrop/MediaProcessingBackdrop";
import styles from "./MediaProcessingProgress.module.css";

type ProcessingProgressStyle = CSSProperties & {
  "--media-processing-progress": string;
};

interface MediaProcessingProgressProps {
  ariaLabel: string;
  className?: string;
  detail?: string | null;
  label?: string | null;
  progress: number;
  showBackdrop?: boolean;
  status?: string | null;
}

function MediaProcessingProgress({
  ariaLabel,
  className,
  detail = null,
  label = null,
  progress,
  showBackdrop = true,
  status = null,
}: MediaProcessingProgressProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 1);
  const progressPercent = Math.round(normalizedProgress * 100);
  const progressStyle: ProcessingProgressStyle = {
    "--media-processing-progress": `${progressPercent}%`,
  };

  return (
    <div
      className={clsx(
        styles.root,
        {
          [styles.withoutBackdrop!]: !showBackdrop,
        },
        className,
      )}
    >
      {showBackdrop && <MediaProcessingBackdrop />}
      <div aria-live="polite" className={styles.content}>
        {label && <span className={styles.label}>{label}</span>}
        <strong className={styles.percent}>{progressPercent}%</strong>
        {detail && (
          <span className={styles.detail} title={detail}>
            {detail}
          </span>
        )}
        <div
          aria-label={ariaLabel}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progressPercent}
          className={styles.track}
          role="progressbar"
          style={progressStyle}
        >
          <span />
        </div>
        {status && <span className={styles.status}>{status}</span>}
      </div>
    </div>
  );
}

export { MediaProcessingProgress };
