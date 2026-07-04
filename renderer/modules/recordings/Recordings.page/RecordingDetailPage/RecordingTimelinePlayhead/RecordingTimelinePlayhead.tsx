import { useCallback, useEffect, useRef } from "react";

import {
  calculateRecordingTimelinePercent,
  formatRecordingTimelineRailLeft,
} from "../RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

type RecordingVisualPlaybackSubscriber = (
  listener: (seconds: number) => void,
) => () => void;

interface RecordingTimelinePlayheadProps {
  durationSeconds: number;
  enableVisualPlaybackSubscription?: boolean;
  playbackSeconds: number;
  subscribeVisualPlaybackTime?: RecordingVisualPlaybackSubscriber;
  visualPlaybackOffsetSeconds?: number;
}

function RecordingTimelinePlayhead({
  durationSeconds,
  enableVisualPlaybackSubscription = true,
  playbackSeconds,
  subscribeVisualPlaybackTime,
  visualPlaybackOffsetSeconds = 0,
}: RecordingTimelinePlayheadProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const formatPlayheadLeft = useCallback(
    (seconds: number) => {
      const playheadPercent = calculateRecordingTimelinePercent(
        seconds,
        durationSeconds,
      );

      return formatRecordingTimelineRailLeft(playheadPercent);
    },
    [durationSeconds],
  );

  useEffect(() => {
    if (playheadRef.current) {
      playheadRef.current.style.left = formatPlayheadLeft(playbackSeconds);
    }
  }, [formatPlayheadLeft, playbackSeconds]);

  const applyVisualPlaybackSeconds = useCallback(
    (seconds: number) => {
      if (playheadRef.current) {
        playheadRef.current.style.left = formatPlayheadLeft(
          seconds + visualPlaybackOffsetSeconds,
        );
      }
    },
    [formatPlayheadLeft, visualPlaybackOffsetSeconds],
  );

  useEffect(() => {
    if (!enableVisualPlaybackSubscription || !subscribeVisualPlaybackTime) {
      return;
    }

    return subscribeVisualPlaybackTime(applyVisualPlaybackSeconds);
  }, [
    applyVisualPlaybackSeconds,
    enableVisualPlaybackSubscription,
    subscribeVisualPlaybackTime,
  ]);

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-40 w-8 -translate-x-1/2"
      ref={playheadRef}
      style={{
        left: formatPlayheadLeft(playbackSeconds),
      }}
    >
      <span className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-base-content shadow" />
      <span className="absolute top-0 left-1/2 h-5 w-4 -translate-x-1/2 rounded-full bg-base-content shadow ring-2 ring-base-300" />
    </div>
  );
}

export type { RecordingVisualPlaybackSubscriber };
export { RecordingTimelinePlayhead };
