import type { RefObject } from "react";

import {
  clampClipPreviewPlaybackSeconds,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

interface SeekPreviewOptions {
  preservePlayback?: boolean;
}

function useClipPreviewOverlaySeek(input: {
  activeSeekSecondsRef: RefObject<number | null>;
  canUseClip: boolean;
  durationSeconds: number;
  pendingSeekSecondsRef: RefObject<number | null>;
  resumePlaybackAfterSeekRef: RefObject<boolean>;
  setPlaying: (isPlaying: boolean) => void;
  syncPlaybackPresentation: (seconds?: number) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const startPendingSeek = (video: HTMLVideoElement): boolean => {
    const pendingSeconds = input.pendingSeekSecondsRef.current;
    if (pendingSeconds === null) {
      return false;
    }
    if (input.activeSeekSecondsRef.current !== null) {
      return true;
    }

    if (Math.abs(video.currentTime - pendingSeconds) < 0.01) {
      clearPendingSeek(input.pendingSeekSecondsRef, pendingSeconds);
      return false;
    }

    input.activeSeekSecondsRef.current = pendingSeconds;
    video.currentTime = pendingSeconds;
    return true;
  };

  const resumePlayback = (video: HTMLVideoElement | null): void => {
    if (!input.resumePlaybackAfterSeekRef.current || !video) {
      return;
    }

    input.resumePlaybackAfterSeekRef.current = false;
    void video.play().catch((error: unknown) => {
      console.warn("[clip-preview] Could not resume preview", { error });
      input.setPlaying(false);
    });
  };

  const seekPreview = (seconds: number, options?: SeekPreviewOptions) => {
    const nextSeconds = clampClipPreviewPlaybackSeconds(
      seconds,
      input.durationSeconds,
    );
    const video = input.videoRef.current;
    input.pendingSeekSecondsRef.current = nextSeconds;
    const shouldResumePlayback =
      options?.preservePlayback === true &&
      Boolean(
        video &&
          input.canUseClip &&
          (input.resumePlaybackAfterSeekRef.current || !video.paused),
      );
    input.resumePlaybackAfterSeekRef.current = shouldResumePlayback;

    if (video && !video.paused) {
      video.pause();
    }
    input.setPlaying(false);
    input.syncPlaybackPresentation(nextSeconds);
    if (
      video &&
      input.canUseClip &&
      video.readyState >= HTMLMediaElement.HAVE_METADATA
    ) {
      if (!startPendingSeek(video)) {
        resumePlayback(video);
      }
    } else {
      clearPendingSeek(input.pendingSeekSecondsRef, nextSeconds);
      resumePlayback(video);
    }
  };

  const handleSeeking = () => {
    const pendingSeconds = input.pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      input.syncPlaybackPresentation(pendingSeconds);
    }
  };

  const handleSeeked = () => {
    const video = input.videoRef.current;
    input.activeSeekSecondsRef.current = null;
    const pendingSeconds = input.pendingSeekSecondsRef.current;
    if (pendingSeconds !== null) {
      input.syncPlaybackPresentation(pendingSeconds);
      if (!video) {
        input.pendingSeekSecondsRef.current = null;
        input.resumePlaybackAfterSeekRef.current = false;
      } else if (Math.abs(video.currentTime - pendingSeconds) >= 0.1) {
        startPendingSeek(video);
        return;
      } else {
        input.pendingSeekSecondsRef.current = null;
        resumePlayback(video);
      }
    } else if (video) {
      input.syncPlaybackPresentation(
        roundClipPreviewSeconds(video.currentTime),
      );
    }
  };

  return { handleSeeked, handleSeeking, seekPreview };
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

export { useClipPreviewOverlaySeek };
