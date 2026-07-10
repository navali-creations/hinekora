import clsx from "clsx";
import {
  FiFolder as FolderOpen,
  FiMaximize2 as Fullscreen,
  FiPause as Pause,
  FiPlay as Play,
  FiRefreshCw as Retry,
  FiVolume2 as Volume,
  FiVolumeX as VolumeMuted,
} from "react-icons/fi";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { resolveClipPreviewMediaState } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

function ClipPreviewOverlayVideo() {
  const workflow = useClipPreviewOverlayMediaContext();
  const {
    detail,
    durationOverrideSeconds,
    isCopying,
    isMediaReady,
    isMuted,
    isPlaying,
    isSaving,
    mediaError,
    mediaVersion,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    detail: clipPreviewOverlay.detail,
    durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
    isCopying: clipPreviewOverlay.isCopying,
    isMediaReady: clipPreviewOverlay.isMediaReady,
    isMuted: clipPreviewOverlay.isMuted,
    isPlaying: clipPreviewOverlay.isPlaying,
    isSaving: clipPreviewOverlay.isSaving,
    mediaError: clipPreviewOverlay.mediaError,
    mediaVersion: clipPreviewOverlay.mediaVersion,
  }));
  const { canUseClip, clipFileName, isPreparingClip, isProcessing, videoSrc } =
    resolveClipPreviewMediaState({
      detail,
      durationOverrideSeconds,
      isCopying,
      isMediaReady,
      isSaving,
      mediaError,
      mediaVersion,
    });
  const muteLabel = isMuted ? "Unmute replay" : "Mute replay";
  const playbackLabel = isPlaying ? "Pause replay" : "Play replay";

  return (
    <div
      className={clsx(
        styles.videoShell,
        isPreparingClip && styles.videoShellPreparing,
      )}
      data-clip-preview-video-shell=""
    >
      {mediaError ? (
        <div className={styles.empty}>
          <strong>Preview unavailable</strong>
          <span>{mediaError}</span>
          <div className={styles.previewErrorActions}>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={workflow.handleRetryMedia}
            >
              <Retry size={15} />
              Retry
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={!clipFileName}
              type="button"
              onClick={workflow.handleRevealClip}
            >
              <FolderOpen size={15} />
              Show in Explorer
            </button>
          </div>
        </div>
      ) : videoSrc ? (
        <>
          <video
            autoPlay
            className={styles.video}
            muted={isMuted}
            playsInline
            preload="auto"
            ref={workflow.videoRef}
            src={videoSrc}
            onCanPlay={workflow.handleCanPlay}
            onCanPlayThrough={workflow.handleCanPlayThrough}
            onError={workflow.handleVideoError}
            onLoadedData={workflow.handleLoadedData}
            onLoadedMetadata={workflow.handleLoadedMetadata}
            onLoadStart={workflow.handleLoadStart}
            onPause={workflow.handlePause}
            onPlay={workflow.handlePlay}
            onSeeked={workflow.handleSeeked}
            onSeeking={workflow.handleSeeking}
            onTimeUpdate={workflow.handleTimeUpdate}
          />
          <div className={styles.videoControls}>
            <button
              aria-label={muteLabel}
              className={clsx(
                styles.videoIconButton,
                styles.muteButton,
                styles.videoSecondaryButton,
                isMuted && styles.videoSecondaryButtonActive,
                "tooltip tooltip-right btn btn-circle btn-sm",
              )}
              data-tip={isMuted ? "Unmute" : "Mute"}
              disabled={!canUseClip || isProcessing}
              type="button"
              onClick={workflow.handleToggleMuted}
            >
              {isMuted ? <VolumeMuted size={16} /> : <Volume size={16} />}
            </button>
            <div className={styles.playbackRow}>
              <button
                aria-label={playbackLabel}
                className={`${styles.playButton} btn btn-primary btn-circle btn-sm`}
                disabled={!canUseClip}
                type="button"
                onClick={workflow.handleTogglePlayback}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span
                className={styles.videoTime}
                ref={workflow.setPlaybackTimeElement}
              />
            </div>
          </div>
          <div className={styles.videoFileActions}>
            <button
              aria-label="Show clip in Explorer"
              className={clsx(
                styles.videoIconButton,
                styles.videoSecondaryButton,
                "tooltip tooltip-left btn btn-circle btn-sm",
              )}
              data-tip="Show in Explorer"
              disabled={!clipFileName}
              type="button"
              onClick={workflow.handleRevealClip}
            >
              <FolderOpen size={15} />
            </button>
            <button
              aria-label="Open clip fullscreen"
              className={clsx(
                styles.videoIconButton,
                styles.videoSecondaryButton,
                "tooltip tooltip-left btn btn-circle btn-sm",
              )}
              data-tip="Fullscreen"
              disabled={!canUseClip}
              type="button"
              onClick={workflow.handleEnterFullscreen}
            >
              <Fullscreen size={15} />
            </button>
          </div>
        </>
      ) : (
        <div
          className={clsx(
            styles.empty,
            isPreparingClip && styles.emptyPreparing,
          )}
        >
          Preparing preview
        </div>
      )}
    </div>
  );
}

export { ClipPreviewOverlayVideo };
