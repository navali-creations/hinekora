import clsx from "clsx";

import type { SavedEditsLibrarySortKey } from "~/main/modules/saved-edits";

function getHeaderClassName(columnId: string): string {
  return clsx(
    "sticky top-0 z-10 bg-base-200 text-base-content/55",
    ["durationSeconds", "historyEditCount", "sizeBytes", "actions"].includes(
      columnId,
    ) && "text-right",
  );
}

function getCellClassName(columnId: string): string {
  return clsx(
    columnId === "title" && "max-w-0",
    ["createdAt", "updatedAt"].includes(columnId) && "whitespace-nowrap",
    ["durationSeconds", "historyEditCount", "sizeBytes"].includes(columnId) &&
      "text-right tabular-nums",
    columnId === "actions" && "text-right",
  );
}

function resolveSortBy(columnId: string | undefined): SavedEditsLibrarySortKey {
  switch (columnId) {
    case "createdAt":
    case "durationSeconds":
    case "historyEditCount":
    case "sizeBytes":
    case "title":
    case "updatedAt":
      return columnId;
    default:
      return "updatedAt";
  }
}

export { getCellClassName, getHeaderClassName, resolveSortBy };
