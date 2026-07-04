import clsx from "clsx";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { BookmarkCategoryIcon } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarkCategoryIcon/BookmarkCategoryIcon";
import { bookmarkCategoryPanelItemClassNames } from "~/renderer/modules/bookmarks/Bookmarks.utils";
import { formatDateTime } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import { formatRecordingTimelineTimestamp } from "../RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

interface RecordingBookmarksPanelItemProps {
  bookmark: RecordingBookmark;
  onHover?: (bookmark: RecordingBookmark | null) => void;
  onSelect: (bookmark: RecordingBookmark) => void;
}

function RecordingBookmarksPanelItem({
  bookmark,
  onHover,
  onSelect,
}: RecordingBookmarksPanelItemProps) {
  const displayLabel =
    bookmark.category === "death"
      ? (bookmark.sceneName ?? bookmark.label)
      : bookmark.label;
  const subtitle =
    bookmark.sceneName && bookmark.sceneName !== displayLabel
      ? bookmark.sceneName
      : null;
  const timestamp = formatRecordingTimelineTimestamp(bookmark.offsetSeconds);
  const shouldShowDuration =
    bookmark.category !== "manual" &&
    typeof bookmark.durationSeconds === "number" &&
    Number.isFinite(bookmark.durationSeconds) &&
    bookmark.durationSeconds > 0;
  const durationTimestamp = shouldShowDuration
    ? formatRecordingTimelineTimestamp(bookmark.durationSeconds)
    : null;
  const eventDateTime = formatDateTime(bookmark.occurredAt);

  const handleSelect = () => {
    onSelect(bookmark);
  };

  const handlePointerEnter = () => {
    onHover?.(bookmark);
  };

  const handlePointerLeave = () => {
    onHover?.(null);
  };

  return (
    <button
      className={clsx(
        "group relative shrink-0 overflow-hidden rounded-md border border-base-content/10 bg-base-100/60 p-3 text-left text-base-content transition",
        bookmarkCategoryPanelItemClassNames[bookmark.category],
      )}
      type="button"
      onClick={handleSelect}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <BookmarkCategoryIcon
        category={bookmark.category}
        className="pointer-events-none absolute right-1 bottom-1 z-[1] h-10 w-10 opacity-10 transition group-hover:opacity-20"
        isDecorative
        size={40}
      />
      <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="truncate font-semibold text-xs" title={displayLabel}>
            {displayLabel}
          </div>
        </div>
        <span className="shrink-0 justify-self-end font-mono text-base-content/55 text-xs transition group-hover:text-current">
          {timestamp}
        </span>
        {subtitle ? (
          <div
            className="min-w-0 truncate text-base-content/50 text-xs"
            title={subtitle}
          >
            {subtitle}
          </div>
        ) : (
          <div className="min-w-0 truncate text-base-content/45 text-xs">
            {eventDateTime}
          </div>
        )}
        {durationTimestamp ? (
          <span className="shrink-0 justify-self-end font-mono text-base-content/35 text-xs transition group-hover:text-current group-hover:opacity-70">
            {durationTimestamp}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        {subtitle && (
          <div className="col-span-2 min-w-0 truncate text-base-content/45 text-xs">
            {eventDateTime}
          </div>
        )}
      </div>
    </button>
  );
}

export { RecordingBookmarksPanelItem };
