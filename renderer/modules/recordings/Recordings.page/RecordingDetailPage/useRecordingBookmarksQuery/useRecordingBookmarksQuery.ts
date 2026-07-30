import { useEffect, useRef } from "react";

import type { RecordingBookmarksQuery } from "~/main/modules/bookmarks";
import { recordingBookmarksPanelPageSize } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { useDebouncedBookmarkSearchText } from "~/renderer/modules/bookmarks/Bookmarks.hooks/useDebouncedBookmarkSearchText/useDebouncedBookmarkSearchText";
import { useBookmarksShallow } from "~/renderer/store";

interface UseRecordingBookmarksQueryInput {
  category?: RecordingBookmarksQuery["category"];
  isReady: boolean;
  pageIndex: number;
  recordingId: string;
  refresh: (query: RecordingBookmarksQuery) => Promise<void>;
  searchText: string;
}

function useRecordingBookmarksQuery({
  category,
  isReady,
  pageIndex,
  recordingId,
  refresh,
  searchText,
}: UseRecordingBookmarksQueryInput): void {
  const requestIdRef = useRef(0);
  const debouncedSearchText = useDebouncedBookmarkSearchText(
    searchText,
    recordingId,
  );
  const { setPanelStatus } = useBookmarksShallow((bookmarks) => ({
    setPanelStatus: bookmarks.setRecordingDetailPanelStatus,
  }));

  useEffect(() => {
    if (!isReady) {
      requestIdRef.current += 1;
      setPanelStatus({ errorMessage: null, isLoading: false });
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setPanelStatus({ errorMessage: null, isLoading: true });
    void refresh({
      ...(category ? { category } : {}),
      includeTimeline: false,
      pageIndex,
      pageSize: recordingBookmarksPanelPageSize,
      ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
    })
      .then(() => {
        if (requestId === requestIdRef.current) {
          setPanelStatus({ errorMessage: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (requestId === requestIdRef.current) {
          setPanelStatus({
            errorMessage:
              error instanceof Error
                ? error.message
                : "Recording bookmarks failed",
            isLoading: false,
          });
        }
      });
  }, [
    category,
    debouncedSearchText,
    isReady,
    pageIndex,
    refresh,
    setPanelStatus,
  ]);
}

export { useRecordingBookmarksQuery };
