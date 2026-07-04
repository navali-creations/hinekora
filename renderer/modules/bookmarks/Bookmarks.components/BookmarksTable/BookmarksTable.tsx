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
  BookmarkCategory,
  BookmarkLibraryItem,
  BookmarkLibraryQuery,
} from "~/main/modules/bookmarks";
import { BookmarkCategoryBadge } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarkCategoryBadge/BookmarkCategoryBadge";
import type { BookmarksCategoryFilterValue } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksCategoryFilterChip/BookmarksCategoryFilterChip";
import { BookmarksCategoryFilterRow } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksCategoryFilterRow/BookmarksCategoryFilterRow";
import { BookmarksRecordingTimeCell } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksRecordingTimeCell/BookmarksRecordingTimeCell";
import { BookmarksTableActions } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksTableActions/BookmarksTableActions";
import {
  allBookmarkCategoriesValue,
  bookmarkCategoryLabels,
  bookmarkSourceLabels,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import { useMediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.hooks/useMediaLibraryScope/useMediaLibraryScope";
import {
  ALL_LEAGUES_VALUE,
  formatDateTime,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useBookmarksShallow } from "~/renderer/store";

import {
  getCellClassName,
  getHeaderClassName,
  resolveBookmarkTableSeparator,
  resolveSortBy,
} from "./BookmarksTable.utils";

const bookmarkTableSeparatorStyle = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px)",
};

function BookmarksTable() {
  const navigate = useNavigate();
  const { scope } = useMediaLibraryScope();
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
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "occurredAt", desc: true },
  ]);
  const showLeagueColumn = scope.league === ALL_LEAGUES_VALUE;
  const filterResetKey = `${category}:${scope.game}:${scope.league}`;
  const categoryOptions = useMemo(() => {
    const categories = new Set<BookmarkCategory>(availableCategories);
    if (category !== allBookmarkCategoriesValue) {
      categories.add(category);
    }

    return Array.from(categories).sort((left, right) =>
      bookmarkCategoryLabels[left].localeCompare(bookmarkCategoryLabels[right]),
    );
  }, [availableCategories, category]);
  const bookmarkQuery = useMemo<BookmarkLibraryQuery>(() => {
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
  }, [category, pagination, scope.game, scope.league, sorting]);

  useEffect(() => {
    if (!filterResetKey) {
      return;
    }

    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [filterResetKey]);

  useEffect(() => {
    void refresh(bookmarkQuery);
  }, [bookmarkQuery, refresh]);

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

  const handleCategorySelect = (nextCategory: BookmarksCategoryFilterValue) => {
    setCategory(nextCategory);
  };

  const renderBookmarkSeparatorBefore = ({
    previousRow,
    row,
  }: {
    previousRow: BookmarkLibraryItem;
    row: BookmarkLibraryItem;
  }) => {
    const separator = resolveBookmarkTableSeparator({
      previousBookmark: previousRow,
      bookmark: row,
    });

    if (!separator) {
      return null;
    }

    return (
      <div
        className="flex min-h-10 flex-col items-center justify-center gap-0.5 text-[10px] text-base-content/50 leading-none"
        style={bookmarkTableSeparatorStyle}
      >
        <span>Start of new {separator.nextLabel}</span>
        <span className="h-px w-24 bg-base-content/20" />
        <span>End of previous {separator.previousLabel}</span>
      </div>
    );
  };

  const canOpenBookmarkRecording = (bookmark: BookmarkLibraryItem) =>
    Boolean(bookmark.activeRecordingId);

  const handleOpenBookmarkRecording = (bookmark: BookmarkLibraryItem) => {
    if (!bookmark.activeRecordingId) {
      return;
    }

    void navigate({
      params: { recordingId: bookmark.activeRecordingId },
      search: { t: bookmark.activeRecordingOffsetSeconds ?? 0 },
      to: "/recording/$recordingId",
    });
  };

  const columns = useMemo<ColumnDef<BookmarkLibraryItem>[]>(() => {
    const tableColumns: ColumnDef<BookmarkLibraryItem>[] = [
      {
        accessorKey: "occurredAt",
        header: "Time",
        cell: ({ getValue }) => formatDateTime(getValue<string>()),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row, getValue }) => (
          <BookmarkCategoryBadge
            category={getValue<BookmarkCategory>()}
            subcategory={row.original.subcategory}
          />
        ),
      },
      {
        accessorKey: "label",
        header: "Label",
        cell: ({ row, getValue }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{getValue<string>()}</div>
            {row.original.sceneName && (
              <div className="truncate text-base-content/50 text-xs">
                {row.original.sceneName}
              </div>
            )}
          </div>
        ),
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
        accessorKey: "source",
        enableSorting: false,
        header: "Source",
        cell: ({ row }) => bookmarkSourceLabels[row.original.source],
      },
      {
        id: "recordingTime",
        enableSorting: false,
        header: "Recording Time",
        cell: ({ row }) => (
          <BookmarksRecordingTimeCell bookmark={row.original} />
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: "Actions",
        cell: ({ row }) => <BookmarksTableActions bookmark={row.original} />,
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
      <div className="shrink-0 border-base-content/10 border-b px-4 py-2">
        <BookmarksCategoryFilterRow
          categories={categoryOptions}
          selectedCategory={category}
          onSelectCategory={handleCategorySelect}
        />
      </div>
      <MediaLibraryTable
        canRowClick={canOpenBookmarkRecording}
        emptyMessage={
          isLoading
            ? "Loading bookmarks..."
            : "No bookmarks match this page filter."
        }
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
        onRowClick={handleOpenBookmarkRecording}
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
