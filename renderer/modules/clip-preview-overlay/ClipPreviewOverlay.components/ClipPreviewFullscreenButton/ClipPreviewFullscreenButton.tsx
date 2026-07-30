import clsx from "clsx";
import {
  FiMinimize2 as CloseFullscreen,
  FiMaximize2 as OpenFullscreen,
} from "react-icons/fi";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { useClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

interface ClipPreviewFullscreenButtonProps {
  canEnterFullscreen: boolean;
  placement: "header" | "video";
}

function ClipPreviewFullscreenButton({
  canEnterFullscreen,
  placement,
}: ClipPreviewFullscreenButtonProps) {
  const workflow = useClipPreviewOverlayMediaContext();
  const isFullscreen = useClipPreviewOverlayShallow(
    (clipPreviewOverlay) => clipPreviewOverlay.isFullscreen,
  );
  const label = isFullscreen ? "Close fullscreen" : "Open clip fullscreen";
  const tooltip = isFullscreen ? "Close fullscreen" : "Fullscreen";

  return (
    <button
      aria-label={label}
      className={clsx(
        styles.videoIconButton,
        styles.videoSecondaryButton,
        "tooltip btn btn-sm",
        {
          "tooltip-bottom btn-square": placement === "header",
          "tooltip-left btn-circle": placement === "video",
        },
      )}
      data-tip={tooltip}
      disabled={!isFullscreen && !canEnterFullscreen}
      type="button"
      onClick={workflow.handleToggleFullscreen}
    >
      {isFullscreen ? (
        <CloseFullscreen size={15} />
      ) : (
        <OpenFullscreen size={15} />
      )}
    </button>
  );
}

export { ClipPreviewFullscreenButton };
