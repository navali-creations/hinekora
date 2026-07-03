import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import type { MouseEvent, PointerEvent } from "react";
import { FiPlay } from "react-icons/fi";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import {
  bookmarkCategoryLabels,
  bookmarkCategoryTimelineClassNames,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";

import {
  calculateRecordingTimelinePercent,
  formatRecordingTimelineRailLeft,
  formatRecordingTimelineTimestamp,
} from "../RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

interface RecordingBookmarkTimelineMarkerProps {
  bookmark: RecordingBookmark;
  clipTargetId?: string;
  durationSeconds: number;
  onClipTargetSelect?: (clipId: string) => void;
}

function RecordingBookmarkTimelineMarker({
  bookmark,
  clipTargetId,
  durationSeconds,
  onClipTargetSelect,
}: RecordingBookmarkTimelineMarkerProps) {
  const left = calculateRecordingTimelinePercent(
    bookmark.offsetSeconds,
    durationSeconds,
  );
  const colorClassName = bookmarkCategoryTimelineClassNames[bookmark.category];
  const title = `${bookmarkCategoryLabels[bookmark.category]} - ${
    bookmark.label
  } at ${formatRecordingTimelineTimestamp(bookmark.offsetSeconds)}`;
  const markerClassName = clsx(
    "rounded-full border border-base-content/30 p-0 shadow-sm ring-2 ring-base-300",
    clipTargetId
      ? "mt-3.5 grid h-4 w-4 cursor-pointer appearance-none place-items-center text-base-100 transition hover:scale-110 hover:ring-primary"
      : "mt-4 h-3 w-3",
    colorClassName,
  );

  const handleClipPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const handleClipClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!clipTargetId || !onClipTargetSelect) {
      return;
    }

    onClipTargetSelect(clipTargetId);
  };

  return (
    <span
      className="group absolute top-0 bottom-0 z-20 flex -translate-x-1/2 flex-col items-center"
      style={{ left: formatRecordingTimelineRailLeft(left) }}
      title={title}
    >
      {clipTargetId && onClipTargetSelect ? (
        <button
          aria-label={`Preview ${bookmarkCategoryLabels[bookmark.category]} clip`}
          className={markerClassName}
          type="button"
          onClick={handleClipClick}
          onPointerDown={handleClipPointerDown}
        >
          <FiPlay aria-hidden="true" size={9} />
        </button>
      ) : clipTargetId ? (
        <Link
          aria-label={`Open ${bookmarkCategoryLabels[bookmark.category]} clip`}
          className={markerClassName}
          params={{ clipId: clipTargetId }}
          to="/clip/$clipId"
          onClick={handleClipClick}
          onPointerDown={handleClipPointerDown}
        >
          <FiPlay aria-hidden="true" size={9} />
        </Link>
      ) : (
        <span className={markerClassName} />
      )}
      <span
        className={clsx("min-h-0 flex-1 w-px rounded-full", colorClassName)}
      />
    </span>
  );
}

export { RecordingBookmarkTimelineMarker };
