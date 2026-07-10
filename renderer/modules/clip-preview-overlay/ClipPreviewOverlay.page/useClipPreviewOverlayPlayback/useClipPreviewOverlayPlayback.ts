import type { RefObject, SyntheticEvent } from "react";
import { useCallback, useEffect, useRef } from "react";

import { trackEvent } from "~/renderer/modules/umami";

import {
  type ClipPreviewTrimRange,
  clampClipPreviewPlaybackSeconds,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

interface SeekPreviewOptions {
  preservePlayback?: boolean;
}

interface ClipPreviewPlaybackPresentationMetrics {
  frameCallbacks: number;
  maxFrameCallbackGapMs: number;
  presentationUpdates: number;
}

interface ClipPreviewPlaybackPresentationMetricsState
  extends ClipPreviewPlaybackPresentationMetrics {
  lastFrameCallbackTimeMs: number | null;
}

interface UseClipPreviewOverlayPlaybackInput {
  canUseClip: boolean;
  clipId: string | null;
  durationSeconds: number;
  hasUserAdjustedTrimRef: RefObject<boolean>;
  isMuted: boolean;
  isPlaying: boolean;
  setDurationOverrideSeconds: (durationOverrideSeconds: number | null) => void;
  setMediaReady: (isMediaReady: boolean) => void;
  setMuted: (isMuted: boolean) => void;
  setPlaying: (isPlaying: boolean) => void;
  setTrim: (trim: ClipPreviewTrimRange) => void;
  syncPlaybackPresentation: (seconds?: number) => void;
  trim: ClipPreviewTrimRange;
  updatePlaybackFrame: (seconds: number) => void;
  videoSrc: string | null;
}

function seekVideo(video: HTMLVideoElement, seconds: number): void {
  video.currentTime = seconds;
}

function clearPendingSeek(
  pendingSeekSecondsRef: RefObject<number | null>,
  seconds: number,
): void {
  if (
    pendingSeekSecondsRef.current !== null &&
    Math.abs(pendingSeekSecondsRef.current - seconds) < 0.01
  ) {
    pendingSeekSecondsRef.current = null;
  }
}

function useClipPreviewOverlayPlayback({
  canUseClip,
  clipId,
  durationSeconds,
  hasUserAdjustedTrimRef,
  isMuted,
  isPlaying,
  setDurationOverrideSeconds,
  setMediaReady,
  setMuted,
  setPlaying,
  setTrim,
  syncPlaybackPresentation,
  trim,
  updatePlaybackFrame,
  videoSrc,
}: UseClipPreviewOverlayPlaybackInput) {
  const pendingSeekSecondsRef = useRef<number | null>(null);
  const resumePlaybackAfterSeekRef = useRef(false);
  const videoSrcRef = useRef(videoSrc);
  const presentationMetricsRef =
    useRef<ClipPreviewPlaybackPresentationMetricsState>({
      frameCallbacks: 0,
      lastFrameCallbackTimeMs: null,
      maxFrameCallbackGapMs: 0,
      presentationUpdates: 0,
    });
  const videoRef = useRef<HTMLVideoElement>(null);

  const consumePlaybackPresentationMetrics = useCallback(() => {
    const metrics = presentationMetricsRef.current;
    const snapshot: ClipPreviewPlaybackPresentationMetrics = {
      frameCallbacks: metrics.frameCallbacks,
      maxFrameCallbackGapMs: metrics.maxFrameCallbackGapMs,
      presentationUpdates: metrics.presentationUpdates,
    };
    metrics.frameCallbacks = 0;
    metrics.maxFrameCallbackGapMs = 0;
    metrics.presentationUpdates = 0;

    return snapshot;
  }, []);

  useEffect(() => {
    if (videoSrcRef.current === videoSrc) {
      return;
    }

    videoSrcRef.current = videoSrc;
    pendingSeekSecondsRef.current = null;
    resumePlaybackAfterSeekRef.current = false;
  }, [videoSrc]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const video = videoRef.current;
    if (!video || typeof video.requestVideoFrameCallback !== "function") {
      return;
    }

    let videoFrameCallbackId: number | null = null;
    presentationMetricsRef.current.lastFrameCallbackTimeMs = null;
    const renderPresentedFrame: VideoFrameRequestCallback = (
      timeMs,
      metadata,
    ) => {
      if (video.paused || video.ended) {
        videoFrameCallbackId = null;
        return;
      }

      const metrics = presentationMetricsRef.current;
      metrics.frameCallbacks += 1;
      if (metrics.lastFrameCallbackTimeMs !== null) {
        metrics.maxFrameCallbackGapMs = Math.max(
          metrics.maxFrameCallbackGapMs,
          timeMs - metrics.lastFrameCallbackTimeMs,
        );
      }
      metrics.lastFrameCallbackTimeMs = timeMs;
      metrics.presentationUpdates += 1;
      const pendingSeekSeconds = pendingSeekSecondsRef.current;
      if (pendingSeekSeconds !== null) {
        if (!video.seeking) {
          pendingSeekSecondsRef.current = null;
          updatePlaybackFrame(
            clampClipPreviewPlaybackSeconds(
              metadata.mediaTime,
              durationSeconds,
            ),
          );
        } else {
          updatePlaybackFrame(pendingSeekSeconds);
        }
      } else if (!video.seeking) {
        const presentedSeconds = clampClipPreviewPlaybackSeconds(
          metadata.mediaTime,
          durationSeconds,
        );
        if (presentedSeconds >= trim.outSeconds) {
          updatePlaybackFrame(trim.outSeconds);
          video.pause();
          setPlaying(false);
          videoFrameCallbackId = null;
          return;
        }

        updatePlaybackFrame(presentedSeconds);
      }
      videoFrameCallbackId =
        video.requestVideoFrameCallback(renderPresentedFrame);
    };

    videoFrameCallbackId =
      video.requestVideoFrameCallback(renderPresentedFrame);

    return () => {
      presentationMetricsRef.current.lastFrameCallbackTimeMs = null;
      if (videoFrameCallbackId !== null) {
        video.cancelVideoFrameCallback(videoFrameCallbackId);
      }
    };
  }, [
    durationSeconds,
    isPlaying,
    setPlaying,
    trim.outSeconds,
    updatePlaybackFrame,
  ]);

  const seekPreview = (seconds: number, options?: SeekPreviewOptions) => {
    const nextSeconds = clampClipPreviewPlaybackSeconds(
      seconds,
      durationSeconds,
    );
    const video = videoRef.current;
    pendingSeekSecondsRef.current = nextSeconds;
    const shouldResumePlayback =
      options?.preservePlayback === true &&
      Boolean(
        video &&
          canUseClip &&
          (resumePlaybackAfterSeekRef.current || !video.paused),
      );
    resumePlaybackAfterSeekRef.current = shouldResumePlayback;

    if (video && !video.paused) {
      video.pause();
    }
    setPlaying(false);
    syncPlaybackPresentation(nextSeconds);
    const resumeImmediately = () => {
      if (!resumePlaybackAfterSeekRef.current || !video) {
        return;
      }

      resumePlaybackAfterSeekRef.current = false;
      void video.play().catch((error: unknown) => {
        console.warn("[clip-preview] Could not resume preview", { error });
        setPlaying(false);
      });
    };
    if (
      video &&
      canUseClip &&
      video.readyState >= HTMLMediaElement.HAVE_METADATA
    ) {
      if (Math.abs(video.currentTime - nextSeconds) < 0.01) {
        clearPendingSeek(pendingSeekSecondsRef, nextSeconds);
        resumeImmediately();
      } else {
        seekVideo(video, nextSeconds);
      }
    } else {
      clearPendingSeek(pendingSeekSecondsRef, nextSeconds);
      resumeImmediately();
    }
  };

  const handleEnterFullscreen = () => {
    const video = videoRef.current;
    if (!video || !canUseClip) {
      return;
    }

    void video
      .requestFullscreen()
      .then(() => {
        trackEvent("clip-preview-overlay-fullscreen-opened");
      })
      .catch((error: unknown) => {
        console.warn("[clip-preview] Could not enter fullscreen", { error });
      });
  };

  const handleTogglePlayback = () => {
    const video = videoRef.current;
    if (!video || !canUseClip) {
      return;
    }

    if (!video.paused) {
      resumePlaybackAfterSeekRef.current = false;
      video.pause();
      const pendingSeconds = pendingSeekSecondsRef.current;
      syncPlaybackPresentation(
        pendingSeconds ?? roundClipPreviewSeconds(video.currentTime),
      );
      setPlaying(false);
      return;
    }

    const pendingSeconds = pendingSeekSecondsRef.current;
    const shouldStartAtTrimStart =
      video.currentTime < trim.inSeconds ||
      video.currentTime >= trim.outSeconds;
    const nextStartSeconds =
      pendingSeconds ?? (shouldStartAtTrimStart ? trim.inSeconds : null);
    if (nextStartSeconds !== null) {
      pendingSeekSecondsRef.current = nextStartSeconds;
      seekVideo(video, nextStartSeconds);
      syncPlaybackPresentation(nextStartSeconds);
    }
    resumePlaybackAfterSeekRef.current = false;
    void video.play().catch((error: unknown) => {
      console.warn("[clip-preview] Could not play preview", { error });
      setPlaying(false);
    });
  };

  const handleToggleMuted = () => {
    const nextMuted = !isMuted;
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    setMuted(nextMuted);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }

    const nextDurationSeconds = roundClipPreviewSeconds(video.duration);
    setDurationOverrideSeconds(nextDurationSeconds);
    if (!hasUserAdjustedTrimRef.current) {
      setTrim({ inSeconds: 0, outSeconds: nextDurationSeconds });
    }
  };

  const handleLoadStart = () => {
    setMediaReady(false);
  };

  const handleLoadedData = () => {
    setMediaReady(true);
  };

  const handleCanPlayThrough = () => {
    setMediaReady(true);
  };

  const handlePause = () => {
    setPlaying(false);
    const video = videoRef.current;
    if (video) {
      const pendingSeconds = pendingSeekSecondsRef.current;
      syncPlaybackPresentation(
        pendingSeconds ??
          roundClipPreviewSeconds(
            Math.min(
              Math.max(video.currentTime, trim.inSeconds),
              trim.outSeconds,
            ),
          ),
      );
    }
  };

  const handlePlay = () => {
    const video = videoRef.current;
    const pendingSeconds = pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      syncPlaybackPresentation(pendingSeconds);
    } else if (video && !video.seeking) {
      syncPlaybackPresentation(
        roundClipPreviewSeconds(
          Math.min(
            Math.max(video.currentTime, trim.inSeconds),
            trim.outSeconds,
          ),
        ),
      );
    }
    setPlaying(true);
  };

  const handleSeeking = () => {
    const pendingSeconds = pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      syncPlaybackPresentation(pendingSeconds);
    }
  };

  const handleSeeked = () => {
    const video = videoRef.current;
    const pendingSeconds = pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      syncPlaybackPresentation(pendingSeconds);
      if (!video) {
        pendingSeekSecondsRef.current = null;
        resumePlaybackAfterSeekRef.current = false;
      } else if (resumePlaybackAfterSeekRef.current) {
        resumePlaybackAfterSeekRef.current = false;
        void video.play().catch((error: unknown) => {
          pendingSeekSecondsRef.current = null;
          console.warn("[clip-preview] Could not resume preview", { error });
          setPlaying(false);
        });
      } else if (Math.abs(video.currentTime - pendingSeconds) < 0.1) {
        pendingSeekSecondsRef.current = null;
      }
    } else if (video) {
      syncPlaybackPresentation(roundClipPreviewSeconds(video.currentTime));
    }
  };

  const handleCanPlay = () => {
    setMediaReady(true);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const pendingSeconds = pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      syncPlaybackPresentation(pendingSeconds);
      return;
    }

    const clampedSeconds = roundClipPreviewSeconds(
      Math.min(Math.max(video.currentTime, trim.inSeconds), trim.outSeconds),
    );
    if (video.currentTime >= trim.outSeconds) {
      syncPlaybackPresentation(trim.outSeconds);
      video.pause();
      setPlaying(false);
      return;
    }
    if (video.paused || typeof video.requestVideoFrameCallback !== "function") {
      syncPlaybackPresentation(clampedSeconds);
    }
  };

  const handleVideoError = (event: SyntheticEvent<HTMLVideoElement>) => {
    pendingSeekSecondsRef.current = null;
    resumePlaybackAfterSeekRef.current = false;
    const mediaError = event.currentTarget.error;
    console.warn("[clip-preview] Replay video failed to load", {
      clipId,
      code: mediaError?.code ?? null,
      message: mediaError?.message ?? null,
      src: videoSrc,
    });
  };

  return {
    consumePlaybackPresentationMetrics,
    handleEnterFullscreen,
    handleCanPlay,
    handleCanPlayThrough,
    handleLoadedData,
    handleLoadedMetadata,
    handleLoadStart,
    handlePause,
    handlePlay,
    handleSeeked,
    handleSeeking,
    handleTimeUpdate,
    handleToggleMuted,
    handleTogglePlayback,
    handleVideoError,
    seekPreview,
    videoRef,
  };
}

export type { ClipPreviewPlaybackPresentationMetrics };
export { useClipPreviewOverlayPlayback };
