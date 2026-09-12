import { useNavigate } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";

import type {
  ActivitySessionLibraryItem,
  ActivitySessionLibraryQuery,
} from "~/main/modules/bookmarks";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  type MediaLibraryColumnDef,
  mediaLibraryTableFeatures,
} from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable.features";
import {
  type ServerMediaLibraryTableQueryInput,
  useServerMediaLibraryTableState,
} from "~/renderer/modules/media-library/MediaLibrary.hooks/useServerMediaLibraryTableState/useServerMediaLibraryTableState";
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
  isScopeReady?: boolean;
  scope: MediaLibraryScope;
}

function RewindsPanel({ isScopeReady = true, scope }: RewindsPanelProps) {
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
  const showLeagueColumn = scope.league === ALL_LEAGUES_VALUE;
  const createRewindQuery = useCallback(
    ({
      pagination,
      sorting,
    }: ServerMediaLibraryTableQueryInput): ActivitySessionLibraryQuery => {
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
    },
    [scope.game, scope.league],
  );
  const { handlePaginationChange, handleSortingChange, pagination, sorting } =
    useServerMediaLibraryTableState({
      createQuery: createRewindQuery,
      enabled: isScopeReady,
      initialSorting: [{ id: "startedAt", desc: true }],
      refresh,
      resetKey: `${scope.game}:${scope.league}`,
    });

  const handleRowClick = (rewind: ActivitySessionLibraryItem) => {
    void navigate({
      to: "/rewind/$rewindId",
      params: { rewindId: rewind.id },
    });
  };

  const columns = useMemo<
    MediaLibraryColumnDef<ActivitySessionLibraryItem>[]
  >(() => {
    const tableColumns: MediaLibraryColumnDef<ActivitySessionLibraryItem>[] = [
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
  const table = useTable({
    features: mediaLibraryTableFeatures,
    data: items,
    columns,
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
