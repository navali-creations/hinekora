import { useEditorRecordingBookmarksContext } from "../EditorRecordingBookmarksProvider/EditorRecordingBookmarksProvider";
import { EditorTimeline } from "../EditorTimeline/EditorTimeline";

function EditorTimelineWithBookmarks() {
  const bookmarks = useEditorRecordingBookmarksContext();

  return (
    <EditorTimeline
      bookmarks={{
        hoveredBookmark: bookmarks.highlightedBookmark,
        markerBookmarks: bookmarks.markerBookmarks,
        pinnedBookmark: bookmarks.pinnedBookmark,
        showBookmarkMarkers: bookmarks.showBookmarkMarkers,
      }}
    />
  );
}

export { EditorTimelineWithBookmarks };
