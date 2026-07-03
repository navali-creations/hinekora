import { useNavigate } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ActivitySessionLibraryItem,
  ActivitySessionLibraryPage,
  ActivitySessionLibraryQuery,
} from "~/main/modules/bookmarks";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  ALL_LEAGUES_VALUE,
  formatDateTime,
  formatDurationSeconds,
  type MediaLibraryScope,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import {
  getCellClassName,
  getHeaderClassName,
  resolveSortBy,
} from "./RewindsPanel.utils";

interface RewindsPanelProps {
  scope: MediaLibraryScope;
  onAvailableLeaguesChange: (leagues: string[]) => void;
}

function RewindsPanel({ scope, onAvailableLeaguesChange }: RewindsPanelProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState<ActivitySessionLibraryPage | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "startedAt", desc: true },
  ]);
  const previousScopeRef = useRef({
    game: scope.game,
    league: scope.league,
  });
  const showLeagueColumn = scope.league === ALL_LEAGUES_VALUE;
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
    let isActive = true;
    setError(null);
    setIsLoading(true);

    window.electron.bookmarks
      .listActivitySessions(query)
      .then((nextPage) => {
        if (!isActive) {
          return;
        }

        setPage(nextPage);
        onAvailableLeaguesChange(nextPage.availableLeagues);
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Rewinds failed",
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onAvailableLeaguesChange, query]);

  useEffect(() => {
    if (
      previousScopeRef.current.game === scope.game &&
      previousScopeRef.current.league === scope.league
    ) {
      return;
    }

    previousScopeRef.current = {
      game: scope.game,
      league: scope.league,
    };
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [scope.game, scope.league]);

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
  const items = page?.items ?? [];
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
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
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
