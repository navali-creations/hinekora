import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import type { BookmarkLibraryItem } from "~/main/modules/bookmarks";
import { BookmarkCategoryIcon } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarkCategoryIcon/BookmarkCategoryIcon";
import { BookmarksDurationCell } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksDurationCell/BookmarksDurationCell";
import { BookmarksRecordingTimeCell } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksRecordingTimeCell/BookmarksRecordingTimeCell";
import { BookmarksTableActions } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksTableActions/BookmarksTableActions";
import { formatDateTime } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

interface UseBookmarksTableColumnsInput {
  showLeagueColumn: boolean;
}

function useBookmarksTableColumns({
  showLeagueColumn,
}: UseBookmarksTableColumnsInput): ColumnDef<BookmarkLibraryItem>[] {
  return useMemo<ColumnDef<BookmarkLibraryItem>[]>(() => {
    const tableColumns: ColumnDef<BookmarkLibraryItem>[] = [
      {
        id: "categoryIcon",
        enableSorting: false,
        header: "",
        cell: ({ row }) => (
          <BookmarkCategoryIcon category={row.original.category} />
        ),
      },
      {
        accessorKey: "occurredAt",
        header: "Time",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        accessorKey: "label",
        header: "Label",
        cell: ({ row, getValue }) => (
          <div className="min-w-0">
            <div className="font-medium">{getValue<string>()}</div>
            {row.original.sceneName && (
              <div className="text-base-content/50 text-xs">
                {row.original.sceneName}
              </div>
            )}
          </div>
        ),
      },
    ];

    if (showLeagueColumn) {
      tableColumns.push({
        accessorKey: "sourceLeague",
        header: "League",
      });
    }

    tableColumns.push(
      {
        id: "duration",
        enableSorting: false,
        header: "Duration",
        cell: ({ row }) => <BookmarksDurationCell bookmark={row.original} />,
      },
      {
        id: "recordingTime",
        enableSorting: false,
        header: "Timestamp",
        cell: ({ row }) => (
          <BookmarksRecordingTimeCell bookmark={row.original} />
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: "Actions",
        cell: ({ row }) => <BookmarksTableActions bookmark={row.original} />,
      },
    );

    return tableColumns;
  }, [showLeagueColumn]);
}

export { useBookmarksTableColumns };
