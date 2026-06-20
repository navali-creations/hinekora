import type { SyntheticEvent } from "react";
import { useEffect, useMemo } from "react";
import {
  FiFolder as FolderOpen,
  FiPlay as Play,
  FiX as X,
} from "react-icons/fi";

import { useReplayClipsShallow } from "~/renderer/store";

import {
  createClipPreviewMediaUrl,
  resolveClipPreviewRouteClipId,
} from "../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import styles from "./ClipPreviewOverlayPage.module.css";

const clipPreviewRouteClassName = "is-clip-preview-route";

function ClipPreviewOverlayPage() {
  const { activeClip, items, openClip, revealClip } = useReplayClipsShallow(
    (replayClips) => ({
      activeClip: replayClips.activeClip,
      items: replayClips.items,
      openClip: replayClips.openClip,
      revealClip: replayClips.revealClip,
    }),
  );
  const clipId = useMemo(
    () => resolveClipPreviewRouteClipId(window.location.hash),
    [],
  );
  const clip =
    items.find((item) => item.id === clipId) ??
    (activeClip?.id === clipId ? activeClip : null);
  const clipPath = clip?.processedClipPath ?? clip?.originalObsPath ?? null;
  const videoSrc = useMemo(
    () => (clip?.id && clipPath ? createClipPreviewMediaUrl(clip.id) : null),
    [clip?.id, clipPath],
  );
  const title = clip ? "Replay Ready" : "Loading Replay";
  const subtitle = clip
    ? `${clip.sourceGame.toUpperCase()} - ${new Date(clip.createdAt).toLocaleTimeString()}`
    : "Waiting for clip metadata";

  const handleClose = () => {
    void window.electron.overlayWindows.hideClipPreview();
  };

  const handleOpenClip = () => {
    if (clip) {
      void openClip(clip.id);
    }
  };

  const handleRevealClip = () => {
    if (clip) {
      void revealClip(clip.id);
    }
  };
  const handleVideoError = (event: SyntheticEvent<HTMLVideoElement>) => {
    const mediaError = event.currentTarget.error;
    console.warn("[clip-preview] Replay video failed to load", {
      clipId: clip?.id ?? null,
      code: mediaError?.code ?? null,
      message: mediaError?.message ?? null,
      src: videoSrc,
    });
  };

  useEffect(() => {
    document.documentElement.classList.add(clipPreviewRouteClassName);
    document.body.classList.add(clipPreviewRouteClassName);

    return () => {
      document.documentElement.classList.remove(clipPreviewRouteClassName);
      document.body.classList.remove(clipPreviewRouteClassName);
    };
  }, []);

  return (
    <main className={styles.overlay}>
      <header className={`${styles.header} drag`}>
        <div className={styles.title}>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <button
          aria-label="Close replay preview"
          className={`${styles.closeButton} btn btn-primary btn-square btn-sm`}
          type="button"
          onClick={handleClose}
        >
          <X size={16} />
        </button>
      </header>

      <div className={styles.videoShell}>
        {videoSrc ? (
          <video
            autoPlay
            className={styles.video}
            controls
            playsInline
            src={videoSrc}
            onError={handleVideoError}
          />
        ) : (
          <div className={styles.empty}>Preparing preview</div>
        )}
      </div>

      <footer className={styles.actions}>
        <button
          className={`${styles.actionButton} btn btn-primary btn-sm`}
          type="button"
          disabled={!clipPath}
          onClick={handleOpenClip}
        >
          <Play size={15} />
          Open
        </button>
        <button
          className={`${styles.actionButton} btn btn-primary btn-sm`}
          type="button"
          disabled={!clipPath}
          onClick={handleRevealClip}
        >
          <FolderOpen size={15} />
          Folder
        </button>
      </footer>
    </main>
  );
}

export { ClipPreviewOverlayPage };
