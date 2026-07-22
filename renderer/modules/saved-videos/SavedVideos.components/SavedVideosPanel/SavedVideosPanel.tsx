import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo } from "react";

import type {
  SavedVideoItem,
  SavedVideosLibraryQuery,
} from "~/main/modules/saved-videos";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  type ServerMediaLibraryTableQueryInput,
  useServerMediaLibraryTableState,
} from "~/renderer/modules/media-library/MediaLibrary.hooks/useServerMediaLibraryTableState/useServerMediaLibraryTableState";
import {
  formatBytes,
  formatDateTime,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useSavedVideosShallow } from "~/renderer/store";

import { SavedVideoTableActions } from "../SavedVideoTableActions/SavedVideoTableActions";
import {
  getCellClassName,
  getHeaderClassName,
  resolveSortBy,
} from "./SavedVideosPanel.utils";

function SavedVideosPanel() {
  const { error, hydrateLibrary, items, libraryPage, openVideo } =
    useSavedVideosShallow((savedVideos) => ({
      error: savedVideos.error,
      hydrateLibrary: savedVideos.hydrateLibrary,
      items: savedVideos.items,
      libraryPage: savedVideos.libraryPage,
      openVideo: savedVideos.openVideo,
    }));
  const createQuery = useCallback(
    ({
      pagination,
      sorting,
    }: ServerMediaLibraryTableQueryInput): SavedVideosLibraryQuery => {
      const activeSort = sorting[0];
      return {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sortBy: resolveSortBy(activeSort?.id),
        sortDirection: activeSort?.desc === false ? "asc" : "desc",
      };
    },
    [],
  );
  const { handlePaginationChange, handleSortingChange, pagination, sorting } =
    useServerMediaLibraryTableState({
      createQuery,
      initialSorting: [{ desc: true, id: "savedAt" }],
      refresh: hydrateLibrary,
    });

  useEffect(() => {
    if (!libraryPage) {
      return;
    }
    handlePaginationChange((current) =>
      current.pageIndex < libraryPage.pageCount
        ? current
        : { ...current, pageIndex: libraryPage.pageIndex },
    );
  }, [handlePaginationChange, libraryPage]);

  const handleRowClick = (video: SavedVideoItem) => {
    void openVideo(video.id);
  };

  const columns = useMemo<ColumnDef<SavedVideoItem>[]>(
    () => [
      {
        accessorKey: "fileName",
        header: "Name",
        cell: ({ getValue }) => (
          <span className="block truncate" title={getValue<string>()}>
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "savedAt",
        header: "Saved",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
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
        cell: ({ row }) => <SavedVideoTableActions video={row.original} />,
      },
    ],
    [],
  );
  const table = useReactTable({
    columns,
    data: items,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: handlePaginationChange,
    onSortingChange: handleSortingChange,
    pageCount: libraryPage?.pageCount ?? 1,
    rowCount: libraryPage?.totalCount ?? items.length,
    state: { pagination, sorting },
  });

  return (
    <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg bg-base-200">
      <MediaLibraryTable
        emptyMessage="No saved edit videos yet."
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
        table={table}
        totalCount={libraryPage?.totalCount ?? items.length}
        onRowClick={handleRowClick}
      />
      {libraryPage?.isTruncated && (
        <p className="m-0 shrink-0 border-base-content/10 border-t px-4 py-3 text-info text-sm">
          Only part of this very large exports folder can be shown.
        </p>
      )}
      {error && (
        <p className="m-0 shrink-0 border-base-content/10 border-t px-4 py-3 text-error text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

export { SavedVideosPanel };
