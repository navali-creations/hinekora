import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  RecordingBookmark,
  RecordingBookmarksPage,
} from "~/main/modules/bookmarks";
import type { EditorProject } from "~/main/modules/editor";
import {
  allRecordingBookmarkCategoriesValue,
  recordingBookmarksPanelPageSize,
  resolveRecordingBookmarkCategories,
} from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { useBookmarksShallow } from "~/renderer/store";

import {
  isEditorBookmarkInTimelineRange,
  resolveEditorBookmarkTimelineHighlightItem,
  resolveEditorBookmarkTimelineItem,
  resolveEditorBookmarkTimelineItems,
  resolveEditorBookmarkTimelineSeconds,
  resolveEditorRecordingBookmarkSource,
} from "./useEditorRecordingBookmarks.utils";

interface UseEditorRecordingBookmarksInput {
  isEnabled: boolean;
  project: EditorProject | null;
  selectedClipId: string | null;
}

interface EditorRecordingBookmarksState {
  error: string | null;
  isLoading: boolean;
  page: RecordingBookmarksPage | null;
  sourceId: string | null;
  sourceKey: string | null;
}

const initialBookmarksState: EditorRecordingBookmarksState = {
  error: null,
  isLoading: false,
  page: null,
  sourceId: null,
  sourceKey: null,
};

function compareBookmarksByLatest(
  firstBookmark: RecordingBookmark,
  secondBookmark: RecordingBookmark,
): number {
  const firstOccurredAt = Date.parse(firstBookmark.occurredAt);
  const secondOccurredAt = Date.parse(secondBookmark.occurredAt);
  if (Number.isFinite(firstOccurredAt) && Number.isFinite(secondOccurredAt)) {
    const occurredAtDiff = secondOccurredAt - firstOccurredAt;
    if (occurredAtDiff !== 0) {
      return occurredAtDiff;
    }
  }

  const firstOffsetSeconds = firstBookmark.offsetSeconds ?? 0;
  const secondOffsetSeconds = secondBookmark.offsetSeconds ?? 0;

  return secondOffsetSeconds - firstOffsetSeconds;
}

function useEditorRecordingBookmarks({
  isEnabled,
  project,
  selectedClipId,
}: UseEditorRecordingBookmarksInput) {
  const requestIdRef = useRef(0);
  const [state, setState] = useState<EditorRecordingBookmarksState>(
    initialBookmarksState,
  );
  const {
    categoryFilter,
    hasInteracted,
    hoveredBookmarkId,
    pageIndex,
    resetBookmarks,
    selectedBookmarkId,
    setHoveredBookmarkId,
    setPageIndex,
    setSelectedBookmarkId,
  } = useBookmarksShallow((bookmarks) => ({
    categoryFilter: bookmarks.editorRecording.categoryFilter,
    hasInteracted: bookmarks.editorRecording.hasInteracted,
    hoveredBookmarkId: bookmarks.editorRecording.hoveredBookmarkId,
    pageIndex: bookmarks.editorRecording.pageIndex,
    resetBookmarks: bookmarks.resetEditorRecordingBookmarks,
    selectedBookmarkId: bookmarks.editorRecording.selectedBookmarkId,
    setHoveredBookmarkId: bookmarks.setEditorRecordingHoveredBookmarkId,
    setPageIndex: bookmarks.setEditorRecordingPageIndex,
    setSelectedBookmarkId: bookmarks.setEditorRecordingSelectedBookmarkId,
  }));
  const source = useMemo(
    () => resolveEditorRecordingBookmarkSource({ project, selectedClipId }),
    [project, selectedClipId],
  );
  const sourceId = source?.id ?? null;
  const sourceAssetKey = source?.assetKey ?? null;
  const sourceClipId = source?.clipId ?? null;
  const sourceKey =
    sourceId && sourceClipId ? `${sourceId}:${sourceClipId}` : sourceId;
  const isCurrentSourceState =
    state.sourceId === sourceId && state.sourceKey === sourceKey;
  const hasLoadedSourcePage = Boolean(
    state.sourceId === sourceId && state.page,
  );
  const currentPage = isCurrentSourceState ? state.page : null;

  useEffect(() => {
    resetBookmarks();
    setPageIndex(0);
    setState((current) => {
      if (!sourceId) {
        return initialBookmarksState;
      }

      if (current.sourceId !== sourceId) {
        return initialBookmarksState;
      }

      if (current.sourceKey === sourceKey) {
        return current;
      }

      return {
        ...current,
        error: null,
        isLoading: false,
        sourceKey,
      };
    });
  }, [resetBookmarks, setPageIndex, sourceId, sourceKey]);

  useEffect(() => {
    if (!sourceId) {
      requestIdRef.current += 1;
      setState(initialBookmarksState);
      return;
    }

    if (!isEnabled) {
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
    const query = {
      includeTimeline: true,
      pageIndex: 0,
      pageSize: recordingBookmarksPanelPageSize,
    };

    setState((current) => ({
      ...current,
      error: null,
      isLoading: true,
      page: current.sourceId === sourceId ? current.page : null,
      sourceId,
      sourceKey,
    }));

    void window.electron.bookmarks
      .listRecording(sourceId, query)
      .then((page) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setState({
          error: null,
          isLoading: false,
          page,
          sourceId,
          sourceKey,
        });
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : "Recording bookmarks failed",
          isLoading: false,
          page: null,
          sourceId,
          sourceKey,
        });
      });
  }, [hasLoadedSourcePage, isEnabled, sourceId, sourceKey]);

  const rawTimelineBookmarks = currentPage?.timelineItems ?? [];
  const rawPageBookmarks = currentPage?.items ?? [];
  const clipBookmarks = useMemo(
    () =>
      rawTimelineBookmarks.filter((bookmark) =>
        isEditorBookmarkInTimelineRange({
          bookmark,
          project,
          recordingAssetKey: sourceAssetKey,
          recordingClipId: sourceClipId,
        }),
      ),
    [project, rawTimelineBookmarks, sourceAssetKey, sourceClipId],
  );
  const timelineBookmarks = useMemo(
    () =>
      resolveEditorBookmarkTimelineItems({
        bookmarks: rawTimelineBookmarks,
        project,
        recordingAssetKey: sourceAssetKey,
        recordingClipId: sourceClipId,
      }),
    [project, rawTimelineBookmarks, sourceAssetKey, sourceClipId],
  );
  const clipCategorySet = useMemo(
    () => new Set(resolveRecordingBookmarkCategories(clipBookmarks)),
    [clipBookmarks],
  );
  const categories = useMemo(
    () =>
      currentPage?.availableCategories.length
        ? currentPage.availableCategories.filter((category) =>
            clipCategorySet.has(category),
          )
        : Array.from(clipCategorySet),
    [clipCategorySet, currentPage?.availableCategories],
  );
  const categoryBookmarks = useMemo(
    () =>
      (categoryFilter === allRecordingBookmarkCategoriesValue
        ? clipBookmarks
        : clipBookmarks.filter(
            (bookmark) => bookmark.category === categoryFilter,
          )
      )
        .slice()
        .sort(compareBookmarksByLatest),
    [categoryFilter, clipBookmarks],
  );
  const pageCount = Math.max(
    1,
    Math.ceil(categoryBookmarks.length / recordingBookmarksPanelPageSize),
  );
  const activePageIndex = Math.min(pageIndex, pageCount - 1);
  const latestBookmarks = useMemo(() => {
    const startIndex = activePageIndex * recordingBookmarksPanelPageSize;

    return categoryBookmarks.slice(
      startIndex,
      startIndex + recordingBookmarksPanelPageSize,
    );
  }, [activePageIndex, categoryBookmarks]);
  const markerBookmarks = useMemo(
    () =>
      categoryFilter === allRecordingBookmarkCategoriesValue
        ? timelineBookmarks
        : timelineBookmarks.filter(
            (bookmark) => bookmark.category === categoryFilter,
          ),
    [categoryFilter, timelineBookmarks],
  );
  useEffect(() => {
    setPageIndex((currentPageIndex) =>
      Math.min(currentPageIndex, pageCount - 1),
    );
  }, [pageCount, setPageIndex]);
  useEffect(() => {
    if (
      !hasInteracted ||
      categoryFilter === allRecordingBookmarkCategoriesValue
    ) {
      return;
    }

    if (!clipCategorySet.has(categoryFilter)) {
      resetBookmarks();
      setPageIndex(0);
    }
  }, [
    categoryFilter,
    clipCategorySet,
    hasInteracted,
    resetBookmarks,
    setPageIndex,
  ]);
  useEffect(() => {
    if (!isCurrentSourceState || state.isLoading) {
      return;
    }

    const clipBookmarkIds = new Set(
      clipBookmarks.map((bookmark) => bookmark.id),
    );
    if (hoveredBookmarkId && !clipBookmarkIds.has(hoveredBookmarkId)) {
      setHoveredBookmarkId(null);
    }
    if (selectedBookmarkId && !clipBookmarkIds.has(selectedBookmarkId)) {
      setSelectedBookmarkId(null);
    }
  }, [
    clipBookmarks,
    hoveredBookmarkId,
    isCurrentSourceState,
    selectedBookmarkId,
    setHoveredBookmarkId,
    setSelectedBookmarkId,
    state.isLoading,
  ]);
  const resolveRawBookmark = useCallback(
    (bookmarkId: string | null) =>
      bookmarkId
        ? (rawTimelineBookmarks.find(
            (bookmark) => bookmark.id === bookmarkId,
          ) ??
          rawPageBookmarks.find((bookmark) => bookmark.id === bookmarkId) ??
          null)
        : null,
    [rawPageBookmarks, rawTimelineBookmarks],
  );
  const hoveredBookmark = useMemo(() => {
    const rawBookmark = resolveRawBookmark(hoveredBookmarkId);

    return rawBookmark
      ? resolveEditorBookmarkTimelineItem({
          bookmark: rawBookmark,
          project,
          recordingAssetKey: sourceAssetKey,
          recordingClipId: sourceClipId,
        })
      : null;
  }, [
    hoveredBookmarkId,
    project,
    resolveRawBookmark,
    sourceAssetKey,
    sourceClipId,
  ]);
  const hoveredHighlightBookmark = useMemo(() => {
    const rawBookmark = resolveRawBookmark(hoveredBookmarkId);

    return rawBookmark
      ? resolveEditorBookmarkTimelineHighlightItem({
          bookmark: rawBookmark,
          project,
          recordingAssetKey: sourceAssetKey,
          recordingClipId: sourceClipId,
        })
      : null;
  }, [
    hoveredBookmarkId,
    project,
    resolveRawBookmark,
    sourceAssetKey,
    sourceClipId,
  ]);
  const selectedBookmark = useMemo(() => {
    const rawBookmark = resolveRawBookmark(selectedBookmarkId);

    return rawBookmark
      ? resolveEditorBookmarkTimelineItem({
          bookmark: rawBookmark,
          project,
          recordingAssetKey: sourceAssetKey,
          recordingClipId: sourceClipId,
        })
      : null;
  }, [
    project,
    resolveRawBookmark,
    selectedBookmarkId,
    sourceAssetKey,
    sourceClipId,
  ]);
  const selectedHighlightBookmark = useMemo(() => {
    const rawBookmark = resolveRawBookmark(selectedBookmarkId);

    return rawBookmark
      ? resolveEditorBookmarkTimelineHighlightItem({
          bookmark: rawBookmark,
          project,
          recordingAssetKey: sourceAssetKey,
          recordingClipId: sourceClipId,
        })
      : null;
  }, [
    project,
    resolveRawBookmark,
    selectedBookmarkId,
    sourceAssetKey,
    sourceClipId,
  ]);

  const resolveTimelineSeconds = useCallback(
    (bookmark: RecordingBookmark) => {
      const timelineSeconds = resolveEditorBookmarkTimelineSeconds({
        bookmark,
        project,
        recordingAssetKey: sourceAssetKey,
        recordingClipId: sourceClipId,
      });

      if (timelineSeconds !== null) {
        return timelineSeconds;
      }

      return (
        resolveEditorBookmarkTimelineHighlightItem({
          bookmark,
          project,
          recordingAssetKey: sourceAssetKey,
          recordingClipId: sourceClipId,
        })?.offsetSeconds ?? null
      );
    },
    [project, sourceAssetKey, sourceClipId],
  );

  return {
    categories,
    error: isCurrentSourceState ? state.error : null,
    highlightedBookmark: hoveredHighlightBookmark ?? selectedHighlightBookmark,
    isLoading: Boolean(sourceId) && (!isCurrentSourceState || state.isLoading),
    latestBookmarks,
    markerBookmarks,
    pageCount,
    pageIndex: activePageIndex,
    recordingSource: source,
    pinnedBookmark: hoveredBookmark ?? selectedBookmark,
    resolveTimelineSeconds,
    showBookmarkMarkers: isCurrentSourceState && hasInteracted,
    timelineItemsTruncated: currentPage?.timelineItemsTruncated ?? false,
    totalCount: categoryBookmarks.length,
  };
}

type EditorRecordingBookmarksData = ReturnType<
  typeof useEditorRecordingBookmarks
>;

export type { EditorRecordingBookmarksData };
export { useEditorRecordingBookmarks };
