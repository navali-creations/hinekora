import { useState } from "react";
import { FiClock, FiX } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import { editorVisibleHistoryPageSize } from "../../Editor.slice/Editor.slice.constants";
import { formatEditorTime } from "../../Editor.utils/Editor.utils";
import { EditorHistoryActions } from "../EditorHistoryActions/EditorHistoryActions";

interface EditorHistoryRailProps {
  onClose: () => void;
}

function EditorHistoryRail({ onClose }: EditorHistoryRailProps) {
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(
    editorVisibleHistoryPageSize,
  );
  const { historyPast, historyPastLabels } = useEditorShallow((editor) => ({
    historyPast: editor.historyPast,
    historyPastLabels: editor.historyPastLabels,
  }));
  const historyEntries = historyPast
    .map((project, index) => ({
      actionLabel: historyPastLabels[index] ?? "Edit",
      clipCount: project.tracks.reduce(
        (count, track) => count + track.clips.length,
        0,
      ),
      durationSeconds: project.durationSeconds,
      id: project.id,
      index: index + 1,
    }))
    .reverse();
  const visibleHistoryEntries = historyEntries.slice(0, visibleHistoryCount);
  const hasMoreHistory = visibleHistoryEntries.length < historyEntries.length;

  const handleLoadMoreHistory = () => {
    setVisibleHistoryCount(
      (currentCount) => currentCount + editorVisibleHistoryPageSize,
    );
  };

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200">
      <div className="flex items-center gap-2 border-base-content/10 border-b p-3">
        <span className="rounded bg-base-300 p-1.5 text-primary">
          <FiClock size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-semibold text-sm">History</h2>
          <p className="m-0 text-base-content/55 text-xs">
            {historyPast.length} changes
          </p>
        </div>
        <div
          className="tooltip tooltip-left no-drag"
          data-tip="Close history panel"
        >
          <button
            aria-label="Close history panel"
            className="btn btn-ghost btn-xs"
            type="button"
            onClick={onClose}
          >
            <FiX size={15} />
          </button>
        </div>
      </div>

      <div className="border-base-content/10 border-b p-3">
        <EditorHistoryActions />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {visibleHistoryEntries.map((entry) => (
          <div
            className="relative overflow-hidden rounded-lg border border-base-content/10 bg-base-300/55 p-2"
            key={`${entry.id}-${entry.index}`}
          >
            <span className="pointer-events-none absolute right-2 bottom-0 z-0 font-bold text-[38px] text-base-content/10 leading-none tabular-nums">
              #{entry.index}
            </span>
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-sm">
                {entry.actionLabel}
              </span>
              <span className="shrink-0 text-[11px] text-base-content/45 tabular-nums">
                {formatEditorTime(entry.durationSeconds)}
              </span>
            </div>
            <p className="relative z-10 m-0 mt-1 text-[11px] text-base-content/45">
              {entry.clipCount} clips
            </p>
          </div>
        ))}

        {hasMoreHistory && (
          <button
            className="btn btn-ghost btn-xs w-full cursor-pointer"
            type="button"
            onClick={handleLoadMoreHistory}
          >
            Load more
          </button>
        )}

        {historyEntries.length === 0 && (
          <div className="rounded-lg border border-base-content/10 border-dashed p-4 text-center text-base-content/55 text-sm">
            No history yet.
          </div>
        )}
      </div>
    </aside>
  );
}

export { EditorHistoryRail };
