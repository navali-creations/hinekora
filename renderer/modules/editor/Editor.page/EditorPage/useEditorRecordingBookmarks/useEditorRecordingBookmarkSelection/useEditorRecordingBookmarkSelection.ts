import { useCallback, useEffect, useMemo } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import type { EditorProject } from "~/main/modules/editor";
import { useBookmarksShallow } from "~/renderer/store";

import {
  resolveEditorBookmarkTimelineHighlightItem,
  resolveEditorBookmarkTimelineItem,
  resolveEditorBookmarkTimelineSeconds,
} from "../useEditorRecordingBookmarks.utils";

function useEditorRecordingBookmarkSelection(input: {
  clipBookmarks: RecordingBookmark[];
  isCurrentSourceState: boolean;
  isLoading: boolean;
  project: EditorProject | null;
  rawPageBookmarks: RecordingBookmark[];
  rawTimelineBookmarks: RecordingBookmark[];
  sourceAssetKey: string | null;
  sourceClipId: string | null;
}) {
  const {
    hoveredBookmarkId,
    selectedBookmarkId,
    setHoveredBookmarkId,
    setSelectedBookmarkId,
  } = useBookmarksShallow((bookmarks) => ({
    hoveredBookmarkId: bookmarks.editorRecording.hoveredBookmarkId,
    selectedBookmarkId: bookmarks.editorRecording.selectedBookmarkId,
    setHoveredBookmarkId: bookmarks.setEditorRecordingHoveredBookmarkId,
    setSelectedBookmarkId: bookmarks.setEditorRecordingSelectedBookmarkId,
  }));

  useEffect(() => {
    if (!input.isCurrentSourceState || input.isLoading) {
      return;
    }
    const clipBookmarkIds = new Set(
      input.clipBookmarks.map((bookmark) => bookmark.id),
    );
    if (hoveredBookmarkId && !clipBookmarkIds.has(hoveredBookmarkId)) {
      setHoveredBookmarkId(null);
    }
    if (selectedBookmarkId && !clipBookmarkIds.has(selectedBookmarkId)) {
      setSelectedBookmarkId(null);
    }
  }, [
    hoveredBookmarkId,
    input.clipBookmarks,
    input.isCurrentSourceState,
    input.isLoading,
    selectedBookmarkId,
    setHoveredBookmarkId,
    setSelectedBookmarkId,
  ]);

  const resolveRawBookmark = useCallback(
    (bookmarkId: string | null) =>
      bookmarkId
        ? (input.rawTimelineBookmarks.find(
            (bookmark) => bookmark.id === bookmarkId,
          ) ??
          input.rawPageBookmarks.find(
            (bookmark) => bookmark.id === bookmarkId,
          ) ??
          null)
        : null,
    [input.rawPageBookmarks, input.rawTimelineBookmarks],
  );
  const resolveTimelineItem = useCallback(
    (bookmarkId: string | null, highlight: boolean) => {
      const bookmark = resolveRawBookmark(bookmarkId);
      if (!bookmark) {
        return null;
      }
      const mappingInput = {
        bookmark,
        project: input.project,
        recordingAssetKey: input.sourceAssetKey,
        recordingClipId: input.sourceClipId,
      };
      return highlight
        ? resolveEditorBookmarkTimelineHighlightItem(mappingInput)
        : resolveEditorBookmarkTimelineItem(mappingInput);
    },
    [
      input.project,
      input.sourceAssetKey,
      input.sourceClipId,
      resolveRawBookmark,
    ],
  );
  const pinnedBookmark = useMemo(
    () =>
      resolveTimelineItem(hoveredBookmarkId, false) ??
      resolveTimelineItem(selectedBookmarkId, false),
    [hoveredBookmarkId, resolveTimelineItem, selectedBookmarkId],
  );
  const highlightedBookmark = useMemo(
    () =>
      resolveTimelineItem(hoveredBookmarkId, true) ??
      resolveTimelineItem(selectedBookmarkId, true),
    [hoveredBookmarkId, resolveTimelineItem, selectedBookmarkId],
  );
  const resolveTimelineSeconds = useCallback(
    (bookmark: RecordingBookmark) =>
      resolveEditorBookmarkTimelineSeconds({
        bookmark,
        project: input.project,
        recordingAssetKey: input.sourceAssetKey,
        recordingClipId: input.sourceClipId,
      }) ??
      resolveEditorBookmarkTimelineHighlightItem({
        bookmark,
        project: input.project,
        recordingAssetKey: input.sourceAssetKey,
        recordingClipId: input.sourceClipId,
      })?.offsetSeconds ??
      null,
    [input.project, input.sourceAssetKey, input.sourceClipId],
  );

  return { highlightedBookmark, pinnedBookmark, resolveTimelineSeconds };
}

export { useEditorRecordingBookmarkSelection };
