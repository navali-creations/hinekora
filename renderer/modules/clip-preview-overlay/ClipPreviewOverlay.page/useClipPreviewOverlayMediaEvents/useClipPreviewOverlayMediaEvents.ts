import type { RefObject, SyntheticEvent } from "react";

import { trackEvent } from "~/renderer/modules/umami";

import {
  type ClipPreviewTrimRange,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

function useClipPreviewOverlayMediaEvents(input: {
  canUseClip: boolean;
  clipId: string | null;
  hasUserAdjustedTrimRef: RefObject<boolean>;
  isMuted: boolean;
  pendingSeekSecondsRef: RefObject<number | null>;
  resumePlaybackAfterSeekRef: RefObject<boolean>;
  setDurationOverrideSeconds: (duration: number | null) => void;
  setMediaError: (error: string | null) => void;
  setMediaReady: (ready: boolean) => void;
  setMuted: (muted: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setTrim: (trim: ClipPreviewTrimRange) => void;
  syncPlaybackPresentation: (seconds?: number) => void;
  trim: ClipPreviewTrimRange;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoSrc: string | null;
}) {
  const handleEnterFullscreen = () => {
    const video = input.videoRef.current;
    if (!video || !input.canUseClip) {
      return;
    }
    void video
      .requestFullscreen()
      .then(() => trackEvent("clip-preview-overlay-fullscreen-opened"))
      .catch((error: unknown) => {
        console.warn("[clip-preview] Could not enter fullscreen", { error });
      });
  };

  const handleTogglePlayback = () => {
    const video = input.videoRef.current;
    if (!video || !input.canUseClip) {
      return;
    }
    if (!video.paused) {
      input.resumePlaybackAfterSeekRef.current = false;
      video.pause();
      input.syncPlaybackPresentation(
        input.pendingSeekSecondsRef.current ??
          roundClipPreviewSeconds(video.currentTime),
      );
      input.setPlaying(false);
      return;
    }

    const pendingSeconds = input.pendingSeekSecondsRef.current;
    const shouldStartAtTrimStart =
      video.currentTime < input.trim.inSeconds ||
      video.currentTime >= input.trim.outSeconds;
    const nextStartSeconds =
      pendingSeconds ?? (shouldStartAtTrimStart ? input.trim.inSeconds : null);
    if (nextStartSeconds !== null) {
      input.pendingSeekSecondsRef.current = nextStartSeconds;
      video.currentTime = nextStartSeconds;
      input.syncPlaybackPresentation(nextStartSeconds);
    }
    input.resumePlaybackAfterSeekRef.current = false;
    void video.play().catch((error: unknown) => {
      console.warn("[clip-preview] Could not play preview", { error });
      input.setPlaying(false);
    });
  };

  const handleToggleMuted = () => {
    const nextMuted = !input.isMuted;
    if (input.videoRef.current) {
      input.videoRef.current.muted = nextMuted;
    }
    input.setMuted(nextMuted);
  };

  const handleLoadedMetadata = () => {
    const video = input.videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }
    const nextDurationSeconds = roundClipPreviewSeconds(video.duration);
    input.setDurationOverrideSeconds(nextDurationSeconds);
    if (!input.hasUserAdjustedTrimRef.current) {
      input.setTrim({ inSeconds: 0, outSeconds: nextDurationSeconds });
    }
  };

  const handleLoadStart = () => {
    input.setMediaError(null);
    input.setMediaReady(false);
  };
  const handleLoadedData = () => input.setMediaReady(true);
  const handleCanPlayThrough = () => input.setMediaReady(true);
  const handleCanPlay = () => input.setMediaReady(true);

  const handlePause = () => {
    input.setPlaying(false);
    const video = input.videoRef.current;
    if (video) {
      input.syncPlaybackPresentation(
        input.pendingSeekSecondsRef.current ??
          clampPlaybackToTrim(video.currentTime, input.trim),
      );
    }
  };

  const handlePlay = () => {
    const video = input.videoRef.current;
    const pendingSeconds = input.pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      input.syncPlaybackPresentation(pendingSeconds);
    } else if (video && !video.seeking) {
      input.syncPlaybackPresentation(
        clampPlaybackToTrim(video.currentTime, input.trim),
      );
    }
    input.setPlaying(true);
  };

  const handleTimeUpdate = () => {
    const video = input.videoRef.current;
    if (!video) {
      return;
    }
    const pendingSeconds = input.pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      input.syncPlaybackPresentation(pendingSeconds);
      return;
    }
    if (video.currentTime >= input.trim.outSeconds) {
      input.syncPlaybackPresentation(input.trim.outSeconds);
      video.pause();
      input.setPlaying(false);
      return;
    }
    if (video.paused || typeof video.requestVideoFrameCallback !== "function") {
      input.syncPlaybackPresentation(
        clampPlaybackToTrim(video.currentTime, input.trim),
      );
    }
  };

  const handleVideoError = (event: SyntheticEvent<HTMLVideoElement>) => {
    input.pendingSeekSecondsRef.current = null;
    input.resumePlaybackAfterSeekRef.current = false;
    const mediaError = event.currentTarget.error;
    input.setMediaReady(false);
    input.setPlaying(false);
    input.setMediaError(
      mediaError?.message || "The replay preview could not be loaded.",
    );
    console.warn("[clip-preview] Replay video failed to load", {
      clipId: input.clipId,
      code: mediaError?.code ?? null,
      message: mediaError?.message ?? null,
      src: input.videoSrc,
    });
  };

  return {
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
    handleVideoError,
  };
}

function clampPlaybackToTrim(
  seconds: number,
  trim: ClipPreviewTrimRange,
): number {
  return roundClipPreviewSeconds(
    Math.min(Math.max(seconds, trim.inSeconds), trim.outSeconds),
  );
}

export { useClipPreviewOverlayMediaEvents };
