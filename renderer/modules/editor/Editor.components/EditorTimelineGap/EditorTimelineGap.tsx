import clsx from "clsx";
import { FiTrash2 } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import type { EditorTimelineGap as EditorTimelineGapModel } from "../../Editor.utils/Editor.utils";
import {
  calculateTimelinePercent,
  formatEditorTimestamp,
} from "../../Editor.utils/Editor.utils";
import {
  formatEditorTimelineRailLeft,
  formatEditorTimelineRailWidth,
} from "../EditorTimeline/EditorTimeline.utils";

interface EditorTimelineGapProps {
  gap: EditorTimelineGapModel;
  railPaddingPixels: number;
  visibleDurationSeconds: number;
}

function EditorTimelineGap({
  gap,
  railPaddingPixels,
  visibleDurationSeconds,
}: EditorTimelineGapProps) {
  const {
    areTimelineGapsHighlighted,
    removeTimelineGap,
    setHoveredTimelineGap,
  } = useEditorShallow((editor) => ({
    areTimelineGapsHighlighted: editor.areTimelineGapsHighlighted,
    removeTimelineGap: editor.removeTimelineGap,
    setHoveredTimelineGap: editor.setHoveredTimelineGap,
  }));
  const startPercent = calculateTimelinePercent(
    gap.startSeconds,
    visibleDurationSeconds,
  );
  const endPercent = calculateTimelinePercent(
    gap.endSeconds,
    visibleDurationSeconds,
  );
  const widthPercent = Math.max(endPercent - startPercent, 0);

  const handleRemoveGap = () => {
    setHoveredTimelineGap(null);
    removeTimelineGap({
      endSeconds: gap.endSeconds,
      startSeconds: gap.startSeconds,
    });
  };

  const handlePointerEnter = () => {
    setHoveredTimelineGap(gap);
  };

  const handlePointerLeave = () => {
    setHoveredTimelineGap(null);
  };

  if (widthPercent <= 0) {
    return null;
  }

  return (
    <div
      className={clsx(
        "group absolute top-0 bottom-0 z-10 rounded-sm border bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.14)_0,rgba(255,255,255,0.14)_1px,transparent_1px,transparent_9px)] transition hover:border-base-content/45 hover:bg-base-content/10 hover:opacity-100",
        areTimelineGapsHighlighted
          ? "border-base-content/45 bg-base-content/10 opacity-100"
          : "border-base-content/25 opacity-70",
      )}
      data-timeline-gap-zone="true"
      style={{
        left: formatEditorTimelineRailLeft(startPercent, railPaddingPixels),
        width: formatEditorTimelineRailWidth(widthPercent, railPaddingPixels),
      }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <button
        aria-label={`Delete gap from ${formatEditorTimestamp(
          gap.startSeconds,
        )} to ${formatEditorTimestamp(gap.endSeconds)}`}
        className="-translate-x-1/2 -translate-y-1/2 btn btn-square btn-xs invisible absolute top-1/2 left-1/2 z-30 shadow-lg group-hover:visible"
        data-gap-delete-button="true"
        title="Delete this gap"
        type="button"
        onClick={handleRemoveGap}
      >
        <FiTrash2 size={14} />
      </button>
    </div>
  );
}

export { EditorTimelineGap };
