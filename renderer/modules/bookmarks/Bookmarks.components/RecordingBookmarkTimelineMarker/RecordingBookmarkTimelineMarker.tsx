import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import type { MouseEvent, PointerEvent } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { BookmarkCategoryIcon } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarkCategoryIcon/BookmarkCategoryIcon";
import {
  bookmarkCategoryLabels,
  bookmarkCategoryTimelineLineClassNames,
  bookmarkCategoryTimelineThumbClassNames,
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
  const thumbClassName =
    bookmarkCategoryTimelineThumbClassNames[bookmark.category];
  const lineClassName =
    bookmarkCategoryTimelineLineClassNames[bookmark.category];
  const title = `${bookmarkCategoryLabels[bookmark.category]} - ${
    bookmark.label
  } at ${formatRecordingTimelineTimestamp(bookmark.offsetSeconds)}`;
  const markerClassName = clsx(
    "grid h-4 w-4 place-items-center rounded-full border border-base-content/30 p-0 shadow-sm ring-2 ring-base-300",
    clipTargetId
      ? "pointer-events-auto mt-3.5 cursor-pointer appearance-none transition hover:scale-110 hover:ring-primary"
      : "mt-3.5",
    thumbClassName,
  );
  const iconElement = (
    <BookmarkCategoryIcon
      category={bookmark.category}
      className="h-3 w-3"
      colorClassName="text-primary"
      isDecorative
      size={10}
    />
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
      className="group pointer-events-none absolute top-0 bottom-0 z-[35] flex -translate-x-1/2 flex-col items-center"
      data-recording-bookmark-marker-id={bookmark.id}
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
          {iconElement}
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
          {iconElement}
        </Link>
      ) : (
        <span className={markerClassName}>{iconElement}</span>
      )}
      <span
        className={clsx("min-h-0 flex-1 w-px rounded-full", lineClassName)}
      />
    </span>
  );
}

export { RecordingBookmarkTimelineMarker };
