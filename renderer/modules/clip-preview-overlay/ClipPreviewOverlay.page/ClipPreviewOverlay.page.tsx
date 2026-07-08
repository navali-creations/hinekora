import clsx from "clsx";
import { useEffect } from "react";
import {
  FiCheck as Check,
  FiCopy as Copy,
  FiEdit3 as Edit,
  FiFolder as FolderOpen,
  FiMaximize2 as Fullscreen,
  FiPause as Pause,
  FiPlay as Play,
  FiSave as Save,
  FiVolume2 as Volume,
  FiVolumeX as VolumeMuted,
  FiX as X,
} from "react-icons/fi";

import { ClipPreviewInfoAlert } from "../ClipPreviewOverlay.components/ClipPreviewInfoAlert/ClipPreviewInfoAlert";
import { ClipPreviewTrimRail } from "../ClipPreviewOverlay.components/ClipPreviewTrimRail/ClipPreviewTrimRail";
import { formatClipPreviewTimestamp } from "../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import styles from "./ClipPreviewOverlayPage.module.css";
import { useClipPreviewOverlayWorkflow } from "./useClipPreviewOverlayWorkflow/useClipPreviewOverlayWorkflow";

const clipPreviewRouteClassName = "is-clip-preview-route";

function ClipPreviewOverlayPage() {
  const workflow = useClipPreviewOverlayWorkflow();
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
          <strong>{workflow.title}</strong>
          <span>{workflow.subtitle}</span>
        </div>
        <div className={styles.headerActions}>
          <button
            className={clsx(
              styles.editButton,
              styles.secondaryButton,
              "btn btn-sm",
            )}
            disabled={!workflow.canUseClip}
            type="button"
            onClick={workflow.handleEditClip}
          >
            <Edit size={15} />
            Continue in editor
          </button>
          <button
            aria-label="Close replay preview"
            className={`${styles.closeButton} btn btn-primary btn-square btn-sm`}
            type="button"
            onClick={workflow.handleClose}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className={styles.videoShell}>
        {workflow.videoSrc ? (
          <>
            <video
              autoPlay
              className={styles.video}
              muted={workflow.isMuted}
              playsInline
              ref={workflow.videoRef}
              src={workflow.videoSrc}
              onError={workflow.handleVideoError}
              onLoadedMetadata={workflow.handleLoadedMetadata}
              onPause={workflow.handlePause}
              onPlay={workflow.handlePlay}
              onTimeUpdate={workflow.handleTimeUpdate}
            />
            <div className={styles.videoControls}>
              <button
                aria-label={workflow.isMuted ? "Unmute replay" : "Mute replay"}
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
                  aria-label={
                    workflow.isPlaying ? "Pause replay" : "Play replay"
                  }
                  className={`${styles.playButton} btn btn-primary btn-circle btn-sm`}
                  disabled={!workflow.canUseClip}
                  type="button"
                  onClick={workflow.handleTogglePlayback}
                >
                  {workflow.isPlaying ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                </button>
                <span className={styles.videoTime}>
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
                disabled={!workflow.clipPath}
                type="button"
                onClick={workflow.handleOpenClip}
              >
                <Fullscreen size={15} />
              </button>
            </div>
          </>
        ) : (
          <div className={styles.empty}>Preparing preview</div>
        )}
      </div>

      <ClipPreviewTrimRail
        disabled={!workflow.canUseClip || workflow.isSaving}
        durationSeconds={workflow.durationSeconds}
        playbackSeconds={workflow.playbackSeconds}
        trim={workflow.trim}
        onSeek={workflow.seekPreview}
        onTrimChange={workflow.handleTrimChange}
      />

      <div className={styles.bottomBar}>
        <label className={styles.nameField}>
          <span>Clip name</span>
          <div className="join w-full">
            <input
              className="input input-bordered input-sm join-item min-w-0 flex-1"
              maxLength={120}
              placeholder={workflow.titlePlaceholder}
              type="text"
              value={workflow.titleDraft}
              onChange={workflow.handleTitleChange}
            />
            <span className={`${styles.fileExtension} join-item`}>.mp4</span>
          </div>
        </label>

        <div className={styles.bottomActions}>
          <button
            className={clsx(
              styles.actionButton,
              workflow.isSaving && styles.processingButton,
              "btn btn-primary btn-sm",
            )}
            disabled={!workflow.canSave}
            type="button"
            onClick={workflow.handleSaveClip}
          >
            {workflow.isSaving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Save size={15} />
            )}
            {workflow.isSaving ? "Processing..." : "Save clip"}
          </button>
          <button
            className={clsx(
              styles.actionButton,
              workflow.isCopying && styles.processingButton,
              "btn btn-primary btn-sm",
            )}
            disabled={!workflow.canCopy}
            type="button"
            onClick={workflow.handleCopyClip}
          >
            {workflow.isCopying ? (
              <span className="loading loading-spinner loading-xs" />
            ) : workflow.hasCopied ? (
              <Check size={15} />
            ) : (
              <Copy size={15} />
            )}
            {workflow.isCopying
              ? "Processing..."
              : workflow.hasCopied
                ? "Copied successfully!"
                : "Copy to clipboard"}
          </button>
        </div>
      </div>
      <ClipPreviewInfoAlert />

      {workflow.saveMessage && (
        <div
          className={`${styles.saveMessage} ${
            workflow.saveMessage.tone === "error"
              ? styles.saveError
              : styles.saveSuccess
          }`}
          role="status"
        >
          {workflow.saveMessage.text}
        </div>
      )}
    </main>
  );
}

export { ClipPreviewOverlayPage };
