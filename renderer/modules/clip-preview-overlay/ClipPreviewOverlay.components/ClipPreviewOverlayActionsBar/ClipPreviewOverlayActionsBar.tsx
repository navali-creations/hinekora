import clsx from "clsx";
import type { ChangeEvent, CSSProperties } from "react";
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
} from "../../ClipPreviewOverlay.page/useClipPreviewOverlayDetail/useClipPreviewOverlayDetail.utils";
import { resolveClipPreviewOperationState } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayOperations/useClipPreviewOverlayOperations.utils";
import { useClipPreviewOverlayControlsContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

type ProcessingButtonStyle = CSSProperties & {
  "--clip-processing-progress"?: string;
};

function ClipPreviewOverlayActionsBar() {
  const workflow = useClipPreviewOverlayControlsContext();
  const {
    applyPlaybackRateToExport,
    detail,
    durationOverrideSeconds,
    hasCopied,
    hasSavedClip,
    isCopying,
    isMuted,
    isSaving,
    operationProgress,
    playbackRate,
    setApplyPlaybackRateToExport,
    titleDraft,
    trim,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    applyPlaybackRateToExport: clipPreviewOverlay.applyPlaybackRateToExport,
    detail: clipPreviewOverlay.detail,
    durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
    hasCopied: clipPreviewOverlay.hasCopied,
    hasSavedClip: clipPreviewOverlay.hasSavedClip,
    isCopying: clipPreviewOverlay.isCopying,
    isMuted: clipPreviewOverlay.isMuted,
    isSaving: clipPreviewOverlay.isSaving,
    operationProgress: clipPreviewOverlay.operationProgress,
    playbackRate: clipPreviewOverlay.playbackRate,
    setApplyPlaybackRateToExport:
      clipPreviewOverlay.setApplyPlaybackRateToExport,
    titleDraft: clipPreviewOverlay.titleDraft,
    trim: clipPreviewOverlay.trim,
  }));
  const exportPlaybackRate =
    applyPlaybackRateToExport && playbackRate !== 1 ? playbackRate : undefined;
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
      ...(exportPlaybackRate ? { playbackRate: exportPlaybackRate } : {}),
    });
  const processingProgress = `${Math.round(
    Math.min(Math.max(operationProgress, 0), 1) * 100,
  )}%`;
  const processingStyle: ProcessingButtonStyle = {
    "--clip-processing-progress": processingProgress,
  };
  const handleApplyPlaybackRateChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setApplyPlaybackRateToExport(event.currentTarget.checked);
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

      <div className={styles.bottomActionGroup}>
        {playbackRate !== 1 && (
          <label className={styles.speedExportOption}>
            <span>Save/copy at {playbackRate}x</span>
            <input
              aria-label={`Save or copy clip at ${playbackRate}x`}
              checked={applyPlaybackRateToExport}
              className="toggle toggle-primary toggle-xs"
              disabled={isProcessing}
              type="checkbox"
              onChange={handleApplyPlaybackRateChange}
            />
          </label>
        )}
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
    </div>
  );
}

export { ClipPreviewOverlayActionsBar };
