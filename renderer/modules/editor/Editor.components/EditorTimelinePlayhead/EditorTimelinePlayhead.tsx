import { useEditorSelector } from "~/renderer/store";

import {
  calculateTimelinePercent,
  formatEditorTimestamp,
} from "../../Editor.utils/Editor.utils";

interface EditorTimelinePlayheadProps {
  labelColumnWidth: number;
  visibleDurationSeconds: number;
}

function EditorTimelinePlayhead({
  labelColumnWidth,
  visibleDurationSeconds,
}: EditorTimelinePlayheadProps) {
  const playbackSeconds = useEditorSelector((editor) => editor.playbackSeconds);
  const playheadPercent = calculateTimelinePercent(
    playbackSeconds,
    visibleDurationSeconds,
  );

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-40 w-8 -translate-x-1/2"
      style={{
        left: `calc(${labelColumnWidth}px + (100% - ${labelColumnWidth}px) * ${
          playheadPercent / 100
        })`,
      }}
    >
      <button
        aria-label="Drag timeline playhead"
        className="pointer-events-auto absolute top-0 left-1/2 h-16 w-8 -translate-x-1/2 cursor-pointer touch-none"
        data-playhead-handle="true"
        type="button"
      >
        <span className="absolute top-0 left-1/2 flex h-[22px] -translate-x-1/2 items-center rounded-sm bg-base-content px-1.5 font-semibold text-[10px] text-base-300 shadow">
          {formatEditorTimestamp(playbackSeconds)}
        </span>
        <span className="absolute top-[26px] left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-base-content shadow" />
      </button>
      <span className="absolute top-[26px] bottom-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-base-content shadow" />
    </div>
  );
}

export { EditorTimelinePlayhead };
