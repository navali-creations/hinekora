import { useClipPreviewOverlayShallow } from "~/renderer/store";

import { resolveClipPreviewMediaState } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayMediaWorkflow/useClipPreviewOverlayMediaWorkflow.utils";
import { useClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";
import { ClipPreviewTrimRail } from "../ClipPreviewTrimRail/ClipPreviewTrimRail";

function ClipPreviewOverlayTrimRail() {
  const workflow = useClipPreviewOverlayMediaContext();
  const {
    detail,
    durationOverrideSeconds,
    isCopying,
    isMediaReady,
    isSaving,
    mediaError,
    mediaVersion,
    trim,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    detail: clipPreviewOverlay.detail,
    durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
    isCopying: clipPreviewOverlay.isCopying,
    isMediaReady: clipPreviewOverlay.isMediaReady,
    isSaving: clipPreviewOverlay.isSaving,
    mediaError: clipPreviewOverlay.mediaError,
    mediaVersion: clipPreviewOverlay.mediaVersion,
    trim: clipPreviewOverlay.trim,
  }));
  const { canUseClip, durationSeconds, isPreparingClip, isProcessing } =
    resolveClipPreviewMediaState({
      detail,
      durationOverrideSeconds,
      isCopying,
      isMediaReady,
      isSaving,
      mediaError,
      mediaVersion,
    });

  return (
    <ClipPreviewTrimRail
      disabled={!canUseClip || isProcessing || isPreparingClip}
      durationSeconds={durationSeconds}
      playheadRef={workflow.setPlayheadElement}
      trim={trim}
      onSeek={workflow.seekPreview}
      onTrimCommit={workflow.handleTrimCommit}
      onTrimPreview={workflow.handleTrimPreview}
    />
  );
}

export { ClipPreviewOverlayTrimRail };
