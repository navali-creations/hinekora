import {
  flexRender,
  type Header,
  type Row,
  type Table,
} from "@tanstack/react-table";
import clsx from "clsx";
import {
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  FiChevronDown as ChevronDown,
  FiChevronUp as ChevronUp,
} from "react-icons/fi";

import { MediaLibraryTablePagination } from "../MediaLibraryTablePagination/MediaLibraryTablePagination";
import { isInteractiveTableTarget } from "./MediaLibraryTable.utils";

interface MediaLibraryTableProps<TData> {
  table: Table<TData>;
  canRowClick?: (row: TData) => boolean;
  emptyMessage: string;
  getHeaderClassName: (columnId: string) => string;
  getCellClassName: (columnId: string) => string;
  getRowClassName?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  pinnedTopRowCount?: number;
  renderPinnedTopRows?: () => ReactNode;
  renderRowSeparatorBefore?: (input: {
    previousRow: TData;
    row: TData;
  }) => ReactNode;
  totalCount: number;
}

function MediaLibraryTable<TData>({
  table,
  canRowClick,
  emptyMessage,
  getHeaderClassName,
  getCellClassName,
  getRowClassName,
  onRowClick,
  pinnedTopRowCount = 0,
  renderPinnedTopRows,
  renderRowSeparatorBefore,
  totalCount,
}: MediaLibraryTableProps<TData>) {
  const pinnedTopRows = renderPinnedTopRows?.() ?? null;
  const renderHeaderContent = (header: Header<TData, unknown>) => {
    if (header.isPlaceholder) {
      return null;
    }

    const content = flexRender(
      header.column.columnDef.header,
      header.getContext(),
    );
    if (!header.column.getCanSort()) {
      return content;
    }

    return (
      <button
        className={clsx(
          "flex w-full cursor-pointer items-center gap-1",
          [
            "actions",
            "bookmarkCount",
            "clipCount",
            "durationSeconds",
            "historyEditCount",
            "sizeBytes",
            "targetDurationSeconds",
          ].includes(header.column.id) && "justify-end",
        )}
        type="button"
        onClick={header.column.getToggleSortingHandler()}
      >
        {content}
        {header.column.getIsSorted() === "asc" ? (
          <ChevronUp size={14} />
        ) : (
          <ChevronDown
            className={clsx(header.column.getIsSorted() || "opacity-40")}
            size={14}
          />
        )}
      </button>
    );
  };

  const isRowClickable = (row: Row<TData>) =>
    Boolean(onRowClick && (!canRowClick || canRowClick(row.original)));

  const handleRowClick =
    (row: Row<TData>) => (event: MouseEvent<HTMLTableRowElement>) => {
      if (
        !onRowClick ||
        !isRowClickable(row) ||
        isInteractiveTableTarget(event.target)
      ) {
        return;
      }

      onRowClick(row.original);
    };

  const handleRowKeyDown =
    (row: Row<TData>) => (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (
        !onRowClick ||
        !isRowClickable(row) ||
        isInteractiveTableTarget(event.target) ||
        (event.key !== "Enter" && event.key !== " ")
      ) {
        return;
      }

      event.preventDefault();
      onRowClick(row.original);
    };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto rounded-lg [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-base-300 [&::-webkit-scrollbar-track]:bg-base-100">
        <table className="table table-sm bg-base-200">
          <thead className="sticky top-0 z-20 bg-base-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className={clsx(
                      "sticky top-0 z-20 bg-base-200",
                      getHeaderClassName(header.column.id),
                    )}
                    key={header.id}
                  >
                    {renderHeaderContent(header)}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {pinnedTopRows}
            {table.getRowModel().rows.map((row, rowIndex, rows) => {
              const previousRow = rows[rowIndex - 1] ?? null;
              const separator =
                previousRow && renderRowSeparatorBefore
                  ? renderRowSeparatorBefore({
                      previousRow: previousRow.original,
                      row: row.original,
                    })
                  : null;

              return (
                <Fragment key={row.id}>
                  {separator && (
                    <tr aria-hidden="true">
                      <td
                        className="border-base-content/10 border-y bg-base-300/60 p-0"
                        colSpan={table.getAllLeafColumns().length}
                      >
                        {separator}
                      </td>
                    </tr>
                  )}
                  <tr
                    className={clsx(
                      "border-base-content/10 border-b outline-none transition-colors last:border-b-0 hover:bg-base-content/[0.03] focus:outline-none",
                      isRowClickable(row) &&
                        "cursor-pointer focus:bg-base-content/[0.04]",
                      getRowClassName?.(row.original),
                    )}
                    role={isRowClickable(row) ? "button" : undefined}
                    tabIndex={isRowClickable(row) ? 0 : undefined}
                    onClick={handleRowClick(row)}
                    onKeyDown={handleRowKeyDown(row)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        className={getCellClassName(cell.column.id)}
                        key={cell.id}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
            {table.getRowModel().rows.length === 0 && !pinnedTopRows && (
              <tr>
                <td
                  className="py-8 text-center text-base-content/55"
                  colSpan={table.getAllLeafColumns().length}
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <MediaLibraryTablePagination
        pinnedRowCount={pinnedTopRowCount}
        table={table}
        totalCount={totalCount}
      />
    </div>
  );
}

export { MediaLibraryTable };
