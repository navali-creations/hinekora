import { useCallback, useEffect, useMemo, useRef } from "react";

import { trackEvent } from "~/renderer/modules/umami";
import { useClipPreviewOverlayShallow } from "~/renderer/store";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { resolveClipPreviewDetail } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
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
    mediaVersion,
    operationProgress,
    setCopied,
    setHasSavedClip,
    setDurationOverrideSeconds,
    setMediaReady,
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
    mediaVersion: clipPreviewOverlay.mediaVersion,
    operationProgress: clipPreviewOverlay.operationProgress,
    setCopied: clipPreviewOverlay.setCopied,
    setHasSavedClip: clipPreviewOverlay.setHasSavedClip,
    setDurationOverrideSeconds: clipPreviewOverlay.setDurationOverrideSeconds,
    setMediaReady: clipPreviewOverlay.setMediaReady,
    setMuted: clipPreviewOverlay.setMuted,
    setSaveMessage: clipPreviewOverlay.setSaveMessage,
    setPlaying: clipPreviewOverlay.setPlaying,
    setTrim: clipPreviewOverlay.setTrim,
    trim: clipPreviewOverlay.trim,
  }));
  const {
    clip,
    clipFileName,
    durationSeconds,
    hasPlayableClipFile,
    mediaUrl: baseVideoSrc,
  } = resolveClipPreviewDetail(detail, durationOverrideSeconds);
  const videoSrc = useMemo(() => {
    if (!baseVideoSrc) {
      return null;
    }

    const separator = baseVideoSrc.includes("?") ? "&" : "?";
    return `${baseVideoSrc}${separator}v=${mediaVersion}`;
  }, [baseVideoSrc, mediaVersion]);
  const isProcessing = isCopying || isSaving;
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
      syncPlaybackPresentation(0);
      setPlaying(false);
      return;
    }

    hasUserAdjustedTrimRef.current = false;
    setMediaReady(false);
    syncPlaybackPresentation(0);
    setPlaying(false);
  }, [setMediaReady, setPlaying, syncPlaybackPresentation, videoSrc]);

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
    canUseClip,
    clipFileName,
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
    handleVideoError,
    isMuted,
    isPlaying,
    isPreparingClip,
    isProcessing,
    operationProgress,
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
