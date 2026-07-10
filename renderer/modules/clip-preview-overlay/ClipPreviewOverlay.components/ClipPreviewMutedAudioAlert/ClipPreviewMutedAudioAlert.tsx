import { FiVolumeX } from "react-icons/fi";

import { useClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

function ClipPreviewMutedAudioAlert() {
  const workflow = useClipPreviewOverlayMediaContext();

  if (!workflow.isMuted) {
    return null;
  }

  return (
    <div
      className="alert alert-warning text-sm py-1 px-2"
      role="status"
      data-clip-preview-muted-audio-alert=""
    >
      <FiVolumeX size={16} />
      <span>Muted clips are exported without audio.</span>
    </div>
  );
}

export { ClipPreviewMutedAudioAlert };
