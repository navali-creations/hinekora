import type { RecordingBookmark } from "~/main/modules/bookmarks";

import { RecordingBookmarkTimelineMarker } from "../RecordingBookmarkTimelineMarker/RecordingBookmarkTimelineMarker";
import { RecordingTimelineHoverSegment } from "../RecordingTimelineHoverSegment/RecordingTimelineHoverSegment";

interface RecordingTimelineBookmarkClipTarget {
  durationSeconds: number | null;
  targetDurationSeconds: number | null;
  targetId: string;
}

interface RecordingTimelineBookmarkMarkersProps {
  clipTargetsByBookmarkId?: Record<string, RecordingTimelineBookmarkClipTarget>;
  durationSeconds: number;
  hoveredBookmark: RecordingBookmark | null;
  markerBookmarks: RecordingBookmark[];
  pinnedBookmark?: RecordingBookmark | null;
  showBookmarkMarkers: boolean;
  onClipTargetSelect?: (clipId: string) => void;
}

function RecordingTimelineBookmarkMarkers({
  clipTargetsByBookmarkId = {},
  durationSeconds,
  hoveredBookmark,
  markerBookmarks,
  pinnedBookmark,
  showBookmarkMarkers,
  onClipTargetSelect,
}: RecordingTimelineBookmarkMarkersProps) {
  const activePinnedBookmark =
    pinnedBookmark === undefined ? hoveredBookmark : pinnedBookmark;
  const shouldRenderPinnedBookmark =
    activePinnedBookmark !== null &&
    (!showBookmarkMarkers ||
      !markerBookmarks.some(
        (bookmark) => bookmark.id === activePinnedBookmark.id,
      ));

  const renderBookmarkMarker = (bookmark: RecordingBookmark) => {
    const clipTarget = clipTargetsByBookmarkId[bookmark.id];

    return (
      <RecordingBookmarkTimelineMarker
        bookmark={bookmark}
        durationSeconds={durationSeconds}
        key={bookmark.id}
        {...(clipTarget ? { clipTargetId: clipTarget.targetId } : {})}
        {...(onClipTargetSelect ? { onClipTargetSelect } : {})}
      />
    );
  };

  return (
    <>
      <RecordingTimelineHoverSegment
        clipTargetsByBookmarkId={clipTargetsByBookmarkId}
        durationSeconds={durationSeconds}
        hoveredBookmark={hoveredBookmark}
      />
      {activePinnedBookmark &&
        shouldRenderPinnedBookmark &&
        renderBookmarkMarker(activePinnedBookmark)}
      {showBookmarkMarkers && markerBookmarks.map(renderBookmarkMarker)}
    </>
  );
}

export { RecordingTimelineBookmarkMarkers };
