import type {
  BookmarkCategory,
  RecordingBookmark,
} from "~/main/modules/bookmarks";

const allRecordingBookmarkCategoriesValue = "__all__";

type RecordingBookmarkCategoryFilter =
  | BookmarkCategory
  | typeof allRecordingBookmarkCategoriesValue;

interface ResolveRecordingBookmarksPanelPageInput {
  bookmarks: RecordingBookmark[];
  categoryFilter: RecordingBookmarkCategoryFilter;
  pageIndex: number;
  pageSize: number;
}

function resolveRecordingBookmarksPanelPage({
  bookmarks,
  categoryFilter,
  pageIndex,
  pageSize,
}: ResolveRecordingBookmarksPanelPageInput) {
  const filteredBookmarks =
    categoryFilter === allRecordingBookmarkCategoriesValue
      ? bookmarks
      : bookmarks.filter((bookmark) => bookmark.category === categoryFilter);
  const sortedBookmarks = [...filteredBookmarks].sort(
    (firstBookmark, secondBookmark) =>
      resolveBookmarkSortSeconds(secondBookmark) -
        resolveBookmarkSortSeconds(firstBookmark) ||
      secondBookmark.occurredAt.localeCompare(firstBookmark.occurredAt),
  );
  const totalCount = sortedBookmarks.length;
  const pageCount = Math.max(Math.ceil(totalCount / pageSize), 1);
  const safePageIndex = Math.min(Math.max(pageIndex, 0), pageCount - 1);
  const pageStart = safePageIndex * pageSize;

  return {
    items: sortedBookmarks.slice(pageStart, pageStart + pageSize),
    pageCount,
    pageIndex: safePageIndex,
    totalCount,
  };
}

function resolveBookmarkSortSeconds(bookmark: RecordingBookmark): number {
  return typeof bookmark.offsetSeconds === "number" &&
    Number.isFinite(bookmark.offsetSeconds)
    ? bookmark.offsetSeconds
    : 0;
}

function resolveRecordingBookmarkCategories(
  bookmarks: RecordingBookmark[],
): BookmarkCategory[] {
  return Array.from(new Set(bookmarks.map((bookmark) => bookmark.category)));
}

export {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
  resolveRecordingBookmarkCategories,
  resolveRecordingBookmarksPanelPage,
};
