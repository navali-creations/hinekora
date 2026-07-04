import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { BookmarkCategoryBadge } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarkCategoryBadge/BookmarkCategoryBadge";

import { formatRecordingTimelineTimestamp } from "../RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

interface RecordingBookmarksPanelItemProps {
  bookmark: RecordingBookmark;
  onSelect: (bookmark: RecordingBookmark) => void;
}

function RecordingBookmarksPanelItem({
  bookmark,
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

  const handleSelect = () => {
    onSelect(bookmark);
  };

  return (
    <button
      className="rounded-md border border-base-content/10 bg-base-100/60 p-2 text-left transition hover:border-primary/40 hover:bg-base-100"
      type="button"
      onClick={handleSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <BookmarkCategoryBadge
          category={bookmark.category}
          size="xs"
          subcategory={bookmark.subcategory}
        />
        <span className="font-mono text-base-content/55 text-xs">
          {formatRecordingTimelineTimestamp(bookmark.offsetSeconds)}
        </span>
      </div>
      <div className="mt-1 truncate font-semibold text-xs">{displayLabel}</div>
      {subtitle && (
        <div className="truncate text-base-content/50 text-xs">{subtitle}</div>
      )}
    </button>
  );
}

export { RecordingBookmarksPanelItem };
