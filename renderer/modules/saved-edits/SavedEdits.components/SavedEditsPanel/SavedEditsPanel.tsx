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
  SavedEditItem,
  SavedEditsLibraryQuery,
} from "~/main/modules/saved-edits";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  ALL_LEAGUES_VALUE,
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
  type MediaLibraryScope,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useSavedEditsShallow } from "~/renderer/store";

import { areSavedEditsLibraryQueriesEqual } from "../../SavedEdits.slice/SavedEdits.slice.utils";
import { SavedEditTableActions } from "../SavedEditTableActions/SavedEditTableActions";
import {
  getCellClassName,
  getHeaderClassName,
  resolveSortBy,
} from "./SavedEditsPanel.utils";

interface SavedEditsPanelProps {
  scope: MediaLibraryScope;
}

function SavedEditsPanel({ scope }: SavedEditsPanelProps) {
  const navigate = useNavigate();
  const { error, hydrateLibrary, items, libraryPage, libraryQuery } =
    useSavedEditsShallow((savedEdits) => ({
      error: savedEdits.error,
      hydrateLibrary: savedEdits.hydrateLibrary,
      items: savedEdits.items,
      libraryPage: savedEdits.libraryPage,
      libraryQuery: savedEdits.libraryQuery,
    }));
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const scopeKey = `${scope.game}:${scope.league}`;
  const [paginationScopeKey, setPaginationScopeKey] = useState(scopeKey);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const scopedPageIndex =
    paginationScopeKey === scopeKey ? pagination.pageIndex : 0;
  const scopedPagination = useMemo<PaginationState>(
    () => ({ ...pagination, pageIndex: scopedPageIndex }),
    [pagination, scopedPageIndex],
  );
  const query = useMemo<SavedEditsLibraryQuery>(() => {
    const activeSort = sorting[0];

    return {
      game: scope.game,
      ...(scope.league === ALL_LEAGUES_VALUE ? {} : { league: scope.league }),
      pageIndex: scopedPagination.pageIndex,
      pageSize: scopedPagination.pageSize,
      sortBy: resolveSortBy(activeSort?.id),
      sortDirection: activeSort?.desc === false ? "asc" : "desc",
    };
  }, [
    scopedPagination.pageIndex,
    scopedPagination.pageSize,
    scope.game,
    scope.league,
    sorting,
  ]);

  useEffect(() => {
    if (paginationScopeKey === scopeKey) {
      return;
    }

    setPaginationScopeKey(scopeKey);
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [paginationScopeKey, scopeKey]);

  useEffect(() => {
    void hydrateLibrary(query);
  }, [hydrateLibrary, query]);
  const hasCurrentLibraryPage =
    libraryQuery !== null &&
    areSavedEditsLibraryQueriesEqual(libraryQuery, query);
  const currentItems = hasCurrentLibraryPage ? items : [];
  const currentLibraryPage = hasCurrentLibraryPage ? libraryPage : null;

  useEffect(() => {
    if (!currentLibraryPage || paginationScopeKey !== scopeKey) {
      return;
    }

    const pageCount = Math.max(1, currentLibraryPage.pageCount);
    setPagination((current) =>
      current.pageIndex < pageCount
        ? current
        : { ...current, pageIndex: currentLibraryPage.pageIndex },
    );
  }, [currentLibraryPage, paginationScopeKey, scopeKey]);

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

  const handleRowClick = (edit: SavedEditItem) => {
    void navigate({ to: "/editor", search: { projectId: edit.id } });
  };

  const columns = useMemo<ColumnDef<SavedEditItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Name",
        cell: ({ getValue }) => (
          <span className="block truncate" title={getValue<string>()}>
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        accessorKey: "durationSeconds",
        header: "Length",
        cell: ({ getValue }) => formatDurationSeconds(getValue<number>()),
      },
      {
        accessorKey: "sizeBytes",
        header: "Size",
        cell: ({ getValue }) => formatBytes(getValue<number>()),
      },
      {
        accessorKey: "historyEditCount",
        header: "History",
        cell: ({ getValue }) => `${getValue<number>()} edits`,
      },
      {
        id: "actions",
        enableSorting: false,
        header: "Actions",
        cell: ({ row }) => <SavedEditTableActions edit={row.original} />,
      },
    ],
    [],
  );
  const table = useReactTable({
    data: currentItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: handlePaginationChange,
    onSortingChange: handleSortingChange,
    pageCount: currentLibraryPage?.pageCount ?? 1,
    rowCount: currentLibraryPage?.totalCount ?? currentItems.length,
    state: { pagination: scopedPagination, sorting },
  });

  return (
    <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg bg-base-200">
      <MediaLibraryTable
        emptyMessage="No saved edits yet."
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
        onRowClick={handleRowClick}
        table={table}
        totalCount={currentLibraryPage?.totalCount ?? currentItems.length}
      />
      {error && (
        <p className="m-0 shrink-0 border-base-content/10 border-t px-4 py-3 text-error text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

export { SavedEditsPanel };
