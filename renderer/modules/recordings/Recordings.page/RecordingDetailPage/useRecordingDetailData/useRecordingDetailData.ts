import { useCallback, useEffect, useRef, useState } from "react";

import type {
  RecordingBookmarksPage,
  RecordingBookmarksQuery,
} from "~/main/modules/bookmarks";
import type { RunRecordingDetail } from "~/main/modules/recording-storage";
import { recordingBookmarksPanelPageSize } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";

interface RecordingDetailState {
  bookmarksPage: RecordingBookmarksPage | null;
  detail: RunRecordingDetail | null;
  error: string | null;
  isLoading: boolean;
  loadedRecordingId: string | null;
}

const initialRecordingDetailState: RecordingDetailState = {
  bookmarksPage: null,
  detail: null,
  error: null,
  isLoading: true,
  loadedRecordingId: null,
};

function useRecordingDetailData(recordingId: string) {
  const [state, setState] = useState<RecordingDetailState>(
    initialRecordingDetailState,
  );
  const bookmarksRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);

  const refreshBookmarksPage = useCallback(
    async (query: RecordingBookmarksQuery) => {
      bookmarksRequestIdRef.current += 1;
      const requestId = bookmarksRequestIdRef.current;
      const bookmarksPage = await window.electron.bookmarks.listRecording(
        recordingId,
        query,
      );
      if (requestId !== bookmarksRequestIdRef.current) {
        return;
      }

      setState((current) =>
        current.loadedRecordingId === recordingId
          ? {
              ...current,
              bookmarksPage: current.bookmarksPage
                ? {
                    ...bookmarksPage,
                    timelineItems:
                      query.includeTimeline === false
                        ? current.bookmarksPage.timelineItems
                        : bookmarksPage.timelineItems,
                    timelineItemsTruncated:
                      query.includeTimeline === false
                        ? current.bookmarksPage.timelineItemsTruncated
                        : bookmarksPage.timelineItemsTruncated,
                  }
                : bookmarksPage,
            }
          : current,
      );
    },
    [recordingId],
  );

  useEffect(() => {
    let isActive = true;
    bookmarksRequestIdRef.current += 1;
    detailRequestIdRef.current += 1;
    const requestId = detailRequestIdRef.current;
    setState(initialRecordingDetailState);

    Promise.all([
      window.electron.recordingStorage.getRecording(recordingId),
      window.electron.bookmarks.listRecording(recordingId, {
        pageIndex: 0,
        pageSize: recordingBookmarksPanelPageSize,
      }),
    ])
      .then(([detail, bookmarksPage]) => {
        if (isActive && requestId === detailRequestIdRef.current) {
          setState({
            bookmarksPage,
            detail,
            error: null,
            isLoading: false,
            loadedRecordingId: recordingId,
          });
        }
      })
      .catch((error: unknown) => {
        if (isActive && requestId === detailRequestIdRef.current) {
          setState({
            detail: null,
            bookmarksPage: null,
            error: error instanceof Error ? error.message : "Recording failed",
            isLoading: false,
            loadedRecordingId: null,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [recordingId]);

  return { ...state, refreshBookmarksPage };
}

export type { RecordingDetailState };
export { useRecordingDetailData };
