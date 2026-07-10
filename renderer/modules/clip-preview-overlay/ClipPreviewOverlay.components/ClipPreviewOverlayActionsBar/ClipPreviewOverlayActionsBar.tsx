import clsx from "clsx";
import type { CSSProperties } from "react";
import {
  FiCheck as Check,
  FiCopy as Copy,
  FiSave as Save,
} from "react-icons/fi";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import {
  getClipPreviewFileTitle,
  resolveClipPreviewDetail,
  resolveClipPreviewOperationState,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayControlsContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

type ProcessingButtonStyle = CSSProperties & {
  "--clip-processing-progress"?: string;
};

function ClipPreviewOverlayActionsBar() {
  const workflow = useClipPreviewOverlayControlsContext();
  const {
    detail,
    durationOverrideSeconds,
    hasCopied,
    hasSavedClip,
    isCopying,
    isMuted,
    isSaving,
    operationProgress,
    titleDraft,
    trim,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    detail: clipPreviewOverlay.detail,
    durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
    hasCopied: clipPreviewOverlay.hasCopied,
    hasSavedClip: clipPreviewOverlay.hasSavedClip,
    isCopying: clipPreviewOverlay.isCopying,
    isMuted: clipPreviewOverlay.isMuted,
    isSaving: clipPreviewOverlay.isSaving,
    operationProgress: clipPreviewOverlay.operationProgress,
    titleDraft: clipPreviewOverlay.titleDraft,
    trim: clipPreviewOverlay.trim,
  }));
  const { clip, clipFileName, durationSeconds } = resolveClipPreviewDetail(
    detail,
    durationOverrideSeconds,
  );
  const { canCopy, canSave, isProcessing, titlePlaceholder } =
    resolveClipPreviewOperationState({
      clip,
      durationSeconds,
      fileTitle: getClipPreviewFileTitle(clipFileName),
      hasSavedClip,
      isCopying,
      isMuted,
      isSaving,
      titleDraft,
      trim,
    });
  const processingProgress = `${Math.round(
    Math.min(Math.max(operationProgress, 0), 1) * 100,
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
            disabled={isProcessing}
            maxLength={120}
            placeholder={titlePlaceholder}
            type="text"
            value={titleDraft}
            onChange={workflow.handleTitleChange}
          />
          <span className={`${styles.fileExtension} join-item`}>.mp4</span>
        </div>
      </label>

      <div className={styles.bottomActions}>
        <button
          className={clsx(
            styles.actionButton,
            isSaving && styles.processingButton,
            "btn btn-primary btn-sm",
          )}
          disabled={!canSave}
          style={isSaving ? processingStyle : undefined}
          type="button"
          onClick={workflow.handleSaveClip}
        >
          {isSaving ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Save size={15} />
          )}
          {isSaving ? "Processing..." : "Save clip"}
        </button>
        <button
          className={clsx(
            styles.actionButton,
            isCopying && styles.processingButton,
            "btn btn-primary btn-sm",
          )}
          disabled={!canCopy}
          style={isCopying ? processingStyle : undefined}
          type="button"
          onClick={workflow.handleCopyClip}
        >
          {isCopying ? (
            <span className="loading loading-spinner loading-xs" />
          ) : hasCopied ? (
            <Check size={15} />
          ) : (
            <Copy size={15} />
          )}
          {isCopying
            ? "Processing..."
            : hasCopied
              ? "Copied successfully!"
              : "Copy to clipboard"}
        </button>
      </div>
    </div>
  );
}

export { ClipPreviewOverlayActionsBar };
