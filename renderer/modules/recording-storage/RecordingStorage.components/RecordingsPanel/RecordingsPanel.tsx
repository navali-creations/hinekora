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
  RunRecordingItem,
  RunRecordingLibraryQuery,
} from "~/main/modules/recording-storage/RecordingStorage.dto";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  ALL_LEAGUES_VALUE,
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
  type MediaLibraryScope,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useRecordingStorageShallow } from "~/renderer/store";

import { RecordingTableActions } from "../RecordingTableActions/RecordingTableActions";
import {
  getCellClassName,
  getHeaderClassName,
  resolveSortBy,
} from "./RecordingsPanel.utils";

interface RecordingsPanelProps {
  scope: MediaLibraryScope;
}

function RecordingsPanel({ scope }: RecordingsPanelProps) {
  const navigate = useNavigate();
  const {
    clearSelectedRecordings,
    recordingsPage,
    recordings,
    refreshRecordings,
    rowSelection,
    setSelectedRecordingIds,
    storageError,
  } = useRecordingStorageShallow((recordingStorage) => ({
    clearSelectedRecordings: recordingStorage.clearSelectedRecordings,
    recordingsPage: recordingStorage.recordingsPage,
    recordings: recordingStorage.recordings,
    refreshRecordings: recordingStorage.refreshRecordings,
    rowSelection: recordingStorage.selectedRecordingIds,
    setSelectedRecordingIds: recordingStorage.setSelectedRecordingIds,
    storageError: recordingStorage.error,
  }));
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const showLeagueColumn = scope.league === ALL_LEAGUES_VALUE;
  const recordingQuery = useMemo<RunRecordingLibraryQuery>(() => {
    const activeSort = sorting[0];
    const query: RunRecordingLibraryQuery = {
      game: scope.game,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sortBy: resolveSortBy(activeSort?.id),
      sortDirection: activeSort?.desc === false ? "asc" : "desc",
    };
    if (scope.league !== ALL_LEAGUES_VALUE) {
      query.league = scope.league;
    }

    return query;
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    scope.game,
    scope.league,
    sorting,
  ]);

  useEffect(() => {
    void refreshRecordings(recordingQuery);
  }, [recordingQuery, refreshRecordings]);

  useEffect(() => {
    if (!scope.game || !scope.league) {
      return;
    }

    clearSelectedRecordings();
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [clearSelectedRecordings, scope.game, scope.league]);

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    clearSelectedRecordings();
    setPagination((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    setSelectedRecordingIds(
      typeof updater === "function" ? updater(rowSelection) : updater,
    );
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    clearSelectedRecordings();
    setPagination((current) => ({ ...current, pageIndex: 0 }));
    setSorting((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const handleRowClick = (recording: RunRecordingItem) => {
    void navigate({
      to: "/recording/$recordingId",
      params: { recordingId: recording.id },
    });
  };

  const columns = useMemo<ColumnDef<RunRecordingItem>[]>(() => {
    const tableColumns: ColumnDef<RunRecordingItem>[] = [
      {
        id: "select",
        enableSorting: false,
        header: ({ table }) => (
          <input
            aria-label="Select all recordings on this page"
            checked={table.getIsAllPageRowsSelected()}
            className="checkbox checkbox-sm"
            type="checkbox"
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            aria-label={`Select recording ${row.original.fileName}`}
            checked={row.getIsSelected()}
            className="checkbox checkbox-sm"
            type="checkbox"
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      {
        accessorKey: "fileName",
        header: "Name",
        cell: ({ row, getValue }) => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate" title={row.original.path}>
              {getValue<string>()}
            </span>
            {!row.original.exists && (
              <span className="badge badge-error badge-xs">Missing</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Saved",
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
        accessorKey: "durationSeconds",
        header: "Length",
        cell: ({ getValue }) =>
          formatDurationSeconds(getValue<number | null>()),
      },
      {
        accessorKey: "sizeBytes",
        header: "Size",
        cell: ({ getValue }) => formatBytes(getValue<number>()),
      },
      {
        id: "actions",
        enableSorting: false,
        header: "Actions",
        cell: ({ row }) => <RecordingTableActions recording={row.original} />,
      },
    );

    return tableColumns;
  }, [showLeagueColumn]);
  const table = useReactTable({
    data: recordings,
    columns,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: handleSortingChange,
    pageCount: recordingsPage?.pageCount ?? 1,
    rowCount: recordingsPage?.totalCount ?? recordings.length,
    state: { pagination, rowSelection, sorting },
  });

  return (
    <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg bg-base-200">
      <MediaLibraryTable
        emptyMessage="No recordings match this page filter."
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
        onRowClick={handleRowClick}
        table={table}
        totalCount={recordingsPage?.totalCount ?? recordings.length}
      />
      {storageError && (
        <p className="m-0 shrink-0 border-base-content/10 border-t px-4 py-3 text-error text-sm">
          {storageError}
        </p>
      )}
    </section>
  );
}

export { RecordingsPanel };
