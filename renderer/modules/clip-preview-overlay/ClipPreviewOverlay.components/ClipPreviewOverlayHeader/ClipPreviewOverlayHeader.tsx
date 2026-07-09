import clsx from "clsx";
import { FiEdit3 as Edit, FiX as X } from "react-icons/fi";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { useClipPreviewOverlayControlsContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

function ClipPreviewOverlayHeader() {
  const workflow = useClipPreviewOverlayControlsContext();

  return (
    <header className={`${styles.header} drag`}>
      <div className={styles.title}>
        <strong>{workflow.title}</strong>
        <span>{workflow.subtitle}</span>
      </div>
      <div className={styles.headerActions}>
        <button
          className={clsx(
            styles.editButton,
            styles.secondaryButton,
            "btn btn-sm",
          )}
          disabled={!workflow.canEdit}
          type="button"
          onClick={workflow.handleEditClip}
        >
          <Edit size={15} />
          Continue in editor
        </button>
        <button
          aria-label="Close replay preview"
          className={`${styles.closeButton} btn btn-primary btn-square btn-sm`}
          type="button"
          onClick={workflow.handleClose}
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
}

export { ClipPreviewOverlayHeader };
