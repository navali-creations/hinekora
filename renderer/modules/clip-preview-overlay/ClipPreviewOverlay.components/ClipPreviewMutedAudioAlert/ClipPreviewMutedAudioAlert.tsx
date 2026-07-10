import { FiVolumeX } from "react-icons/fi";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

function ClipPreviewMutedAudioAlert() {
  const isMuted = useClipPreviewOverlayShallow(
    (clipPreviewOverlay) => clipPreviewOverlay.isMuted,
  );

  if (!isMuted) {
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
