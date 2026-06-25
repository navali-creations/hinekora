import { useCallback, useEffect, useRef } from "react";

import { useEditorSelector } from "~/renderer/store";

import {
  calculateTimelinePercent,
  subscribeEditorPlaybackVisualTime,
} from "../../Editor.utils/Editor.utils";
import { formatEditorTimelineRailLeft } from "../EditorTimeline/EditorTimeline.utils";

interface EditorTimelinePlayheadProps {
  railPaddingPixels: number;
  visibleDurationSeconds: number;
}

function EditorTimelinePlayhead({
  railPaddingPixels,
  visibleDurationSeconds,
}: EditorTimelinePlayheadProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const playbackSeconds = useEditorSelector((editor) => editor.playbackSeconds);
  const formatPlayheadLeft = useCallback(
    (seconds: number) => {
      const playheadPercent = calculateTimelinePercent(
        seconds,
        visibleDurationSeconds,
      );

      return formatEditorTimelineRailLeft(playheadPercent, railPaddingPixels);
    },
    [railPaddingPixels, visibleDurationSeconds],
  );
  const applyVisualPlaybackSeconds = useCallback(
    (seconds: number) => {
      if (playheadRef.current) {
        playheadRef.current.style.left = formatPlayheadLeft(seconds);
      }
    },
    [formatPlayheadLeft],
  );

  useEffect(
    () => subscribeEditorPlaybackVisualTime(applyVisualPlaybackSeconds),
    [applyVisualPlaybackSeconds],
  );

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-40 w-8 -translate-x-1/2"
      ref={playheadRef}
      style={{
        left: formatPlayheadLeft(playbackSeconds),
      }}
    >
      <button
        aria-label="Drag timeline playhead"
        className="pointer-events-auto absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 cursor-ew-resize touch-none"
        data-playhead-handle="true"
        type="button"
      >
        <span className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-base-content shadow" />
        <span className="absolute top-0 left-1/2 h-5 w-4 -translate-x-1/2 rounded-full bg-base-content shadow ring-2 ring-base-300" />
      </button>
    </div>
  );
}

export { EditorTimelinePlayhead };
