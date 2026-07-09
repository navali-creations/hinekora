import clsx from "clsx";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { useClipPreviewOverlayControlsContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

function ClipPreviewOverlaySaveMessage() {
  const { saveMessage } = useClipPreviewOverlayControlsContext();

  if (!saveMessage) {
    return null;
  }

  return (
    <div
      className={clsx(
        styles.saveMessage,
        saveMessage.tone === "error" && styles.saveError,
        saveMessage.tone === "success" && styles.saveSuccess,
      )}
      role="status"
    >
      {saveMessage.text}
    </div>
  );
}

export { ClipPreviewOverlaySaveMessage };
