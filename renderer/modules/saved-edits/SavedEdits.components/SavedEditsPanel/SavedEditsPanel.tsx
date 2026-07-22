import { useNavigate } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo } from "react";

import type {
  SavedEditItem,
  SavedEditsLibraryQuery,
} from "~/main/modules/saved-edits";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  type ServerMediaLibraryTableQueryInput,
  useServerMediaLibraryTableState,
} from "~/renderer/modules/media-library/MediaLibrary.hooks/useServerMediaLibraryTableState/useServerMediaLibraryTableState";
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
  isScopeReady?: boolean;
  scope: MediaLibraryScope;
}

function SavedEditsPanel({ isScopeReady = true, scope }: SavedEditsPanelProps) {
  const navigate = useNavigate();
  const { error, hydrateLibrary, items, libraryPage, libraryQuery } =
    useSavedEditsShallow((savedEdits) => ({
      error: savedEdits.error,
      hydrateLibrary: savedEdits.hydrateLibrary,
      items: savedEdits.items,
      libraryPage: savedEdits.libraryPage,
      libraryQuery: savedEdits.libraryQuery,
    }));
  const scopeKey = `${scope.game}:${scope.league}`;
  const createQuery = useCallback(
    ({
      pagination,
      sorting,
    }: ServerMediaLibraryTableQueryInput): SavedEditsLibraryQuery => {
      const activeSort = sorting[0];

      return {
        game: scope.game,
        ...(scope.league === ALL_LEAGUES_VALUE ? {} : { league: scope.league }),
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sortBy: resolveSortBy(activeSort?.id),
        sortDirection: activeSort?.desc === false ? "asc" : "desc",
      };
    },
    [scope.game, scope.league],
  );
  const {
    handlePaginationChange,
    handleSortingChange,
    pagination,
    query,
    sorting,
  } = useServerMediaLibraryTableState({
    createQuery,
    enabled: isScopeReady,
    initialSorting: [{ desc: true, id: "updatedAt" }],
    refresh: hydrateLibrary,
    resetKey: scopeKey,
  });
  const hasCurrentLibraryPage =
    libraryQuery !== null &&
    areSavedEditsLibraryQueriesEqual(libraryQuery, query);
  const currentItems = hasCurrentLibraryPage ? items : [];
  const currentLibraryPage = hasCurrentLibraryPage ? libraryPage : null;

  useEffect(() => {
    if (!currentLibraryPage) {
      return;
    }

    const pageCount = Math.max(1, currentLibraryPage.pageCount);
    handlePaginationChange((current) =>
      current.pageIndex < pageCount
        ? current
        : { ...current, pageIndex: currentLibraryPage.pageIndex },
    );
  }, [currentLibraryPage, handlePaginationChange]);

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
    state: { pagination, sorting },
  });

  return (
    <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg bg-base-200">
      <MediaLibraryTable
        emptyMessage="No draft edits yet."
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
