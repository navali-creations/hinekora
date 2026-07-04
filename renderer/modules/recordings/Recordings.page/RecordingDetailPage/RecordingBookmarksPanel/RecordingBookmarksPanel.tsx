import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import type {
  BookmarkCategory,
  RecordingBookmark,
} from "~/main/modules/bookmarks";
import { BookmarksCategoryFilterChip } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksCategoryFilterChip/BookmarksCategoryFilterChip";

import { RecordingBookmarksPanelItem } from "../RecordingBookmarksPanelItem/RecordingBookmarksPanelItem";
import {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
} from "./RecordingBookmarksPanel.utils";

interface RecordingBookmarksPanelProps {
  bookmarks: RecordingBookmark[];
  categories: BookmarkCategory[];
  categoryFilter: RecordingBookmarkCategoryFilter;
  heightPixels: number | null;
  isTimelineTruncated?: boolean;
  pageCount: number;
  pageIndex: number;
  totalCount: number;
  onCategoryChange: (category: RecordingBookmarkCategoryFilter) => void;
  onHoverBookmark?: (bookmark: RecordingBookmark | null) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onSelectBookmark: (bookmark: RecordingBookmark) => void;
}

function RecordingBookmarksPanel({
  bookmarks,
  categories,
  categoryFilter,
  heightPixels,
  isTimelineTruncated = false,
  pageCount,
  pageIndex,
  totalCount,
  onCategoryChange,
  onHoverBookmark,
  onNextPage,
  onPreviousPage,
  onSelectBookmark,
}: RecordingBookmarksPanelProps) {
  const filterCategories: RecordingBookmarkCategoryFilter[] = [
    allRecordingBookmarkCategoriesValue,
    ...categories,
  ];
  const panelStyle =
    heightPixels && Number.isFinite(heightPixels)
      ? { height: `${heightPixels}px` }
      : undefined;

  return (
    <aside
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200"
      style={panelStyle}
    >
      <div className="border-base-content/10 border-b p-3">
        <h2 className="m-0 font-bold text-sm">Bookmarks</h2>
        <p className="m-0 text-base-content/55 text-xs">Latest markers</p>
      </div>
      <div className="border-base-content/10 border-b p-3">
        <div className="flex flex-wrap gap-1.5">
          {filterCategories.map((category) => (
            <BookmarksCategoryFilterChip
              category={category}
              isActive={categoryFilter === category}
              key={category}
              onSelect={onCategoryChange}
            />
          ))}
        </div>
      </div>
      {isTimelineTruncated && (
        <p className="m-0 border-base-content/10 border-b px-3 py-2 text-warning text-xs">
          Timeline markers were capped for performance. Use the Bookmarks page
          for the complete list.
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
        {bookmarks.map((bookmark) => (
          <RecordingBookmarksPanelItem
            bookmark={bookmark}
            key={bookmark.id}
            {...(onHoverBookmark ? { onHover: onHoverBookmark } : {})}
            onSelect={onSelectBookmark}
          />
        ))}
        {bookmarks.length === 0 && (
          <p className="m-0 text-base-content/55 text-sm">
            No bookmarks are attached to this recording yet.
          </p>
        )}
      </div>
      <div className="flex h-9 shrink-0 items-center justify-between border-base-content/10 border-t px-3 text-xs">
        <span className="text-base-content/60">{totalCount} items</span>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous bookmark page"
            className="btn btn-ghost btn-xs btn-square"
            disabled={pageIndex === 0}
            type="button"
            onClick={onPreviousPage}
          >
            <FiChevronLeft size={14} />
          </button>
          <span className="min-w-10 text-center font-mono">
            {pageIndex + 1} / {pageCount}
          </span>
          <button
            aria-label="Next bookmark page"
            className="btn btn-ghost btn-xs btn-square"
            disabled={pageIndex >= pageCount - 1}
            type="button"
            onClick={onNextPage}
          >
            <FiChevronRight size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export { RecordingBookmarksPanel };
