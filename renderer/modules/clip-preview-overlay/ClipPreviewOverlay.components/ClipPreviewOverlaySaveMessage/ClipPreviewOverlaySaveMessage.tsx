import clsx from "clsx";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { useClipPreviewOverlayControlsContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

function ClipPreviewOverlaySaveMessage() {
  const { handleOpenSavedClipInEditor } =
    useClipPreviewOverlayControlsContext();
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
            onClick={(event) => {
              event.preventDefault();
              handleOpenSavedClipInEditor();
            }}
          >
            Open in Clips view
          </a>
        </>
      )}
    </div>
  );
}

export { ClipPreviewOverlaySaveMessage };
