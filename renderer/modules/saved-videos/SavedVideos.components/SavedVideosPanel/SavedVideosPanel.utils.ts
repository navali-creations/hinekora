import clsx from "clsx";

import type { SavedVideosLibrarySortKey } from "~/main/modules/saved-videos";

function getHeaderClassName(columnId: string): string {
  return clsx(
    "sticky top-0 z-10 bg-base-200 text-base-content/55",
    ["sizeBytes", "actions"].includes(columnId) && "text-right",
  );
}

function getCellClassName(columnId: string): string {
  return clsx(
    columnId === "fileName" && "max-w-0",
    columnId === "savedAt" && "whitespace-nowrap",
    columnId === "sizeBytes" && "text-right tabular-nums",
    columnId === "actions" && "text-right",
  );
}

function resolveSortBy(
  columnId: string | undefined,
): SavedVideosLibrarySortKey {
  switch (columnId) {
    case "fileName":
    case "savedAt":
    case "sizeBytes":
      return columnId;
    default:
      return "savedAt";
  }
}

export { getCellClassName, getHeaderClassName, resolveSortBy };
