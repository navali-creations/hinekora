import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayMediaEvents } from "../useClipPreviewOverlayMediaEvents/useClipPreviewOverlayMediaEvents";
import { useClipPreviewOverlaySeek } from "../useClipPreviewOverlaySeek/useClipPreviewOverlaySeek";
import {
  type ClipPreviewPlaybackPresentationMetrics,
  useClipPreviewOverlayVideoFrames,
} from "../useClipPreviewOverlayVideoFrames/useClipPreviewOverlayVideoFrames";

interface UseClipPreviewOverlayPlaybackInput {
  canUseClip: boolean;
  clipId: string | null;
  durationSeconds: number;
  hasUserAdjustedTrimRef: RefObject<boolean>;
  isMuted: boolean;
  isPlaying: boolean;
  setDurationOverrideSeconds: (durationOverrideSeconds: number | null) => void;
  setMediaReady: (isMediaReady: boolean) => void;
  setMediaError: (mediaError: string | null) => void;
  setMuted: (isMuted: boolean) => void;
  setPlaying: (isPlaying: boolean) => void;
  setTrim: (trim: ClipPreviewTrimRange) => void;
  syncPlaybackPresentation: (seconds?: number) => void;
  trim: ClipPreviewTrimRange;
  updatePlaybackFrame: (seconds: number) => void;
  videoSrc: string | null;
}

function useClipPreviewOverlayPlayback(
  input: UseClipPreviewOverlayPlaybackInput,
) {
  const pendingSeekSecondsRef = useRef<number | null>(null);
  const resumePlaybackAfterSeekRef = useRef(false);
  const videoSrcRef = useRef(input.videoSrc);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoSrcRef.current === input.videoSrc) {
      return;
    }
    videoSrcRef.current = input.videoSrc;
    pendingSeekSecondsRef.current = null;
    resumePlaybackAfterSeekRef.current = false;
  }, [input.videoSrc]);

  const { consumePlaybackPresentationMetrics } =
    useClipPreviewOverlayVideoFrames({
      durationSeconds: input.durationSeconds,
      isPlaying: input.isPlaying,
      pendingSeekSecondsRef,
      setPlaying: input.setPlaying,
      trimOutSeconds: input.trim.outSeconds,
      updatePlaybackFrame: input.updatePlaybackFrame,
      videoRef,
    });
  const { handleSeeked, handleSeeking, seekPreview } =
    useClipPreviewOverlaySeek({
      canUseClip: input.canUseClip,
      durationSeconds: input.durationSeconds,
      pendingSeekSecondsRef,
      resumePlaybackAfterSeekRef,
      setPlaying: input.setPlaying,
      syncPlaybackPresentation: input.syncPlaybackPresentation,
      videoRef,
    });
  const mediaEvents = useClipPreviewOverlayMediaEvents({
    canUseClip: input.canUseClip,
    clipId: input.clipId,
    hasUserAdjustedTrimRef: input.hasUserAdjustedTrimRef,
    isMuted: input.isMuted,
    pendingSeekSecondsRef,
    resumePlaybackAfterSeekRef,
    setDurationOverrideSeconds: input.setDurationOverrideSeconds,
    setMediaError: input.setMediaError,
    setMediaReady: input.setMediaReady,
    setMuted: input.setMuted,
    setPlaying: input.setPlaying,
    setTrim: input.setTrim,
    syncPlaybackPresentation: input.syncPlaybackPresentation,
    trim: input.trim,
    videoRef,
    videoSrc: input.videoSrc,
  });

  return {
    consumePlaybackPresentationMetrics,
    ...mediaEvents,
    handleSeeked,
    handleSeeking,
    seekPreview,
    videoRef,
  };
}

export type { ClipPreviewPlaybackPresentationMetrics };
export { useClipPreviewOverlayPlayback };
