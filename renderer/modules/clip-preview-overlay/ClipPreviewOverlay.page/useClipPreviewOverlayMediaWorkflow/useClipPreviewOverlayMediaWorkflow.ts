import { useCallback, useEffect, useRef } from "react";

import { trackEvent } from "~/renderer/modules/umami";
import { useClipPreviewOverlayShallow } from "~/renderer/store";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { resolveClipPreviewMediaState } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayDiagnostics } from "../useClipPreviewOverlayDiagnostics/useClipPreviewOverlayDiagnostics";
import { useClipPreviewOverlayPlayback } from "../useClipPreviewOverlayPlayback/useClipPreviewOverlayPlayback";
import { useClipPreviewOverlayPlaybackPresentation } from "../useClipPreviewOverlayPlaybackPresentation/useClipPreviewOverlayPlaybackPresentation";

function useClipPreviewOverlayMediaWorkflow() {
  const hasUserAdjustedTrimRef = useRef(false);
  const {
    detail,
    durationOverrideSeconds,
    isCopying,
    isMediaReady,
    isMuted,
    isPlaying,
    isSaving,
    incrementMediaVersion,
    mediaError,
    mediaVersion,
    setCopied,
    setHasSavedClip,
    setDurationOverrideSeconds,
    setMediaReady,
    setMediaError,
    setSaveMessage,
    setMuted,
    setPlaying,
    setTrim,
    trim,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    detail: clipPreviewOverlay.detail,
    durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
    isCopying: clipPreviewOverlay.isCopying,
    isMediaReady: clipPreviewOverlay.isMediaReady,
    isMuted: clipPreviewOverlay.isMuted,
    isPlaying: clipPreviewOverlay.isPlaying,
    isSaving: clipPreviewOverlay.isSaving,
    incrementMediaVersion: clipPreviewOverlay.incrementMediaVersion,
    mediaError: clipPreviewOverlay.mediaError,
    mediaVersion: clipPreviewOverlay.mediaVersion,
    setCopied: clipPreviewOverlay.setCopied,
    setHasSavedClip: clipPreviewOverlay.setHasSavedClip,
    setDurationOverrideSeconds: clipPreviewOverlay.setDurationOverrideSeconds,
    setMediaReady: clipPreviewOverlay.setMediaReady,
    setMediaError: clipPreviewOverlay.setMediaError,
    setMuted: clipPreviewOverlay.setMuted,
    setSaveMessage: clipPreviewOverlay.setSaveMessage,
    setPlaying: clipPreviewOverlay.setPlaying,
    setTrim: clipPreviewOverlay.setTrim,
    trim: clipPreviewOverlay.trim,
  }));
  const {
    canUseClip,
    clip,
    durationSeconds,
    isPreparingClip,
    isProcessing,
    videoSrc,
  } = resolveClipPreviewMediaState({
    detail,
    durationOverrideSeconds,
    isCopying,
    isMediaReady,
    isSaving,
    mediaError,
    mediaVersion,
  });
  const {
    getPlaybackSeconds,
    setPlaybackTimeElement,
    setPlayheadElement,
    syncPlaybackPresentation,
    updatePlaybackFrame,
  } = useClipPreviewOverlayPlaybackPresentation(durationSeconds);

  const syncMuteState = useCallback(
    (nextMuted: boolean) => {
      setMuted(nextMuted);
    },
    [setMuted],
  );

  const {
    consumePlaybackPresentationMetrics,
    handleCanPlay,
    handleCanPlayThrough,
    handleEnterFullscreen,
    handleLoadedData,
    handleLoadedMetadata,
    handleLoadStart,
    handlePause,
    handlePlay,
    handleTimeUpdate,
    handleToggleMuted: handlePlaybackToggleMuted,
    handleTogglePlayback,
    handleSeeked,
    handleSeeking,
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
    setMediaError,
    setMuted: syncMuteState,
    setPlaying,
    setTrim,
    syncPlaybackPresentation,
    trim,
    updatePlaybackFrame,
    videoSrc,
  });

  useClipPreviewOverlayDiagnostics({
    clipId: clip?.id ?? null,
    clipKind: clip?.kind ?? null,
    clipStatus: clip?.status ?? null,
    consumePlaybackPresentationMetrics,
    durationSeconds,
    hasMediaSource: Boolean(videoSrc),
    isMediaReady,
    isPlaying,
    isPreparingClip,
    isProcessing,
    trim,
    videoRef,
  });

  const handleToggleMuted = handlePlaybackToggleMuted;

  useEffect(() => {
    if (!videoSrc) {
      hasUserAdjustedTrimRef.current = false;
      setMediaReady(false);
      setMediaError(null);
      syncPlaybackPresentation(0);
      setPlaying(false);
      return;
    }

    hasUserAdjustedTrimRef.current = false;
    setMediaReady(false);
    setMediaError(null);
    syncPlaybackPresentation(0);
    setPlaying(false);
  }, [
    setMediaError,
    setMediaReady,
    setPlaying,
    syncPlaybackPresentation,
    videoSrc,
  ]);

  const handleRevealClip = useCallback(() => {
    if (clip) {
      void window.electron.replayClips.reveal(clip.id).then((result) => {
        if (result.ok) {
          trackEvent("clip-revealed");
        }
      });
    }
  }, [clip]);

  const handleRetryMedia = useCallback(() => {
    setMediaError(null);
    incrementMediaVersion();
  }, [incrementMediaVersion, setMediaError]);

  const handleTrimChange = useCallback(
    (nextTrim: ClipPreviewTrimRange, options?: { previewSeconds: number }) => {
      if (isProcessing) {
        return;
      }

      hasUserAdjustedTrimRef.current = true;
      setCopied(false);
      setHasSavedClip(false);
      setTrim(nextTrim);
      setSaveMessage(null);
      const currentPlaybackSeconds = getPlaybackSeconds();
      if (options) {
        seekPreview(options.previewSeconds);
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
      setHasSavedClip,
      setCopied,
      setSaveMessage,
      setTrim,
    ],
  );

  return {
    handleCanPlay,
    handleCanPlayThrough,
    handleEnterFullscreen,
    handleLoadedData,
    handleLoadedMetadata,
    handleLoadStart,
    handlePause,
    handlePlay,
    handleRevealClip,
    handleRetryMedia,
    handleSeeked,
    handleSeeking,
    handleTimeUpdate,
    handleToggleMuted,
    handleTogglePlayback,
    handleTrimChange,
    handleVideoError,
    seekPreview,
    setPlaybackTimeElement,
    setPlayheadElement,
    videoRef,
  };
}

type ClipPreviewOverlayMediaWorkflow = ReturnType<
  typeof useClipPreviewOverlayMediaWorkflow
>;

export type { ClipPreviewOverlayMediaWorkflow };
export { useClipPreviewOverlayMediaWorkflow };
