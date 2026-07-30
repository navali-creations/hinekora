import { useMemo } from "react";

import type {
  BookmarkCategory,
  RecordingBookmark,
} from "~/main/modules/bookmarks";
import {
  allRecordingBookmarkCategoriesValue,
  resolveRecordingBookmarkCategories,
} from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { useBookmarksShallow } from "~/renderer/store";

function useRecordingBookmarkFilters(
  bookmarks: RecordingBookmark[],
  availableCategories: BookmarkCategory[] = [],
) {
  const { categoryFilter, hasInteracted, pageIndex, reset, searchText } =
    useBookmarksShallow((bookmarksState) => ({
      categoryFilter: bookmarksState.recordingDetail.categoryFilter,
      hasInteracted: bookmarksState.recordingDetail.hasInteracted,
      pageIndex: bookmarksState.recordingDetail.pageIndex,
      reset: bookmarksState.resetRecordingDetail,
      searchText: bookmarksState.recordingDetail.searchText,
    }));
  const markerBookmarks = useMemo(
    () =>
      categoryFilter === allRecordingBookmarkCategoriesValue
        ? bookmarks
        : bookmarks.filter((bookmark) => bookmark.category === categoryFilter),
    [bookmarks, categoryFilter],
  );
  const categories = useMemo(
    () =>
      availableCategories.length > 0
        ? availableCategories
        : resolveRecordingBookmarkCategories(bookmarks),
    [availableCategories, bookmarks],
  );

  return {
    categories,
    categoryFilter,
    hasInteracted,
    markerBookmarks,
    pageIndex,
    reset,
    searchText,
  };
}

export { useRecordingBookmarkFilters };
