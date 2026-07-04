import clsx from "clsx";

import type { BookmarkLibraryItem } from "~/main/modules/bookmarks";
import { formatDurationSeconds } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

interface BookmarksDurationCellProps {
  bookmark: BookmarkLibraryItem;
}

function BookmarksDurationCell({ bookmark }: BookmarksDurationCellProps) {
  const durationSeconds =
    bookmark.activeRecordingBookmarkDurationSeconds ??
    bookmark.activeActivitySessionBookmarkDurationSeconds ??
    bookmark.archivedRecordingBookmarkDurationSeconds;

  return (
    <span className={clsx(durationSeconds === null && "text-base-content/45")}>
      {formatDurationSeconds(durationSeconds)}
    </span>
  );
}

export { BookmarksDurationCell };
