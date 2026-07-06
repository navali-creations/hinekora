import { RecordingTimelineBookmarkMarkers } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingTimelineBookmarkMarkers/RecordingTimelineBookmarkMarkers";

import type { EditorTimelineBookmarks } from "../EditorTimeline/EditorTimeline.utils";

interface EditorTimelineBookmarkLayerProps {
  bookmarks: EditorTimelineBookmarks | undefined;
  visibleDurationSeconds: number;
}

function EditorTimelineBookmarkLayer({
  bookmarks,
  visibleDurationSeconds,
}: EditorTimelineBookmarkLayerProps) {
  if (!bookmarks) {
    return null;
  }

  return (
    <RecordingTimelineBookmarkMarkers
      durationSeconds={visibleDurationSeconds}
      hoveredBookmark={bookmarks.hoveredBookmark}
      markerBookmarks={bookmarks.markerBookmarks}
      pinnedBookmark={
        bookmarks.pinnedBookmark === undefined
          ? bookmarks.hoveredBookmark
          : bookmarks.pinnedBookmark
      }
      showBookmarkMarkers={bookmarks.showBookmarkMarkers}
    />
  );
}

export { EditorTimelineBookmarkLayer };
