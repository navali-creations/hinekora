import { useCallback, useEffect, useRef } from "react";

import {
  calculateClipPreviewTimelinePercent,
  formatClipPreviewTimestamp,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

function useClipPreviewOverlayPlaybackPresentation(durationSeconds: number) {
  const durationSecondsRef = useRef(durationSeconds);
  const playbackSecondsRef = useRef(0);
  const playbackTextRef = useRef<string | null>(null);
  const playbackTimeElementRef = useRef<HTMLSpanElement | null>(null);
  const playheadElementRef = useRef<HTMLSpanElement | null>(null);
  const playheadTransformRef = useRef<string | null>(null);

  const updatePlaybackTimer = useCallback((seconds: number) => {
    const nextSeconds = roundClipPreviewSeconds(seconds);
    const currentDurationSeconds = durationSecondsRef.current;
    playbackSecondsRef.current = nextSeconds;

    const nextText = `${formatClipPreviewTimestamp(
      nextSeconds,
    )} / ${formatClipPreviewTimestamp(currentDurationSeconds)}`;
    if (
      playbackTimeElementRef.current &&
      playbackTextRef.current !== nextText
    ) {
      playbackTextRef.current = nextText;
      playbackTimeElementRef.current.textContent = nextText;
    }

    return nextSeconds;
  }, []);

  const updatePlaybackFrame = useCallback(
    (seconds: number) => {
      const nextSeconds = updatePlaybackTimer(seconds);
      const currentDurationSeconds = durationSecondsRef.current;

      if (playheadElementRef.current) {
        const nextTransform = `translate3d(${calculateClipPreviewTimelinePercent(
          nextSeconds,
          currentDurationSeconds,
        )}%, 0, 0)`;
        if (playheadTransformRef.current !== nextTransform) {
          playheadTransformRef.current = nextTransform;
          playheadElementRef.current.style.transform = nextTransform;
        }
      }
    },
    [updatePlaybackTimer],
  );

  const syncPlaybackPresentation = useCallback(
    (seconds?: number) => {
      if (seconds !== undefined) {
        updatePlaybackFrame(seconds);
      }
    },
    [updatePlaybackFrame],
  );

  const getPlaybackSeconds = useCallback(() => playbackSecondsRef.current, []);

  const setPlaybackTimeElement = useCallback(
    (element: HTMLSpanElement | null) => {
      playbackTimeElementRef.current = element;
      updatePlaybackFrame(playbackSecondsRef.current);
    },
    [updatePlaybackFrame],
  );

  const setPlayheadElement = useCallback(
    (element: HTMLSpanElement | null) => {
      playheadElementRef.current = element;
      playheadTransformRef.current = null;
      updatePlaybackFrame(playbackSecondsRef.current);
    },
    [updatePlaybackFrame],
  );

  useEffect(() => {
    durationSecondsRef.current = durationSeconds;
    updatePlaybackFrame(playbackSecondsRef.current);
  }, [durationSeconds, updatePlaybackFrame]);

  return {
    getPlaybackSeconds,
    setPlaybackTimeElement,
    setPlayheadElement,
    syncPlaybackPresentation,
    updatePlaybackFrame,
  };
}

export { useClipPreviewOverlayPlaybackPresentation };
