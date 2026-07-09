import clsx from "clsx";
import {
  FiFolder as FolderOpen,
  FiMaximize2 as Fullscreen,
  FiPause as Pause,
  FiPlay as Play,
  FiVolume2 as Volume,
  FiVolumeX as VolumeMuted,
} from "react-icons/fi";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { formatClipPreviewTimestamp } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

function ClipPreviewOverlayVideo() {
  const workflow = useClipPreviewOverlayMediaContext();
  const muteLabel = workflow.isMuted ? "Unmute replay" : "Mute replay";
  const playbackLabel = workflow.isPlaying ? "Pause replay" : "Play replay";

  return (
    <div
      className={clsx(
        styles.videoShell,
        workflow.isPreparingClip && styles.videoShellPreparing,
      )}
      data-clip-preview-video-shell=""
    >
      {workflow.videoSrc ? (
        <>
          <video
            autoPlay
            className={styles.video}
            muted={workflow.isMuted}
            playsInline
            preload="auto"
            ref={workflow.videoRef}
            src={workflow.videoSrc}
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
            onWaiting={workflow.handleWaiting}
          />
          <div className={styles.videoControls}>
            <button
              aria-label={muteLabel}
              className={clsx(
                styles.videoIconButton,
                styles.muteButton,
                styles.videoSecondaryButton,
                workflow.isMuted && styles.videoSecondaryButtonActive,
                "tooltip tooltip-right btn btn-circle btn-sm",
              )}
              data-tip={workflow.isMuted ? "Unmute" : "Mute"}
              disabled={!workflow.canUseClip}
              type="button"
              onClick={workflow.handleToggleMuted}
            >
              {workflow.isMuted ? (
                <VolumeMuted size={16} />
              ) : (
                <Volume size={16} />
              )}
            </button>
            <div className={styles.playbackRow}>
              <button
                aria-label={playbackLabel}
                className={`${styles.playButton} btn btn-primary btn-circle btn-sm`}
                disabled={!workflow.canUseClip}
                type="button"
                onClick={workflow.handleTogglePlayback}
              >
                {workflow.isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span
                className={styles.videoTime}
                ref={workflow.setPlaybackTimeElement}
              >
                {formatClipPreviewTimestamp(workflow.playbackSeconds)} /{" "}
                {formatClipPreviewTimestamp(workflow.durationSeconds)}
              </span>
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
              disabled={!workflow.clipPath}
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
              disabled={!workflow.canUseClip}
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
            workflow.isPreparingClip && styles.emptyPreparing,
          )}
        >
          Preparing preview
        </div>
      )}
    </div>
  );
}

export { ClipPreviewOverlayVideo };
