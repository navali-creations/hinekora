import clsx from "clsx";
import type { MouseEvent } from "react";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { useClipPreviewOverlayControlsContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

function ClipPreviewOverlaySaveMessage() {
  const { handleOpenSavedClip } = useClipPreviewOverlayControlsContext();
  const { detail, hasSavedClip, isCopying, isSaving, saveMessage } =
    useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
      detail: clipPreviewOverlay.detail,
      hasSavedClip: clipPreviewOverlay.hasSavedClip,
      isCopying: clipPreviewOverlay.isCopying,
      isSaving: clipPreviewOverlay.isSaving,
      saveMessage: clipPreviewOverlay.saveMessage,
    }));
  const canOpenSavedClip =
    Boolean(detail?.clip) && hasSavedClip && !isCopying && !isSaving;
  const handleOpenSavedClipClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    handleOpenSavedClip();
  };

  if (!saveMessage) {
    return null;
  }

  return (
    <div
      className={clsx(
        styles.saveMessage,
        saveMessage.tone === "error" && styles.saveError,
        saveMessage.tone === "success" && styles.saveSuccess,
      )}
      role="status"
    >
      {saveMessage.text}
      {canOpenSavedClip && saveMessage.text === "Clip saved." && (
        <>
          {" "}
          <a
            className="link link-hover text-sky-400 underline"
            href="#"
            onClick={handleOpenSavedClipClick}
          >
            Open in Clips view
          </a>
        </>
      )}
    </div>
  );
}

export { ClipPreviewOverlaySaveMessage };
