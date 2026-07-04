import { Link } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import {
  FiEdit2 as Edit2,
  FiRotateCcw as Rewind,
  FiTrash2 as Trash2,
} from "react-icons/fi";
import { IoIosRecording } from "react-icons/io";

import type { BookmarkLibraryItem } from "~/main/modules/bookmarks";
import { useBookmarksShallow } from "~/renderer/store";

interface BookmarksTableActionsProps {
  bookmark: BookmarkLibraryItem;
}

function BookmarksTableActions({ bookmark }: BookmarksTableActionsProps) {
  const { deleteManual, openManualRenameDialog } = useBookmarksShallow(
    (bookmarks) => ({
      deleteManual: bookmarks.deleteManual,
      openManualRenameDialog: bookmarks.openManualRenameDialog,
    }),
  );
  const isManualBookmark =
    bookmark.category === "manual" && bookmark.source === "manual";

  const handleRenameManual = (event: MouseEvent<HTMLButtonElement>) => {
    const { bookmarkId, currentLabel } = event.currentTarget.dataset;
    if (!bookmarkId || !currentLabel) {
      return;
    }

    openManualRenameDialog({ id: bookmarkId, label: currentLabel });
  };

  const handleDeleteManual = (event: MouseEvent<HTMLButtonElement>) => {
    const { bookmarkId } = event.currentTarget.dataset;
    if (!bookmarkId) {
      return;
    }

    void deleteManual(bookmarkId);
  };

  return (
    <div className="flex justify-end gap-1.5">
      {bookmark.activeRecordingId && (
        <Link
          aria-label="Open attached recording"
          className="btn btn-primary btn-square btn-xs"
          params={{ recordingId: bookmark.activeRecordingId }}
          search={{ t: bookmark.activeRecordingOffsetSeconds ?? 0 }}
          title="Open attached recording"
          to="/recording/$recordingId"
        >
          <IoIosRecording size={16} />
        </Link>
      )}
      {!bookmark.activeRecordingId && bookmark.activeActivitySessionId && (
        <Link
          aria-label="Open attached rewind"
          className="btn btn-primary btn-square btn-xs"
          params={{ rewindId: bookmark.activeActivitySessionId }}
          search={{ t: bookmark.activeActivitySessionOffsetSeconds ?? 0 }}
          title="Open attached rewind"
          to="/rewind/$rewindId"
        >
          <Rewind size={14} />
        </Link>
      )}
      {isManualBookmark && (
        <>
          <button
            aria-label="Rename bookmark"
            className="btn btn-primary btn-square btn-xs"
            data-bookmark-id={bookmark.id}
            data-current-label={bookmark.label}
            title="Rename bookmark"
            type="button"
            onClick={handleRenameManual}
          >
            <Edit2 size={14} />
          </button>
          <button
            aria-label="Delete bookmark"
            className="btn btn-ghost btn-square btn-xs text-error"
            data-bookmark-id={bookmark.id}
            title="Delete bookmark"
            type="button"
            onClick={handleDeleteManual}
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  );
}

export { BookmarksTableActions };
