import { useCallback } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { RecordingBookmarksPanel } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel";
import { useBookmarksShallow, useEditorShallow } from "~/renderer/store";

import { useEditorRecordingBookmarksContext } from "../EditorRecordingBookmarksProvider/EditorRecordingBookmarksProvider";

function EditorBookmarksRail() {
  const bookmarks = useEditorRecordingBookmarksContext();
  const { closeSidePanel, setPlaybackSeconds } = useEditorShallow((editor) => ({
    closeSidePanel: editor.closeSidePanel,
    setPlaybackSeconds: editor.setPlaybackSeconds,
  }));
  const { setSelectedBookmarkId } = useBookmarksShallow((bookmarkState) => ({
    setSelectedBookmarkId: bookmarkState.setEditorRecordingSelectedBookmarkId,
  }));

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
      bookmarks={bookmarks.latestBookmarks}
      categories={bookmarks.categories}
      categoryCounts={bookmarks.categoryCounts}
      emptyMessage={
        bookmarks.recordingSource
          ? "No bookmarks overlap the selected clip."
          : "Select a recording clip to show its bookmarks."
      }
      heightPixels={null}
      isTimelineTruncated={bookmarks.timelineItemsTruncated}
      pageCount={bookmarks.pageCount}
      owner="editorRecording"
      subtitle={bookmarks.recordingSource?.name ?? "Recording markers"}
      totalCount={bookmarks.totalCount}
      onClose={closeSidePanel}
      onSelectBookmark={handleSelectBookmark}
    />
  );
}

export { EditorBookmarksRail };
