import { useCallback, useEffect, useRef } from "react";

import {
  calculateClipPreviewTimelinePercent,
  formatClipPreviewTimestamp,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

interface StartPlaybackClockInput {
  outSeconds: number;
  playbackRate: number;
  seconds: number;
}

function useClipPreviewOverlayPlaybackPresentation(durationSeconds: number) {
  const durationSecondsRef = useRef(durationSeconds);
  const playbackSecondsRef = useRef(0);
  const playbackTextRef = useRef<string | null>(null);
  const playbackTimeElementRef = useRef<HTMLSpanElement | null>(null);
  const playheadElementRef = useRef<HTMLSpanElement | null>(null);

  const updatePlaybackPresentation = useCallback((seconds: number) => {
    const nextSeconds = roundClipPreviewSeconds(seconds);
    const currentDurationSeconds = durationSecondsRef.current;
    playbackSecondsRef.current = nextSeconds;

    if (playheadElementRef.current) {
      playheadElementRef.current.style.transform = `translate3d(${calculateClipPreviewTimelinePercent(
        nextSeconds,
        currentDurationSeconds,
      )}%, 0, 0)`;
    }

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
  }, []);

  const stopPlaybackClock = useCallback(
    (seconds?: number) => {
      if (seconds !== undefined) {
        updatePlaybackPresentation(seconds);
      }
    },
    [updatePlaybackPresentation],
  );

  const startPlaybackClock = useCallback(
    ({ seconds }: StartPlaybackClockInput) => {
      updatePlaybackPresentation(seconds);
    },
    [updatePlaybackPresentation],
  );

  const getPlaybackSeconds = useCallback(() => playbackSecondsRef.current, []);

  const setPlaybackTimeElement = useCallback(
    (element: HTMLSpanElement | null) => {
      playbackTimeElementRef.current = element;
      updatePlaybackPresentation(playbackSecondsRef.current);
    },
    [updatePlaybackPresentation],
  );

  const setPlayheadElement = useCallback(
    (element: HTMLSpanElement | null) => {
      playheadElementRef.current = element;
      updatePlaybackPresentation(playbackSecondsRef.current);
    },
    [updatePlaybackPresentation],
  );

  useEffect(() => {
    durationSecondsRef.current = durationSeconds;
    updatePlaybackPresentation(playbackSecondsRef.current);
  }, [durationSeconds, updatePlaybackPresentation]);

  return {
    getPlaybackSeconds,
    playbackSeconds: playbackSecondsRef.current,
    setPlaybackTimeElement,
    setPlayheadElement,
    startPlaybackClock,
    stopPlaybackClock,
  };
}

export { useClipPreviewOverlayPlaybackPresentation };
