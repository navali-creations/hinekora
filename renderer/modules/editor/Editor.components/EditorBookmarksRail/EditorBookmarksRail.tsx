import { useCallback } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { RecordingBookmarksPanel } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel";
import type { RecordingBookmarkCategoryFilter } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { useBookmarksShallow, useEditorShallow } from "~/renderer/store";

import { useEditorRecordingBookmarksContext } from "../EditorRecordingBookmarksProvider/EditorRecordingBookmarksProvider";

interface EditorBookmarksRailProps {
  onClose: () => void;
}

function EditorBookmarksRail({ onClose }: EditorBookmarksRailProps) {
  const bookmarks = useEditorRecordingBookmarksContext();
  const setPlaybackSeconds = useEditorShallow(
    (editor) => editor.setPlaybackSeconds,
  );
  const {
    categoryFilter,
    selectCategory,
    selectedBookmarkId,
    setHoveredBookmarkId,
    setPageIndex,
    setSelectedBookmarkId,
  } = useBookmarksShallow((bookmarkState) => ({
    categoryFilter: bookmarkState.editorRecording.categoryFilter,
    selectCategory: bookmarkState.selectEditorRecordingCategory,
    selectedBookmarkId: bookmarkState.editorRecording.selectedBookmarkId,
    setHoveredBookmarkId: bookmarkState.setEditorRecordingHoveredBookmarkId,
    setPageIndex: bookmarkState.setEditorRecordingPageIndex,
    setSelectedBookmarkId: bookmarkState.setEditorRecordingSelectedBookmarkId,
  }));

  const handleCategoryChange = useCallback(
    (category: RecordingBookmarkCategoryFilter) => {
      selectCategory(category);
    },
    [selectCategory],
  );

  const handleHoverBookmark = useCallback(
    (bookmark: RecordingBookmark | null) => {
      setHoveredBookmarkId(bookmark?.id ?? null);
    },
    [setHoveredBookmarkId],
  );

  const handleNextPage = useCallback(() => {
    setPageIndex((currentPageIndex) =>
      Math.min(currentPageIndex + 1, bookmarks.pageCount - 1),
    );
  }, [bookmarks.pageCount, setPageIndex]);

  const handlePreviousPage = useCallback(() => {
    setPageIndex((currentPageIndex) => Math.max(currentPageIndex - 1, 0));
  }, [setPageIndex]);

  const handleSelectBookmark = useCallback(
    (bookmark: RecordingBookmark) => {
      const timelineSeconds = bookmarks.resolveTimelineSeconds(bookmark);
      if (timelineSeconds === null) {
        return;
      }

      setSelectedBookmarkId(bookmark.id);
      setPlaybackSeconds(timelineSeconds);
    },
    [
      bookmarks.resolveTimelineSeconds,
      setPlaybackSeconds,
      setSelectedBookmarkId,
    ],
  );

  return (
    <RecordingBookmarksPanel
      activeCategoryFilter={
        bookmarks.showBookmarkMarkers ? categoryFilter : null
      }
      bookmarks={bookmarks.latestBookmarks}
      categories={bookmarks.categories}
      categoryFilter={categoryFilter}
      emptyMessage={
        bookmarks.recordingSource
          ? "No bookmarks overlap the selected clip."
          : "Select a recording clip to show its bookmarks."
      }
      errorMessage={bookmarks.error}
      heightPixels={null}
      isLoading={bookmarks.isLoading}
      isTimelineTruncated={bookmarks.timelineItemsTruncated}
      pageCount={bookmarks.pageCount}
      pageIndex={bookmarks.pageIndex}
      selectedBookmarkId={selectedBookmarkId}
      subtitle={bookmarks.recordingSource?.name ?? "Recording markers"}
      totalCount={bookmarks.totalCount}
      onCategoryChange={handleCategoryChange}
      onClose={onClose}
      onHoverBookmark={handleHoverBookmark}
      onNextPage={handleNextPage}
      onPreviousPage={handlePreviousPage}
      onSelectBookmark={handleSelectBookmark}
    />
  );
}

export { EditorBookmarksRail };
