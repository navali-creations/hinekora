import type { CSSProperties } from "react";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";

type PreviewProgressStyle = CSSProperties & {
  "--clip-preview-progress": string;
};

function ClipPreviewPreparingState() {
  const previewProgress = useClipPreviewOverlayShallow(
    (clipPreviewOverlay) => clipPreviewOverlay.previewProgress,
  );
  const progress = Math.min(Math.max(previewProgress, 0), 1);
  const progressPercent = Math.round(progress * 100);
  const progressStyle: PreviewProgressStyle = {
    "--clip-preview-progress": `${progressPercent}%`,
  };

  return (
    <div className={styles.previewPreparing}>
      <div aria-hidden="true" className={styles.previewDotField} />
      <div aria-hidden="true" className={styles.previewDotGlow} />
      <div aria-live="polite" className={styles.previewPreparingContent}>
        <span>Preparing preview</span>
        <strong>{progressPercent}%</strong>
        <div
          aria-label="Preview preparation progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progressPercent}
          className={styles.previewProgressTrack}
          role="progressbar"
          style={progressStyle}
        >
          <span />
        </div>
      </div>
    </div>
  );
}

export { ClipPreviewPreparingState };
