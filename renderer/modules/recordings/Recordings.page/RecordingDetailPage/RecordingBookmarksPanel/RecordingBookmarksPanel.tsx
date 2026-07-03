import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import type {
  BookmarkCategory,
  RecordingBookmark,
} from "~/main/modules/bookmarks";

import { RecordingBookmarkFilterChip } from "../RecordingBookmarkFilterChip/RecordingBookmarkFilterChip";
import { RecordingBookmarksPanelItem } from "../RecordingBookmarksPanelItem/RecordingBookmarksPanelItem";
import {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
  resolveRecordingBookmarksPanelPage,
} from "./RecordingBookmarksPanel.utils";

const recordingBookmarksPanelPageSize = 5;

interface RecordingBookmarksPanelProps {
  bookmarks: RecordingBookmark[];
  categories: BookmarkCategory[];
  categoryFilter: RecordingBookmarkCategoryFilter;
  heightPixels: number | null;
  pageIndex: number;
  onCategoryChange: (category: RecordingBookmarkCategoryFilter) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onSelectBookmark: (bookmark: RecordingBookmark) => void;
}

function RecordingBookmarksPanel({
  bookmarks,
  categories,
  categoryFilter,
  heightPixels,
  pageIndex,
  onCategoryChange,
  onNextPage,
  onPreviousPage,
  onSelectBookmark,
}: RecordingBookmarksPanelProps) {
  const page = resolveRecordingBookmarksPanelPage({
    bookmarks,
    categoryFilter,
    pageIndex,
    pageSize: recordingBookmarksPanelPageSize,
  });
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
            <RecordingBookmarkFilterChip
              category={category}
              isActive={categoryFilter === category}
              key={category}
              onSelect={onCategoryChange}
            />
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-auto p-3">
        {page.items.map((bookmark) => (
          <RecordingBookmarksPanelItem
            bookmark={bookmark}
            key={bookmark.id}
            onSelect={onSelectBookmark}
          />
        ))}
        {page.items.length === 0 && (
          <p className="m-0 text-base-content/55 text-sm">
            No bookmarks are attached to this recording yet.
          </p>
        )}
      </div>
      <div className="flex h-9 shrink-0 items-center justify-between border-base-content/10 border-t px-3 text-xs">
        <span className="text-base-content/60">{page.totalCount} items</span>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous bookmark page"
            className="btn btn-ghost btn-xs btn-square"
            disabled={page.pageIndex === 0}
            type="button"
            onClick={onPreviousPage}
          >
            <FiChevronLeft size={14} />
          </button>
          <span className="min-w-10 text-center font-mono">
            {page.pageIndex + 1} / {page.pageCount}
          </span>
          <button
            aria-label="Next bookmark page"
            className="btn btn-ghost btn-xs btn-square"
            disabled={page.pageIndex >= page.pageCount - 1}
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
