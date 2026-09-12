import { useTable } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo } from "react";

import type {
  SavedVideoItem,
  SavedVideosLibraryQuery,
} from "~/main/modules/saved-videos";
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
  const {
    error,
    hydrateLibrary,
    isLoading,
    items,
    libraryPage,
    openVideo,
    refreshLibrary,
  } = useSavedVideosShallow((savedVideos) => ({
    error: savedVideos.error,
    hydrateLibrary: savedVideos.hydrateLibrary,
    isLoading: savedVideos.isLoading,
    items: savedVideos.items,
    libraryPage: savedVideos.libraryPage,
    openVideo: savedVideos.openVideo,
    refreshLibrary: savedVideos.refreshLibrary,
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

  const handleRetry = () => {
    void refreshLibrary();
  };

  const columns = useMemo<MediaLibraryColumnDef<SavedVideoItem>[]>(
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
  const table = useTable({
    features: mediaLibraryTableFeatures,
    columns,
    data: items,
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
        emptyMessage={
          isLoading && libraryPage === null
            ? "Loading saved videos..."
            : "No saved edit videos yet."
        }
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
        <div className="flex shrink-0 items-center justify-between gap-3 border-base-content/10 border-t px-4 py-2 text-error text-sm">
          <p className="m-0">{error}</p>
          <button
            className="btn btn-error btn-outline btn-xs"
            disabled={isLoading}
            type="button"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}

export { SavedVideosPanel };
