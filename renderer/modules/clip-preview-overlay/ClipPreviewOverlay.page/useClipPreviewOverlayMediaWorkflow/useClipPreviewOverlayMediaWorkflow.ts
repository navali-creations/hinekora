import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { trackEvent } from "~/renderer/modules/umami";
import { useClipPreviewOverlayShallow } from "~/renderer/store";

import {
  type ClipPreviewTrimRange,
  createClipPreviewMediaUrl,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayPlayback } from "../useClipPreviewOverlayPlayback/useClipPreviewOverlayPlayback";
import { useClipPreviewOverlayPlaybackPresentation } from "../useClipPreviewOverlayPlaybackPresentation/useClipPreviewOverlayPlaybackPresentation";

function useClipPreviewOverlayMediaWorkflow() {
  const hasUserAdjustedTrimRef = useRef(false);
  const [isMediaReady, setMediaReady] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const {
    detail,
    durationOverrideSeconds,
    isCopying,
    isSaving,
    mediaVersion,
    operationProgress,
    setCopied,
    setDurationOverrideSeconds,
    setSaveMessage,
    setTrim,
    trim,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    detail: clipPreviewOverlay.detail,
    durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
    isCopying: clipPreviewOverlay.isCopying,
    isSaving: clipPreviewOverlay.isSaving,
    mediaVersion: clipPreviewOverlay.mediaVersion,
    operationProgress: clipPreviewOverlay.operationProgress,
    setCopied: clipPreviewOverlay.setCopied,
    setDurationOverrideSeconds: clipPreviewOverlay.setDurationOverrideSeconds,
    setSaveMessage: clipPreviewOverlay.setSaveMessage,
    setTrim: clipPreviewOverlay.setTrim,
    trim: clipPreviewOverlay.trim,
  }));
  const clip = detail?.clip ?? null;
  const clipPath = clip?.processedClipPath ?? clip?.originalObsPath ?? null;
  const baseVideoSrc = useMemo(
    () => (clip?.id && clipPath ? createClipPreviewMediaUrl(clip.id) : null),
    [clip?.id, clipPath],
  );
  const videoSrc = baseVideoSrc ? `${baseVideoSrc}?v=${mediaVersion}` : null;
  const durationSeconds = Math.max(
    0,
    detail?.durationSeconds ??
      durationOverrideSeconds ??
      clip?.durationSeconds ??
      clip?.targetDurationSeconds ??
      0,
  );
  const isProcessing = isCopying || isSaving;
  const hasPlayableClipFile = Boolean(clip && clipPath && durationSeconds > 0);
  const canUseClip = hasPlayableClipFile && Boolean(videoSrc) && isMediaReady;
  const isPreparingClip = Boolean(
    (clip &&
      !hasPlayableClipFile &&
      clip.status !== "failed" &&
      (clip.status === "death_detected" ||
        clip.status === "saving_replay" ||
        clip.status === "processing")) ||
      (hasPlayableClipFile && (!videoSrc || !isMediaReady)),
  );
  const {
    getPlaybackSeconds,
    playbackSeconds,
    setPlaybackTimeElement,
    setPlayheadElement,
    startPlaybackClock,
    stopPlaybackClock,
  } = useClipPreviewOverlayPlaybackPresentation(durationSeconds);
  const {
    handleCanPlay,
    handleCanPlayThrough,
    handleEnterFullscreen,
    handleLoadedData,
    handleLoadedMetadata,
    handleLoadStart,
    handlePause,
    handlePlay,
    handleTimeUpdate,
    handleToggleMuted,
    handleTogglePlayback,
    handleSeeked,
    handleSeeking,
    handleWaiting,
    handleVideoError,
    seekPreview,
    videoRef,
  } = useClipPreviewOverlayPlayback({
    canUseClip,
    clipId: clip?.id ?? null,
    durationSeconds,
    hasUserAdjustedTrimRef,
    isMuted,
    isPlaying,
    setDurationOverrideSeconds,
    setMediaReady,
    setMuted,
    setPlaying,
    setTrim,
    startPlaybackClock,
    stopPlaybackClock,
    trim,
    videoSrc,
  });

  useEffect(() => {
    if (!videoSrc) {
      hasUserAdjustedTrimRef.current = false;
      setMediaReady(false);
      stopPlaybackClock(0);
      setPlaying(false);
      return;
    }

    hasUserAdjustedTrimRef.current = false;
    setMediaReady(false);
    stopPlaybackClock(0);
    setPlaying(false);
  }, [stopPlaybackClock, videoSrc]);

  const handleRevealClip = useCallback(() => {
    if (clip) {
      void window.electron.replayClips.reveal(clip.id).then((result) => {
        if (result.ok) {
          trackEvent("clip-revealed");
        }
      });
    }
  }, [clip]);

  const handleTrimChange = useCallback(
    (
      nextTrim: ClipPreviewTrimRange,
      options?: { previewMedia?: boolean; previewSeconds: number },
    ) => {
      if (isProcessing) {
        return;
      }

      hasUserAdjustedTrimRef.current = true;
      setCopied(false);
      setTrim(nextTrim);
      setSaveMessage(null);
      const currentPlaybackSeconds = getPlaybackSeconds();
      if (options) {
        seekPreview(options.previewSeconds, {
          previewMedia: options.previewMedia === true,
        });
      } else if (currentPlaybackSeconds < nextTrim.inSeconds) {
        seekPreview(nextTrim.inSeconds);
      } else if (currentPlaybackSeconds > nextTrim.outSeconds) {
        seekPreview(nextTrim.outSeconds);
      }
    },
    [
      getPlaybackSeconds,
      isProcessing,
      seekPreview,
      setCopied,
      setSaveMessage,
      setTrim,
    ],
  );

  return {
    canUseClip,
    clipPath,
    durationSeconds,
    handleCanPlay,
    handleCanPlayThrough,
    handleEnterFullscreen,
    handleLoadedData,
    handleLoadedMetadata,
    handleLoadStart,
    handlePause,
    handlePlay,
    handleRevealClip,
    handleSeeked,
    handleSeeking,
    handleTimeUpdate,
    handleToggleMuted,
    handleTogglePlayback,
    handleTrimChange,
    handleWaiting,
    handleVideoError,
    isMuted,
    isPlaying,
    isPreparingClip,
    isProcessing,
    operationProgress,
    playbackSeconds,
    seekPreview,
    setPlaybackTimeElement,
    setPlayheadElement,
    trim,
    videoRef,
    videoSrc,
  };
}

type ClipPreviewOverlayMediaWorkflow = ReturnType<
  typeof useClipPreviewOverlayMediaWorkflow
>;

export type { ClipPreviewOverlayMediaWorkflow };
export { useClipPreviewOverlayMediaWorkflow };
