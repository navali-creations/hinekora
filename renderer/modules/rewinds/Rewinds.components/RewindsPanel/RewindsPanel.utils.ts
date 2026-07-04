import clsx from "clsx";

import type {
  ActivitySessionLibraryItem,
  ActivitySessionLibrarySortKey,
} from "~/main/modules/bookmarks";

function getHeaderClassName(columnId: string): string {
  return clsx(
    "sticky top-0 z-10 bg-base-200 text-base-content/55",
    columnId === "select" && "w-12 text-center",
    ["bookmarkCount", "clipCount", "durationSeconds"].includes(columnId) &&
      "text-right",
  );
}

function getCellClassName(columnId: string): string {
  return clsx(
    columnId === "select" && "text-center",
    columnId === "startedAt" && "whitespace-nowrap",
    columnId === "tableStatus" && "whitespace-nowrap",
    columnId === "sourceLeague" && "whitespace-nowrap",
    ["bookmarkCount", "clipCount", "durationSeconds"].includes(columnId) &&
      "text-right tabular-nums",
  );
}

function resolveSortBy(
  columnId: string | undefined,
): ActivitySessionLibrarySortKey {
  switch (columnId) {
    case "bookmarkCount":
    case "clipCount":
    case "durationSeconds":
    case "sourceLeague":
    case "startedAt":
      return columnId;
    default:
      return "startedAt";
  }
}

function canOpenRewindRow(row: ActivitySessionLibraryItem): boolean {
  return row.stoppedAt !== null;
}

function getRewindRowClassName(row: ActivitySessionLibraryItem): string {
  return clsx(
    !canOpenRewindRow(row) &&
      "bg-warning/5 text-base-content/55 hover:bg-warning/10",
  );
}

export {
  canOpenRewindRow,
  getCellClassName,
  getHeaderClassName,
  getRewindRowClassName,
  resolveSortBy,
};
