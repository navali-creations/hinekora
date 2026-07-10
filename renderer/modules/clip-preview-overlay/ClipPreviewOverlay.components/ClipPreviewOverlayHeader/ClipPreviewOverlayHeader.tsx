import clsx from "clsx";
import { FiEdit3 as Edit, FiX as X } from "react-icons/fi";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import {
  resolveClipPreviewDetail,
  resolveClipPreviewHeaderState,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayControlsContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

function ClipPreviewOverlayHeader() {
  const workflow = useClipPreviewOverlayControlsContext();
  const { detail, detailError, durationOverrideSeconds, isCopying, isSaving } =
    useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
      detail: clipPreviewOverlay.detail,
      detailError: clipPreviewOverlay.detailError,
      durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
      isCopying: clipPreviewOverlay.isCopying,
      isSaving: clipPreviewOverlay.isSaving,
    }));
  const { clip, durationSeconds } = resolveClipPreviewDetail(
    detail,
    durationOverrideSeconds,
  );
  const { subtitle, title } = resolveClipPreviewHeaderState({
    detail,
    detailError,
    durationOverrideSeconds,
  });
  const isProcessing = isCopying || isSaving;
  const canEdit =
    Boolean(clip?.hasMediaFile && durationSeconds > 0) && !isProcessing;

  return (
    <header className={`${styles.header} drag`}>
      <div className={styles.title}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className={styles.headerActions}>
        <button
          className={clsx(
            styles.editButton,
            styles.secondaryButton,
            "btn btn-sm",
          )}
          disabled={!canEdit}
          type="button"
          onClick={workflow.handleEditClip}
        >
          <Edit size={15} />
          Continue in editor
        </button>
        <button
          aria-label="Close replay preview"
          className={`${styles.closeButton} btn btn-primary btn-square btn-sm`}
          disabled={isProcessing}
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
