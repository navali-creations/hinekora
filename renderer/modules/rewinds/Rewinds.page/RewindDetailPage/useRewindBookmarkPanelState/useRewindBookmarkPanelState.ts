import { useEffect, useRef, useState } from "react";

import type { ActivitySessionBookmarksPage } from "~/main/modules/bookmarks";
import {
  allRecordingBookmarkCategoriesValue,
  recordingBookmarksPanelPageSize,
} from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { useDebouncedBookmarkSearchText } from "~/renderer/modules/bookmarks/Bookmarks.hooks/useDebouncedBookmarkSearchText/useDebouncedBookmarkSearchText";
import { useRewindsShallow } from "~/renderer/store";

function useRewindBookmarkPanelState(activitySessionId: string) {
  const requestIdRef = useRef(0);
  const [page, setPage] = useState<ActivitySessionBookmarksPage | null>(null);
  const {
    bookmarkCategoryFilter,
    bookmarkPageIndex,
    searchText,
    setBookmarkPageIndex,
    setPanelStatus,
  } = useRewindsShallow((rewinds) => ({
    bookmarkCategoryFilter: rewinds.detail.bookmarkCategoryFilter,
    bookmarkPageIndex: rewinds.detail.bookmarkPageIndex,
    searchText: rewinds.detail.bookmarkSearchText,
    setBookmarkPageIndex: rewinds.setDetailBookmarkPageIndex,
    setPanelStatus: rewinds.setDetailBookmarkPanelStatus,
  }));
  const debouncedSearchText = useDebouncedBookmarkSearchText(
    searchText,
    activitySessionId,
  );

  useEffect(() => {
    if (!activitySessionId) {
      requestIdRef.current += 1;
      setPage(null);
      setPanelStatus({ errorMessage: null, isLoading: false });
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setPanelStatus({ errorMessage: null, isLoading: true });
    void window.electron.bookmarks
      .listActivitySessionBookmarks(activitySessionId, {
        ...(bookmarkCategoryFilter !== allRecordingBookmarkCategoriesValue
          ? { category: bookmarkCategoryFilter }
          : {}),
        pageIndex: bookmarkPageIndex,
        pageSize: recordingBookmarksPanelPageSize,
        ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
      })
      .then((nextPage) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setPage(nextPage);
        setPanelStatus({ errorMessage: null, isLoading: false });
        if (nextPage.pageIndex >= nextPage.pageCount) {
          setBookmarkPageIndex(nextPage.pageCount - 1);
        }
      })
      .catch((queryError: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setPanelStatus({
          errorMessage:
            queryError instanceof Error
              ? queryError.message
              : "Rewind bookmarks failed",
          isLoading: false,
        });
      });
  }, [
    activitySessionId,
    bookmarkCategoryFilter,
    bookmarkPageIndex,
    debouncedSearchText,
    setBookmarkPageIndex,
    setPanelStatus,
  ]);

  return {
    bookmarkCategories: page?.availableCategories ?? [],
    categoryCounts: page?.categoryCounts ?? [],
    bookmarkPageCount: page?.pageCount ?? 1,
    bookmarkPanelItems: page?.items ?? [],
    bookmarkTotalCount: page?.totalCount ?? 0,
  };
}

export { useRewindBookmarkPanelState };
