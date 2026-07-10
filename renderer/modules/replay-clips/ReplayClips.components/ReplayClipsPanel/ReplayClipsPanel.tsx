import { useNavigate } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import type {
  ReplayClipLibraryQuery,
  ReplayClipView,
} from "~/main/modules/replay-clips";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
  getPathFileName,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useReplayClipsShallow } from "~/renderer/store";

import { hasPlayableClip } from "../../ReplayClips.utils/ReplayClips.utils";
import { ReplayClipTableActions } from "../ReplayClipTableActions/ReplayClipTableActions";
import {
  getCellClassName,
  getHeaderClassName,
  getRowClassName,
  resolveSortBy,
} from "./ReplayClipsPanel.utils";

interface ReplayClipsPanelProps {
  query: ReplayClipLibraryQuery;
  queryKey: string;
  showLeagueColumn: boolean;
}

function ReplayClipsPanel({
  query,
  queryKey,
  showLeagueColumn,
}: ReplayClipsPanelProps) {
  const navigate = useNavigate();
  const {
    clearSelectedClips,
    hydrateLibrary,
    items,
    libraryPage,
    libraryError,
    rowSelection,
    setSelectedClipIds,
  } = useReplayClipsShallow((replayClips) => ({
    clearSelectedClips: replayClips.clearSelectedClips,
    hydrateLibrary: replayClips.hydrateLibrary,
    items: replayClips.libraryItems,
    libraryPage: replayClips.libraryPage,
    libraryError: replayClips.error,
    rowSelection: replayClips.selectedClipIds,
    setSelectedClipIds: replayClips.setSelectedClipIds,
  }));
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const libraryQuery = useMemo<ReplayClipLibraryQuery>(() => {
    const activeSort = sorting[0];

    return {
      ...query,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sortBy: resolveSortBy(activeSort?.id),
      sortDirection: activeSort?.desc === false ? "asc" : "desc",
    };
  }, [pagination.pageIndex, pagination.pageSize, query, sorting]);

  useEffect(() => {
    if (!queryKey) {
      return;
    }

    clearSelectedClips();
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [clearSelectedClips, queryKey]);

  useEffect(() => {
    void hydrateLibrary(libraryQuery);
  }, [hydrateLibrary, libraryQuery]);

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    clearSelectedClips();
    setPagination((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    setSelectedClipIds(
      typeof updater === "function" ? updater(rowSelection) : updater,
    );
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    clearSelectedClips();
    setPagination((current) => ({ ...current, pageIndex: 0 }));
    setSorting((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const handleRowClick = (clip: ReplayClipView) => {
    void navigate({ to: "/clip/$clipId", params: { clipId: clip.id } });
  };

  const columns = useMemo<ColumnDef<ReplayClipView>[]>(() => {
    const tableColumns: ColumnDef<ReplayClipView>[] = [
      {
        id: "select",
        enableSorting: false,
        header: ({ table }) => (
          <input
            aria-label="Select all clips on this page"
            checked={table.getIsAllPageRowsSelected()}
            className="checkbox checkbox-sm"
            type="checkbox"
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            aria-label={`Select clip ${row.original.id}`}
            checked={row.getIsSelected()}
            className="checkbox checkbox-sm"
            type="checkbox"
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
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
        accessorKey: "targetDurationSeconds",
        header: "Length",
        cell: ({ getValue }) => formatDurationSeconds(getValue<number>()),
      },
      {
        accessorKey: "sizeBytes",
        header: "Size",
        cell: ({ getValue }) => formatBytes(getValue<number>()),
      },
      {
        id: "name",
        accessorFn: (clip) => clip.fileName,
        header: "Name",
        cell: ({ getValue }) => {
          const path = getValue<string | null>();

          return (
            <span
              className="block truncate"
              title={path ?? "Clip is still processing"}
            >
              {getPathFileName(path)}
            </span>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: "Actions",
        cell: ({ row }) => <ReplayClipTableActions clip={row.original} />,
      },
    );

    return tableColumns;
  }, [showLeagueColumn]);
  const table = useReactTable({
    data: items,
    columns,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: handleSortingChange,
    pageCount: libraryPage?.pageCount ?? 1,
    rowCount: libraryPage?.totalCount ?? items.length,
    state: { pagination, rowSelection, sorting },
  });

  return (
    <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg bg-base-200">
      <MediaLibraryTable
        canRowClick={hasPlayableClip}
        emptyMessage="No clips match this page filter."
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
        getRowClassName={getRowClassName}
        onRowClick={handleRowClick}
        table={table}
        totalCount={libraryPage?.totalCount ?? items.length}
      />
      {libraryError && (
        <p className="m-0 shrink-0 border-base-content/10 border-t px-4 py-3 text-error text-sm">
          {libraryError}
        </p>
      )}
    </section>
  );
}

export { ReplayClipsPanel };
