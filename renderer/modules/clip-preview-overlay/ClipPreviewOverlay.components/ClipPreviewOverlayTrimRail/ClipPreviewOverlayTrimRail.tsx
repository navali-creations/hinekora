import { useClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";
import { ClipPreviewTrimRail } from "../ClipPreviewTrimRail/ClipPreviewTrimRail";

function ClipPreviewOverlayTrimRail() {
  const workflow = useClipPreviewOverlayMediaContext();

  return (
    <ClipPreviewTrimRail
      disabled={
        !workflow.canUseClip ||
        workflow.isProcessing ||
        workflow.isPreparingClip
      }
      durationSeconds={workflow.durationSeconds}
      playbackSeconds={workflow.playbackSeconds}
      playheadRef={workflow.setPlayheadElement}
      trim={workflow.trim}
      onSeek={workflow.seekPreview}
      onTrimChange={workflow.handleTrimChange}
    />
  );
}

export { ClipPreviewOverlayTrimRail };
