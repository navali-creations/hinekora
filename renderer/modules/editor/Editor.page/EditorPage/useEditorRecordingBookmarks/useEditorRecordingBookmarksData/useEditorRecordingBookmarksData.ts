import { useEffect, useRef, useState } from "react";

import type { RecordingBookmarksPage } from "~/main/modules/bookmarks";
import {
  allRecordingBookmarkCategoriesValue,
  recordingBookmarksPanelPageSize,
} from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { useDebouncedBookmarkSearchText } from "~/renderer/modules/bookmarks/Bookmarks.hooks/useDebouncedBookmarkSearchText/useDebouncedBookmarkSearchText";
import { useBookmarksShallow } from "~/renderer/store";

interface EditorRecordingBookmarksState {
  page: RecordingBookmarksPage | null;
  sourceId: string | null;
  sourceKey: string | null;
}

const initialBookmarksState: EditorRecordingBookmarksState = {
  page: null,
  sourceId: null,
  sourceKey: null,
};

function createPanelQueryKey(input: {
  category: string;
  pageIndex: number;
  rangeEndSeconds: number | null;
  rangeStartSeconds: number | null;
  searchText: string;
  sourceId: string | null;
  sourceKey: string | null;
}) {
  return JSON.stringify([
    input.sourceId,
    input.sourceKey,
    input.category,
    input.pageIndex,
    input.searchText,
    input.rangeStartSeconds,
    input.rangeEndSeconds,
  ]);
}

function useEditorRecordingBookmarksData(input: {
  isEnabled: boolean;
  rangeEndSeconds: number | null;
  rangeStartSeconds: number | null;
  sourceId: string | null;
  sourceKey: string | null;
}) {
  const requestIdRef = useRef(0);
  const panelRequestIdRef = useRef(0);
  const panelQueryKeyRef = useRef<string | null>(null);
  const [state, setState] = useState(initialBookmarksState);
  const {
    categoryFilter,
    isLoading,
    pageIndex,
    resetBookmarks,
    searchText,
    setPageIndex,
    setPanelStatus,
  } = useBookmarksShallow((bookmarks) => ({
    categoryFilter: bookmarks.editorRecording.categoryFilter,
    isLoading: bookmarks.editorRecording.isLoading,
    pageIndex: bookmarks.editorRecording.pageIndex,
    resetBookmarks: bookmarks.resetEditorRecordingBookmarks,
    searchText: bookmarks.editorRecording.searchText,
    setPageIndex: bookmarks.setEditorRecordingPageIndex,
    setPanelStatus: bookmarks.setEditorRecordingPanelStatus,
  }));
  const debouncedSearchText = useDebouncedBookmarkSearchText(
    searchText,
    input.sourceKey,
  );
  const isCurrentSourceState =
    state.sourceId === input.sourceId && state.sourceKey === input.sourceKey;
  const hasLoadedSourcePage = Boolean(
    state.sourceId === input.sourceId && state.page,
  );
  const currentPage = isCurrentSourceState ? state.page : null;
  const panelQueryKey = createPanelQueryKey({
    category: categoryFilter,
    pageIndex,
    rangeEndSeconds: input.rangeEndSeconds,
    rangeStartSeconds: input.rangeStartSeconds,
    searchText: debouncedSearchText,
    sourceId: input.sourceId,
    sourceKey: input.sourceKey,
  });
  useEffect(() => {
    panelRequestIdRef.current += 1;
    panelQueryKeyRef.current = null;
    resetBookmarks();
    setState((current) => {
      if (!input.sourceId || current.sourceId !== input.sourceId) {
        return initialBookmarksState;
      }
      if (current.sourceKey === input.sourceKey) {
        return current;
      }
      return {
        ...current,
        sourceKey: input.sourceKey,
      };
    });
  }, [input.sourceId, input.sourceKey, resetBookmarks]);

  useEffect(() => {
    if (!input.sourceId) {
      requestIdRef.current += 1;
      setState(initialBookmarksState);
      return;
    }
    if (!input.isEnabled) {
      if (!hasLoadedSourcePage) {
        requestIdRef.current += 1;
      }
      return;
    }
    if (hasLoadedSourcePage) {
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setPanelStatus({ errorMessage: null, isLoading: true });
    setState((current) => ({
      ...current,
      page: current.sourceId === input.sourceId ? current.page : null,
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
    }));

    void window.electron.bookmarks
      .listRecording(input.sourceId, {
        includeTimeline: true,
        pageIndex: 0,
        pageSize: recordingBookmarksPanelPageSize,
        ...(input.rangeEndSeconds !== null
          ? { rangeEndSeconds: input.rangeEndSeconds }
          : {}),
        ...(input.rangeStartSeconds !== null
          ? { rangeStartSeconds: input.rangeStartSeconds }
          : {}),
      })
      .then((page) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        panelQueryKeyRef.current = createPanelQueryKey({
          category: allRecordingBookmarkCategoriesValue,
          pageIndex: 0,
          rangeEndSeconds: input.rangeEndSeconds,
          rangeStartSeconds: input.rangeStartSeconds,
          searchText: "",
          sourceId: input.sourceId,
          sourceKey: input.sourceKey,
        });
        setState({
          page,
          sourceId: input.sourceId,
          sourceKey: input.sourceKey,
        });
        setPanelStatus({ errorMessage: null, isLoading: false });
      })
      .catch((error: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setPanelStatus({
          errorMessage:
            error instanceof Error
              ? error.message
              : "Recording bookmarks failed",
          isLoading: false,
        });
        setState({
          page: null,
          sourceId: input.sourceId,
          sourceKey: input.sourceKey,
        });
      });
  }, [
    hasLoadedSourcePage,
    input.isEnabled,
    input.rangeEndSeconds,
    input.rangeStartSeconds,
    input.sourceId,
    input.sourceKey,
    setPanelStatus,
  ]);

  useEffect(() => {
    if (!input.isEnabled || !input.sourceId || !hasLoadedSourcePage) {
      return;
    }
    if (panelQueryKeyRef.current === panelQueryKey) {
      return;
    }
    panelQueryKeyRef.current = panelQueryKey;
    panelRequestIdRef.current += 1;
    const requestId = panelRequestIdRef.current;
    setPanelStatus({ errorMessage: null, isLoading: true });
    void window.electron.bookmarks
      .listRecording(input.sourceId, {
        ...(categoryFilter !== allRecordingBookmarkCategoriesValue
          ? { category: categoryFilter }
          : {}),
        includeTimeline: false,
        pageIndex,
        pageSize: recordingBookmarksPanelPageSize,
        ...(input.rangeEndSeconds !== null
          ? { rangeEndSeconds: input.rangeEndSeconds }
          : {}),
        ...(input.rangeStartSeconds !== null
          ? { rangeStartSeconds: input.rangeStartSeconds }
          : {}),
        ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
      })
      .then((nextPage) => {
        if (requestId !== panelRequestIdRef.current) {
          return;
        }
        setState((current) => ({
          ...current,
          page: {
            ...nextPage,
            timelineItems: current.page?.timelineItems ?? [],
            timelineItemsTruncated:
              current.page?.timelineItemsTruncated ?? false,
          },
        }));
        setPanelStatus({ errorMessage: null, isLoading: false });
        if (nextPage.pageIndex >= nextPage.pageCount) {
          setPageIndex(nextPage.pageCount - 1);
        }
      })
      .catch((error: unknown) => {
        if (requestId !== panelRequestIdRef.current) {
          return;
        }
        setPanelStatus({
          errorMessage:
            error instanceof Error
              ? error.message
              : "Recording bookmarks failed",
          isLoading: false,
        });
      });
  }, [
    categoryFilter,
    debouncedSearchText,
    hasLoadedSourcePage,
    input.isEnabled,
    input.rangeEndSeconds,
    input.rangeStartSeconds,
    input.sourceId,
    pageIndex,
    panelQueryKey,
    setPageIndex,
    setPanelStatus,
  ]);

  return {
    currentPage,
    isCurrentSourceState,
    isLoading: Boolean(input.sourceId) && (!isCurrentSourceState || isLoading),
  };
}

export { useEditorRecordingBookmarksData };
