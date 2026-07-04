import { useCallback, useMemo, useState } from "react";

import type {
  BookmarkCategory,
  RecordingBookmark,
} from "~/main/modules/bookmarks";

import {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
  resolveRecordingBookmarkCategories,
} from "../RecordingBookmarksPanel/RecordingBookmarksPanel.utils";

function useRecordingBookmarkFilters(
  bookmarks: RecordingBookmark[],
  availableCategories: BookmarkCategory[] = [],
) {
  const [categoryFilter, setCategoryFilter] =
    useState<RecordingBookmarkCategoryFilter>(
      allRecordingBookmarkCategoriesValue,
    );
  const [pageIndex, setPageIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
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

  const reset = useCallback(() => {
    setCategoryFilter(allRecordingBookmarkCategoriesValue);
    setPageIndex(0);
    setHasInteracted(false);
  }, []);

  const selectCategory = useCallback(
    (category: RecordingBookmarkCategoryFilter) => {
      setCategoryFilter(category);
      setPageIndex(0);
      setHasInteracted(true);
    },
    [],
  );

  const previousPage = useCallback(() => {
    setPageIndex((current) => Math.max(0, current - 1));
  }, []);

  const nextPage = useCallback(() => {
    setPageIndex((current) => current + 1);
  }, []);

  const markInteracted = useCallback(() => {
    setHasInteracted(true);
  }, []);

  return {
    categories,
    categoryFilter,
    hasInteracted,
    markerBookmarks,
    markInteracted,
    nextPage,
    pageIndex,
    previousPage,
    reset,
    selectCategory,
  };
}

export { useRecordingBookmarkFilters };
