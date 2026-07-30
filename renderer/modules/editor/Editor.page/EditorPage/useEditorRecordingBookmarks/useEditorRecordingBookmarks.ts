import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/main/modules/editor";
import { allRecordingBookmarkCategoriesValue } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { useBookmarksShallow } from "~/renderer/store";

import { useEditorRecordingBookmarkSelection } from "./useEditorRecordingBookmarkSelection/useEditorRecordingBookmarkSelection";
import {
  isEditorBookmarkInTimelineRange,
  resolveEditorBookmarkTimelineItems,
  resolveEditorRecordingBookmarkSource,
} from "./useEditorRecordingBookmarks.utils";
import { useEditorRecordingBookmarksData } from "./useEditorRecordingBookmarksData/useEditorRecordingBookmarksData";

interface UseEditorRecordingBookmarksInput {
  isEnabled: boolean;
  project: EditorProject | null;
  selectedClipId: string | null;
}

function useEditorRecordingBookmarks({
  isEnabled,
  project,
  selectedClipId,
}: UseEditorRecordingBookmarksInput) {
  const { categoryFilter, hasInteracted, resetBookmarks, setPageIndex } =
    useBookmarksShallow((bookmarks) => ({
      categoryFilter: bookmarks.editorRecording.categoryFilter,
      hasInteracted: bookmarks.editorRecording.hasInteracted,
      resetBookmarks: bookmarks.resetEditorRecordingBookmarks,
      setPageIndex: bookmarks.setEditorRecordingPageIndex,
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
  const { currentPage, isCurrentSourceState, isLoading } =
    useEditorRecordingBookmarksData({
      isEnabled,
      rangeEndSeconds: source?.rangeEndSeconds ?? null,
      rangeStartSeconds: source?.rangeStartSeconds ?? null,
      sourceId,
      sourceKey,
    });

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
  const categories = currentPage?.availableCategories ?? [];
  const categoryCounts = currentPage?.categoryCounts ?? [];
  const clipCategorySet = useMemo(() => new Set(categories), [categories]);
  const pageCount = currentPage?.pageCount ?? 1;
  const latestBookmarks = rawPageBookmarks;
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
  const { highlightedBookmark, pinnedBookmark, resolveTimelineSeconds } =
    useEditorRecordingBookmarkSelection({
      clipBookmarks,
      isCurrentSourceState,
      isLoading,
      project,
      rawPageBookmarks,
      rawTimelineBookmarks,
      sourceAssetKey,
      sourceClipId,
    });
  return {
    categories,
    categoryCounts,
    highlightedBookmark,
    latestBookmarks,
    markerBookmarks,
    pageCount,
    recordingSource: source,
    pinnedBookmark,
    resolveTimelineSeconds,
    showBookmarkMarkers: isCurrentSourceState && hasInteracted,
    timelineItemsTruncated: currentPage?.timelineItemsTruncated ?? false,
    totalCount: currentPage?.totalCount ?? 0,
  };
}

type EditorRecordingBookmarksData = ReturnType<
  typeof useEditorRecordingBookmarks
>;

export type { EditorRecordingBookmarksData };
export { useEditorRecordingBookmarks };
