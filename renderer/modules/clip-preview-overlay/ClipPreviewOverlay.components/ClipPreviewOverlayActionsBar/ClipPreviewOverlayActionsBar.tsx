import clsx from "clsx";
import type { CSSProperties } from "react";
import {
  FiCheck as Check,
  FiCopy as Copy,
  FiSave as Save,
} from "react-icons/fi";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { useClipPreviewOverlayControlsContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

type ProcessingButtonStyle = CSSProperties & {
  "--clip-processing-progress"?: string;
};

function ClipPreviewOverlayActionsBar() {
  const workflow = useClipPreviewOverlayControlsContext();
  const processingProgress = `${Math.round(
    Math.min(Math.max(workflow.operationProgress, 0), 1) * 100,
  )}%`;
  const processingStyle: ProcessingButtonStyle = {
    "--clip-processing-progress": processingProgress,
  };

  return (
    <div className={styles.bottomBar}>
      <label className={styles.nameField}>
        <span>Clip name</span>
        <div className="join w-full">
          <input
            className="input input-bordered input-sm join-item min-w-0 flex-1"
            disabled={workflow.isProcessing}
            maxLength={120}
            placeholder={workflow.titlePlaceholder}
            type="text"
            value={workflow.titleDraft}
            onChange={workflow.handleTitleChange}
          />
          <span className={`${styles.fileExtension} join-item`}>.mp4</span>
        </div>
      </label>

      <div className={styles.bottomActions}>
        <button
          className={clsx(
            styles.actionButton,
            workflow.isSaving && styles.processingButton,
            "btn btn-primary btn-sm",
          )}
          disabled={!workflow.canSave}
          style={workflow.isSaving ? processingStyle : undefined}
          type="button"
          onClick={workflow.handleSaveClip}
        >
          {workflow.isSaving ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Save size={15} />
          )}
          {workflow.isSaving ? "Processing..." : "Save clip"}
        </button>
        <button
          className={clsx(
            styles.actionButton,
            workflow.isCopying && styles.processingButton,
            "btn btn-primary btn-sm",
          )}
          disabled={!workflow.canCopy}
          style={workflow.isCopying ? processingStyle : undefined}
          type="button"
          onClick={workflow.handleCopyClip}
        >
          {workflow.isCopying ? (
            <span className="loading loading-spinner loading-xs" />
          ) : workflow.hasCopied ? (
            <Check size={15} />
          ) : (
            <Copy size={15} />
          )}
          {workflow.isCopying
            ? "Processing..."
            : workflow.hasCopied
              ? "Copied successfully!"
              : "Copy to clipboard"}
        </button>
      </div>
    </div>
  );
}

export { ClipPreviewOverlayActionsBar };
