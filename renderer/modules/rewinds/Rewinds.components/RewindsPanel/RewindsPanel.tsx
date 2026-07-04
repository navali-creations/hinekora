import { useNavigate } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import type {
  ActivitySessionLibraryItem,
  ActivitySessionLibraryQuery,
} from "~/main/modules/bookmarks";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  ALL_LEAGUES_VALUE,
  formatDateTime,
  formatDurationSeconds,
  type MediaLibraryScope,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useRewindsShallow } from "~/renderer/store";

import {
  canOpenRewindRow,
  getCellClassName,
  getHeaderClassName,
  getRewindRowClassName,
  resolveSortBy,
} from "./RewindsPanel.utils";

interface RewindsPanelProps {
  scope: MediaLibraryScope;
}

function RewindsPanel({ scope }: RewindsPanelProps) {
  const navigate = useNavigate();
  const { error, isLoading, items, page, refresh } = useRewindsShallow(
    (rewinds) => ({
      error: rewinds.error,
      isLoading: rewinds.isLoading,
      items: rewinds.items,
      page: rewinds.page,
      refresh: rewinds.refresh,
    }),
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "startedAt", desc: true },
  ]);
  const showLeagueColumn = scope.league === ALL_LEAGUES_VALUE;
  const filterResetKey = `${scope.game}:${scope.league}`;
  const query = useMemo<ActivitySessionLibraryQuery>(() => {
    const activeSort = sorting[0];
    const nextQuery: ActivitySessionLibraryQuery = {
      game: scope.game,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sortBy: resolveSortBy(activeSort?.id),
      sortDirection: activeSort?.desc === false ? "asc" : "desc",
    };
    if (scope.league !== ALL_LEAGUES_VALUE) {
      nextQuery.league = scope.league;
    }

    return nextQuery;
  }, [pagination, scope.game, scope.league, sorting]);

  useEffect(() => {
    void refresh(query);
  }, [query, refresh]);

  useEffect(() => {
    if (!filterResetKey) {
      return;
    }

    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [filterResetKey]);

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setPagination((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
    setSorting((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const handleRowClick = (rewind: ActivitySessionLibraryItem) => {
    void navigate({
      to: "/rewind/$rewindId",
      params: { rewindId: rewind.id },
    });
  };

  const columns = useMemo<ColumnDef<ActivitySessionLibraryItem>[]>(() => {
    const tableColumns: ColumnDef<ActivitySessionLibraryItem>[] = [
      {
        accessorKey: "startedAt",
        header: "Started",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        id: "tableStatus",
        enableSorting: false,
        header: "Status",
        cell: ({ row }) => (
          <span
            className={
              row.original.stoppedAt === null
                ? "badge badge-warning badge-xs"
                : "badge badge-success badge-xs"
            }
          >
            {row.original.stoppedAt === null ? "Processing" : "Saved"}
          </span>
        ),
      },
      {
        accessorKey: "durationSeconds",
        header: "Length",
        cell: ({ getValue }) =>
          formatDurationSeconds(getValue<number | null>()),
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
        accessorKey: "bookmarkCount",
        header: "Bookmarks",
      },
      {
        accessorKey: "clipCount",
        header: "Clips",
      },
    );

    return tableColumns;
  }, [showLeagueColumn]);
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: handlePaginationChange,
    onSortingChange: handleSortingChange,
    pageCount: page?.pageCount ?? 1,
    rowCount: page?.totalCount ?? items.length,
    state: { pagination, sorting },
  });

  return (
    <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg bg-base-200">
      <MediaLibraryTable
        emptyMessage={
          isLoading
            ? "Loading rewinds..."
            : "No rewind sessions match this page filter."
        }
        canRowClick={canOpenRewindRow}
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
        getRowClassName={getRewindRowClassName}
        table={table}
        totalCount={page?.totalCount ?? items.length}
        onRowClick={handleRowClick}
      />
      {error && (
        <p className="m-0 shrink-0 border-base-content/10 border-t px-4 py-3 text-error text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

export { RewindsPanel };
