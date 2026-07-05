import { useNavigate } from "@tanstack/react-router";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

import type {
  BookmarkCategory,
  BookmarkLibraryItem,
  BookmarkLibraryQuery,
} from "~/main/modules/bookmarks";
import type { BookmarksCategoryFilterValue } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksCategoryFilterChip/BookmarksCategoryFilterChip";
import { BookmarksCategoryFilterRow } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksCategoryFilterRow/BookmarksCategoryFilterRow";
import {
  allBookmarkCategoriesValue,
  bookmarkCategoryLabels,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  type ServerMediaLibraryTableQueryInput,
  useServerMediaLibraryTableState,
} from "~/renderer/modules/media-library/MediaLibrary.hooks/useServerMediaLibraryTableState/useServerMediaLibraryTableState";
import {
  ALL_LEAGUES_VALUE,
  type MediaLibraryScope,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useBookmarksShallow } from "~/renderer/store";

import { BookmarksTableSeparator } from "../BookmarksTableSeparator/BookmarksTableSeparator";
import {
  getCellClassName,
  getHeaderClassName,
  getRowClassName,
  resolveBookmarkLibraryTarget,
  resolveBookmarkTableSeparator,
  resolveSortBy,
} from "./BookmarksTable.utils";
import { useBookmarksTableColumns } from "./useBookmarksTableColumns/useBookmarksTableColumns";

interface BookmarksTableProps {
  scope: MediaLibraryScope;
}

function BookmarksTable({ scope }: BookmarksTableProps) {
  const navigate = useNavigate();
  const { availableCategories, error, isLoading, items, page, refresh } =
    useBookmarksShallow((bookmarks) => ({
      availableCategories: bookmarks.availableCategories,
      error: bookmarks.error,
      isLoading: bookmarks.isLoading,
      items: bookmarks.items,
      page: bookmarks.page,
      refresh: bookmarks.refresh,
    }));
  const [category, setCategory] = useState<BookmarksCategoryFilterValue>(
    allBookmarkCategoriesValue,
  );
  const showLeagueColumn = scope.league === ALL_LEAGUES_VALUE;
  const categoryOptions = useMemo(() => {
    const categories = new Set<BookmarkCategory>(availableCategories);
    if (category !== allBookmarkCategoriesValue) {
      categories.add(category);
    }

    return Array.from(categories).sort((left, right) =>
      bookmarkCategoryLabels[left].localeCompare(bookmarkCategoryLabels[right]),
    );
  }, [availableCategories, category]);
  const createBookmarkQuery = useCallback(
    ({
      pagination,
      sorting,
    }: ServerMediaLibraryTableQueryInput): BookmarkLibraryQuery => {
      const activeSort = sorting[0];
      const query: BookmarkLibraryQuery = {
        game: scope.game,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sortBy: resolveSortBy(activeSort?.id),
        sortDirection: activeSort?.desc === false ? "asc" : "desc",
      };
      if (scope.league !== ALL_LEAGUES_VALUE) {
        query.league = scope.league;
      }
      if (category !== allBookmarkCategoriesValue) {
        query.category = category;
      }

      return query;
    },
    [category, scope.game, scope.league],
  );
  const { handlePaginationChange, handleSortingChange, pagination, sorting } =
    useServerMediaLibraryTableState({
      createQuery: createBookmarkQuery,
      initialSorting: [{ id: "occurredAt", desc: true }],
      refresh,
      resetKey: `${scope.game}:${scope.league}:${category}`,
    });

  const handleCategorySelect = (nextCategory: BookmarksCategoryFilterValue) => {
    setCategory(nextCategory);
  };

  const canShowContextSeparators = sorting[0]?.id === "occurredAt";
  const sortDirection = sorting[0]?.desc === false ? "asc" : "desc";

  const renderBookmarkSeparatorBefore = ({
    previousRow,
    row,
  }: {
    previousRow: BookmarkLibraryItem;
    row: BookmarkLibraryItem;
  }) => {
    if (!canShowContextSeparators) {
      return null;
    }

    const separator = resolveBookmarkTableSeparator({
      previousBookmark: previousRow,
      bookmark: row,
      sortDirection,
    });

    if (!separator) {
      return null;
    }

    return <BookmarksTableSeparator separator={separator} />;
  };

  const canOpenBookmarkTarget = (bookmark: BookmarkLibraryItem) => {
    const target = resolveBookmarkLibraryTarget(bookmark);
    return target?.kind === "recording" || target?.kind === "rewind";
  };

  const handleOpenBookmarkTarget = (bookmark: BookmarkLibraryItem) => {
    const target = resolveBookmarkLibraryTarget(bookmark);
    if (target?.kind === "recording") {
      void navigate({
        params: { recordingId: target.id },
        search: { t: target.offsetSeconds ?? 0 },
        to: "/recording/$recordingId",
      });
      return;
    }

    if (target?.kind === "rewind") {
      void navigate({
        params: { rewindId: target.id },
        search: { t: target.offsetSeconds ?? 0 },
        to: "/rewind/$rewindId",
      });
    }
  };

  const columns = useBookmarksTableColumns({ showLeagueColumn });
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
      <div className="shrink-0 border-base-content/10 border-b px-4 py-2">
        <BookmarksCategoryFilterRow
          categories={categoryOptions}
          selectedCategory={category}
          onSelectCategory={handleCategorySelect}
        />
      </div>
      <MediaLibraryTable
        canRowClick={canOpenBookmarkTarget}
        emptyMessage={
          isLoading
            ? "Loading bookmarks..."
            : "No bookmarks match this page filter."
        }
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
        getRowClassName={getRowClassName}
        onRowClick={handleOpenBookmarkTarget}
        renderRowSeparatorBefore={renderBookmarkSeparatorBefore}
        table={table}
        totalCount={page?.totalCount ?? items.length}
      />
      {error && (
        <p className="m-0 shrink-0 border-base-content/10 border-t px-4 py-3 text-error text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

export { BookmarksTable };
