import type { BookmarkLibraryItem } from "~/main/modules/bookmarks";
import { formatDurationSeconds } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import { calculateBookmarkRecordingProgressPercent } from "./BookmarksRecordingTimeCell.utils";

interface BookmarksRecordingTimeCellProps {
  bookmark: BookmarkLibraryItem;
}

function BookmarksRecordingTimeCell({
  bookmark,
}: BookmarksRecordingTimeCellProps) {
  if (bookmark.activeRecordingId) {
    const progressPercent = calculateBookmarkRecordingProgressPercent({
      durationSeconds: bookmark.activeRecordingDurationSeconds,
      offsetSeconds: bookmark.activeRecordingOffsetSeconds,
    });

    return (
      <div className="min-w-0">
        <div>
          {formatDurationSeconds(bookmark.activeRecordingOffsetSeconds)}
        </div>
        {progressPercent !== null && (
          <div className="text-base-content/50 text-xs">
            {progressPercent}% into recording
          </div>
        )}
      </div>
    );
  }

  if (bookmark.archivedRecordingTitle) {
    return <span className="badge badge-outline badge-xs">Archived</span>;
  }

  return <span className="text-base-content/45">--</span>;
}

export { BookmarksRecordingTimeCell };
