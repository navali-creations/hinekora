import { useCallback, useEffect, useRef } from "react";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import { useClipPreviewOverlayDiagnostics } from "../useClipPreviewOverlayDiagnostics/useClipPreviewOverlayDiagnostics";
import { useClipPreviewOverlayNativeMediaState } from "../useClipPreviewOverlayNativeMediaState/useClipPreviewOverlayNativeMediaState";
import { useClipPreviewOverlayPlayback } from "../useClipPreviewOverlayPlayback/useClipPreviewOverlayPlayback";
import { useClipPreviewOverlayPlaybackPresentation } from "../useClipPreviewOverlayPlaybackPresentation/useClipPreviewOverlayPlaybackPresentation";
import { useClipPreviewOverlayTrimWorkflow } from "../useClipPreviewOverlayTrimWorkflow/useClipPreviewOverlayTrimWorkflow";
import { resolveClipPreviewMediaState } from "./useClipPreviewOverlayMediaWorkflow.utils";

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
    playbackRate,
    setCopied,
    setHasSavedClip,
    setDurationOverrideSeconds,
    setFullscreen,
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
    playbackRate: clipPreviewOverlay.playbackRate,
    setCopied: clipPreviewOverlay.setCopied,
    setHasSavedClip: clipPreviewOverlay.setHasSavedClip,
    setDurationOverrideSeconds: clipPreviewOverlay.setDurationOverrideSeconds,
    setFullscreen: clipPreviewOverlay.setFullscreen,
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
    handleToggleFullscreen,
    handleLoadedData,
    handleLoadedMetadata,
    handleLoadStart,
    handlePause,
    handlePlay,
    handleTimeUpdate,
    handleToggleMuted: handlePlaybackToggleMuted,
    handleTogglePlayback,
    handleVideoKeyDown,
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

  useClipPreviewOverlayNativeMediaState({
    playbackRate,
    setFullscreen,
    videoRef,
    videoSrc,
  });

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
      void window.electron.replayClips.reveal(clip.id);
    }
  }, [clip]);

  const handleRetryMedia = useCallback(() => {
    setMediaError(null);
    incrementMediaVersion();
  }, [incrementMediaVersion, setMediaError]);

  const prepareForFileMutation = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    setMediaReady(false);
    setPlaying(false);
  }, [setMediaReady, setPlaying, videoRef]);

  const reloadAfterFileMutation = useCallback(() => {
    setMediaError(null);
    incrementMediaVersion();
  }, [incrementMediaVersion, setMediaError]);

  const { handleTrimCommit, handleTrimPreview } =
    useClipPreviewOverlayTrimWorkflow({
      getPlaybackSeconds,
      hasUserAdjustedTrimRef,
      isProcessing,
      seekPreview,
      setCopied,
      setHasSavedClip,
      setSaveMessage,
      setTrim,
    });

  return {
    handleCanPlay,
    handleCanPlayThrough,
    handleToggleFullscreen,
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
    handleVideoKeyDown,
    handleTrimCommit,
    handleTrimPreview,
    handleVideoError,
    prepareForFileMutation,
    reloadAfterFileMutation,
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
