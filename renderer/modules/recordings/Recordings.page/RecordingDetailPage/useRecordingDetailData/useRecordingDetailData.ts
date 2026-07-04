import { useCallback, useEffect, useState } from "react";

import type {
  RecordingBookmarksPage,
  RecordingBookmarksQuery,
} from "~/main/modules/bookmarks";
import type { RunRecordingDetail } from "~/main/modules/recording-storage";

import { recordingBookmarksPanelPageSize } from "../RecordingBookmarksPanel/RecordingBookmarksPanel.utils";

interface RecordingDetailState {
  bookmarksPage: RecordingBookmarksPage | null;
  detail: RunRecordingDetail | null;
  error: string | null;
  isLoading: boolean;
}

const initialRecordingDetailState: RecordingDetailState = {
  bookmarksPage: null,
  detail: null,
  error: null,
  isLoading: true,
};

function useRecordingDetailData(recordingId: string) {
  const [state, setState] = useState<RecordingDetailState>(
    initialRecordingDetailState,
  );

  const refreshBookmarksPage = useCallback(
    async (query: RecordingBookmarksQuery) => {
      const bookmarksPage = await window.electron.bookmarks.listRecording(
        recordingId,
        query,
      );

      setState((current) => ({
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
      }));
    },
    [recordingId],
  );

  useEffect(() => {
    let isActive = true;
    setState(initialRecordingDetailState);

    Promise.all([
      window.electron.recordingStorage.getRecording(recordingId),
      window.electron.bookmarks.listRecording(recordingId, {
        pageIndex: 0,
        pageSize: recordingBookmarksPanelPageSize,
      }),
    ])
      .then(([detail, bookmarksPage]) => {
        if (isActive) {
          setState({ bookmarksPage, detail, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            detail: null,
            bookmarksPage: null,
            error: error instanceof Error ? error.message : "Recording failed",
            isLoading: false,
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
