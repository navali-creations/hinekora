import type { RecordingBookmark } from "~/main/modules/bookmarks";

interface ResolveRecordingDetailHighlightedBookmarkInput {
  hoveredBookmarkId: string | null;
  latestBookmarks: RecordingBookmark[];
  selectedBookmarkId: string | null;
  timelineBookmarks: RecordingBookmark[];
}

function resolveRecordingDetailBookmarkById(
  bookmarkId: string | null,
  timelineBookmarks: RecordingBookmark[],
  latestBookmarks: RecordingBookmark[],
): RecordingBookmark | null {
  if (!bookmarkId) {
    return null;
  }

  return (
    timelineBookmarks.find((bookmark) => bookmark.id === bookmarkId) ??
    latestBookmarks.find((bookmark) => bookmark.id === bookmarkId) ??
    null
  );
}

function resolveRecordingDetailHighlightedBookmark({
  hoveredBookmarkId,
  latestBookmarks,
  selectedBookmarkId,
  timelineBookmarks,
}: ResolveRecordingDetailHighlightedBookmarkInput): RecordingBookmark | null {
  return (
    resolveRecordingDetailBookmarkById(
      hoveredBookmarkId,
      timelineBookmarks,
      latestBookmarks,
    ) ??
    resolveRecordingDetailBookmarkById(
      selectedBookmarkId,
      timelineBookmarks,
      latestBookmarks,
    )
  );
}

export { resolveRecordingDetailHighlightedBookmark };
