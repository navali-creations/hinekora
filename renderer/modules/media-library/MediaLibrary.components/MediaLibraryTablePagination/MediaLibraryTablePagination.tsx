import type { RowData } from "@tanstack/react-table";
import {
  FiChevronLeft as ChevronLeft,
  FiChevronRight as ChevronRight,
  FiChevronsLeft as ChevronsLeft,
  FiChevronsRight as ChevronsRight,
} from "react-icons/fi";

import type { MediaLibraryReactTable } from "../MediaLibraryTable/MediaLibraryTable.features";

const paginationButtonClass =
  "btn btn-ghost btn-sm border-0 shadow-none focus-visible:bg-base-300 focus-visible:outline-none";

interface MediaLibraryTablePaginationProps<TData extends RowData> {
  pinnedRowCount?: number;
  table: MediaLibraryReactTable<TData>;
  totalCount: number;
}

function MediaLibraryTablePagination<TData extends RowData>({
  pinnedRowCount = 0,
  table,
  totalCount,
}: MediaLibraryTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const displayTotalCount = totalCount + pinnedRowCount;
  const pageRowCount = table.getRowModel().rows.length + pinnedRowCount;
  const startRow = displayTotalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow =
    displayTotalCount === 0
      ? 0
      : Math.min(displayTotalCount, startRow + pageRowCount - 1);

  const handleFirstPage = () => {
    table.setPageIndex(0);
  };

  const handlePreviousPage = () => {
    table.previousPage();
  };

  const handleNextPage = () => {
    table.nextPage();
  };

  const handleLastPage = () => {
    table.setPageIndex(pageCount - 1);
  };

  return (
    <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-2 border-base-300 border-t bg-base-200 px-3 py-2">
      <div className="text-base-content/70 text-sm">
        Showing {startRow} to {endRow} of {displayTotalCount} results
      </div>
      <div className="no-drag flex items-center gap-0.5">
        <button
          aria-label="First page"
          className={paginationButtonClass}
          disabled={!table.getCanPreviousPage()}
          type="button"
          onClick={handleFirstPage}
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          aria-label="Previous page"
          className={paginationButtonClass}
          disabled={!table.getCanPreviousPage()}
          type="button"
          onClick={handlePreviousPage}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex h-8 min-w-28 items-center justify-center px-3 text-sm">
          Page {Math.min(pageIndex + 1, pageCount)} of {pageCount}
        </div>
        <button
          aria-label="Next page"
          className={paginationButtonClass}
          disabled={!table.getCanNextPage()}
          type="button"
          onClick={handleNextPage}
        >
          <ChevronRight size={16} />
        </button>
        <button
          aria-label="Last page"
          className={paginationButtonClass}
          disabled={!table.getCanNextPage()}
          type="button"
          onClick={handleLastPage}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

export { MediaLibraryTablePagination };
