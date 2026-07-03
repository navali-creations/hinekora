import { Link } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import { FiEdit2 as Edit2, FiTrash2 as Trash2 } from "react-icons/fi";
import { IoIosRecording } from "react-icons/io";

import type { BookmarkLibraryItem } from "~/main/modules/bookmarks";
import { useBookmarksShallow } from "~/renderer/store";

interface BookmarksTableActionsProps {
  bookmark: BookmarkLibraryItem;
}

function BookmarksTableActions({ bookmark }: BookmarksTableActionsProps) {
  const { deleteManual, updateManual } = useBookmarksShallow((bookmarks) => ({
    deleteManual: bookmarks.deleteManual,
    updateManual: bookmarks.updateManual,
  }));
  const isManualBookmark =
    bookmark.category === "manual" && bookmark.source === "manual";

  const handleRenameManual = (event: MouseEvent<HTMLButtonElement>) => {
    const { bookmarkId, currentLabel } = event.currentTarget.dataset;
    if (!bookmarkId || !currentLabel) {
      return;
    }

    const label = window.prompt("Bookmark label", currentLabel)?.trim();
    if (!label) {
      return;
    }

    void updateManual(bookmarkId, label);
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
