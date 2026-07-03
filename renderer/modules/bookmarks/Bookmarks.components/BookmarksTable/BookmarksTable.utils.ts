import clsx from "clsx";

import type { BookmarkLibrarySortKey } from "~/main/modules/bookmarks/Bookmarks.dto";

function getHeaderClassName(columnId: string): string {
  return clsx(
    "sticky top-0 z-10 bg-base-200 text-base-content/55",
    ["actions", "recordingTime"].includes(columnId) && "text-right",
  );
}

function getCellClassName(columnId: string): string {
  return clsx(
    columnId === "occurredAt" && "whitespace-nowrap",
    columnId === "category" && "whitespace-nowrap",
    columnId === "label" && "max-w-0",
    columnId === "sourceLeague" && "whitespace-nowrap",
    columnId === "source" && "capitalize",
    columnId === "recordingTime" && "text-right tabular-nums",
    columnId === "actions" && "text-right",
  );
}

function resolveSortBy(columnId: string | undefined): BookmarkLibrarySortKey {
  switch (columnId) {
    case "category":
    case "label":
    case "occurredAt":
    case "sourceLeague":
      return columnId;
    default:
      return "occurredAt";
  }
}

export { getCellClassName, getHeaderClassName, resolveSortBy };
