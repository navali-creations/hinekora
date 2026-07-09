import type { RefObject, SyntheticEvent } from "react";
import { useEffect, useRef } from "react";

import { trackEvent } from "~/renderer/modules/umami";

import {
  type ClipPreviewTrimRange,
  clampClipPreviewPlaybackSeconds,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

interface VideoFrameMetadata {
  mediaTime?: number;
}

type VideoFrameCallback = (now: number, metadata: VideoFrameMetadata) => void;
type RequestVideoFrameCallback = (callback: VideoFrameCallback) => number;
type CancelVideoFrameCallback = (handle: number) => void;

interface StartPlaybackClockInput {
  outSeconds: number;
  playbackRate: number;
  seconds: number;
}

interface SeekPreviewOptions {
  preservePlayback?: boolean;
  previewMedia?: boolean;
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
  startPlaybackClock: (input: StartPlaybackClockInput) => void;
  stopPlaybackClock: (seconds?: number) => void;
  trim: ClipPreviewTrimRange;
  videoSrc: string | null;
}

function seekVideo(
  video: HTMLVideoElement,
  seconds: number,
  options?: { fast?: boolean },
): void {
  const fastSeek = Reflect.get(video, "fastSeek") as
    | ((seconds: number) => void)
    | undefined;
  if (options?.fast === true && typeof fastSeek === "function") {
    fastSeek.call(video, seconds);
    return;
  }

  video.currentTime = seconds;
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
  startPlaybackClock,
  stopPlaybackClock,
  trim,
  videoSrc,
}: UseClipPreviewOverlayPlaybackInput) {
  const mediaPreviewFrameRef = useRef<number | null>(null);
  const mediaPreviewSecondsRef = useRef<number | null>(null);
  const pendingSeekSecondsRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const flushMediaPreviewSeek = () => {
    mediaPreviewFrameRef.current = null;
    const nextSeconds = mediaPreviewSecondsRef.current;
    mediaPreviewSecondsRef.current = null;
    const video = videoRef.current;
    if (
      nextSeconds === null ||
      !video ||
      video.readyState < HTMLMediaElement.HAVE_METADATA
    ) {
      return;
    }

    if (Math.abs(video.currentTime - nextSeconds) < 0.01) {
      return;
    }

    seekVideo(video, nextSeconds, { fast: true });
  };

  const scheduleMediaPreviewSeek = (seconds: number) => {
    mediaPreviewSecondsRef.current = seconds;
    if (mediaPreviewFrameRef.current !== null) {
      return;
    }

    mediaPreviewFrameRef.current = requestAnimationFrame(flushMediaPreviewSeek);
  };

  useEffect(() => {
    if (videoSrc === null) {
      mediaPreviewSecondsRef.current = null;
      pendingSeekSecondsRef.current = null;
      if (mediaPreviewFrameRef.current !== null) {
        cancelAnimationFrame(mediaPreviewFrameRef.current);
        mediaPreviewFrameRef.current = null;
      }
      return;
    }

    mediaPreviewSecondsRef.current = null;
    pendingSeekSecondsRef.current = null;
    if (mediaPreviewFrameRef.current !== null) {
      cancelAnimationFrame(mediaPreviewFrameRef.current);
      mediaPreviewFrameRef.current = null;
    }
  }, [videoSrc]);

  useEffect(
    () => () => {
      if (mediaPreviewFrameRef.current !== null) {
        cancelAnimationFrame(mediaPreviewFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const updatePlaybackTime = (metadata?: VideoFrameMetadata) => {
      if (
        video.seeking ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return true;
      }

      const currentSeconds =
        typeof metadata?.mediaTime === "number"
          ? metadata.mediaTime
          : video.currentTime;
      if (currentSeconds >= trim.outSeconds) {
        video.pause();
        stopPlaybackClock(trim.outSeconds);
        setPlaying(false);
        return false;
      }

      startPlaybackClock({
        outSeconds: trim.outSeconds,
        playbackRate: video.playbackRate,
        seconds: currentSeconds,
      });
      return true;
    };

    const requestVideoFrameCallback = (
      Reflect.get(video, "requestVideoFrameCallback") as
        | RequestVideoFrameCallback
        | undefined
    )?.bind(video);
    const cancelVideoFrameCallback = (
      Reflect.get(video, "cancelVideoFrameCallback") as
        | CancelVideoFrameCallback
        | undefined
    )?.bind(video);

    if (requestVideoFrameCallback && cancelVideoFrameCallback) {
      let callbackId = 0;
      let isActive = true;
      const updateVideoFrame: VideoFrameCallback = (_now, metadata) => {
        if (!isActive) {
          return;
        }

        if (updatePlaybackTime(metadata) && isActive) {
          callbackId = requestVideoFrameCallback(updateVideoFrame);
        }
      };

      callbackId = requestVideoFrameCallback(updateVideoFrame);

      return () => {
        isActive = false;
        cancelVideoFrameCallback(callbackId);
      };
    }

    let frameId = 0;
    let isActive = true;
    const updateTimedFrame = () => {
      if (!isActive) {
        return;
      }

      if (updatePlaybackTime() && isActive) {
        frameId = requestAnimationFrame(updateTimedFrame);
      }
    };

    frameId = requestAnimationFrame(updateTimedFrame);

    return () => {
      isActive = false;
      cancelAnimationFrame(frameId);
    };
  }, [
    isPlaying,
    setPlaying,
    startPlaybackClock,
    stopPlaybackClock,
    trim.outSeconds,
  ]);

  const seekPreview = (seconds: number, options?: SeekPreviewOptions) => {
    const nextSeconds = clampClipPreviewPlaybackSeconds(
      seconds,
      durationSeconds,
    );
    const video = videoRef.current;
    pendingSeekSecondsRef.current = nextSeconds;
    const shouldPreservePlayback =
      options?.preservePlayback === true &&
      Boolean(video && canUseClip && !video.paused);
    if (shouldPreservePlayback && video) {
      seekVideo(video, nextSeconds, { fast: true });
      stopPlaybackClock(nextSeconds);
      return;
    }

    if (video && !video.paused) {
      video.pause();
    }
    stopPlaybackClock(nextSeconds);
    if (options?.previewMedia === true && video && canUseClip) {
      scheduleMediaPreviewSeek(nextSeconds);
    }
    setPlaying(false);
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
      video.pause();
      const pendingSeconds = pendingSeekSecondsRef.current;
      stopPlaybackClock(
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
      pendingSeekSecondsRef.current = null;
      seekVideo(video, nextStartSeconds);
      stopPlaybackClock(nextStartSeconds);
    }
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
      stopPlaybackClock(
        pendingSeconds ?? roundClipPreviewSeconds(video.currentTime),
      );
    }
  };

  const resumePlaybackClockFromVideo = () => {
    const video = videoRef.current;
    if (!video || !isPlaying || video.paused || video.seeking) {
      return;
    }

    startPlaybackClock({
      outSeconds: trim.outSeconds,
      playbackRate: video.playbackRate,
      seconds: video.currentTime,
    });
  };

  const handlePlay = () => {
    const video = videoRef.current;
    if (video && !video.seeking) {
      startPlaybackClock({
        outSeconds: trim.outSeconds,
        playbackRate: video.playbackRate,
        seconds: video.currentTime,
      });
    }
    setPlaying(true);
  };

  const handleSeeking = () => {
    const video = videoRef.current;
    if (video) {
      const pendingSeconds = pendingSeekSecondsRef.current;
      stopPlaybackClock(
        pendingSeconds ?? roundClipPreviewSeconds(video.currentTime),
      );
    }
  };

  const handleSeeked = () => {
    const pendingSeconds = pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      stopPlaybackClock(pendingSeconds);
      pendingSeekSecondsRef.current = null;
    }
    resumePlaybackClockFromVideo();
  };

  const handleWaiting = () => {
    const video = videoRef.current;
    if (video) {
      stopPlaybackClock(roundClipPreviewSeconds(video.currentTime));
    }
  };

  const handleCanPlay = () => {
    setMediaReady(true);
    resumePlaybackClockFromVideo();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!isPlaying) {
      const pendingSeconds = pendingSeekSecondsRef.current;
      if (pendingSeconds !== null) {
        stopPlaybackClock(pendingSeconds);
        return;
      }

      const clampedSeconds = roundClipPreviewSeconds(
        Math.min(Math.max(video.currentTime, trim.inSeconds), trim.outSeconds),
      );
      stopPlaybackClock(clampedSeconds);
    }
  };

  const handleVideoError = (event: SyntheticEvent<HTMLVideoElement>) => {
    const mediaError = event.currentTarget.error;
    console.warn("[clip-preview] Replay video failed to load", {
      clipId,
      code: mediaError?.code ?? null,
      message: mediaError?.message ?? null,
      src: videoSrc,
    });
  };

  return {
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
    handleWaiting,
    handleVideoError,
    seekPreview,
    videoRef,
  };
}

export { useClipPreviewOverlayPlayback };
