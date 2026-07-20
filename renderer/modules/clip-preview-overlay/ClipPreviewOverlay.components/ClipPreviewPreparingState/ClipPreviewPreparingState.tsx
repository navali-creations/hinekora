import { MediaProcessingProgress } from "~/renderer/components/MediaProcessingProgress/MediaProcessingProgress";
import { useClipPreviewOverlayShallow } from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";

function ClipPreviewPreparingState() {
  const previewProgress = useClipPreviewOverlayShallow(
    (clipPreviewOverlay) => clipPreviewOverlay.previewProgress,
  );

  return (
    <div className={styles.previewPreparing}>
      <MediaProcessingProgress
        ariaLabel="Preview preparation progress"
        label="Preparing preview"
        progress={previewProgress}
      />
    </div>
  );
}

export { ClipPreviewPreparingState };
