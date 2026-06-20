import clsx from "clsx";

import type { RunRecordingLibrarySortKey } from "~/main/modules/recording-storage/RecordingStorage.dto";

function getHeaderClassName(columnId: string): string {
  return clsx(
    "sticky top-0 z-10 bg-base-200 text-base-content/55",
    columnId === "select" && "w-12 text-center",
    ["durationSeconds", "sizeBytes", "actions"].includes(columnId) &&
      "text-right",
  );
}

function getCellClassName(columnId: string): string {
  return clsx(
    columnId === "fileName" && "max-w-0",
    columnId === "select" && "text-center",
    columnId === "sourceLeague" && "whitespace-nowrap",
    columnId === "createdAt" && "whitespace-nowrap",
    columnId === "durationSeconds" && "text-right tabular-nums",
    columnId === "sizeBytes" && "text-right tabular-nums",
    columnId === "actions" && "text-right",
  );
}

function resolveSortBy(
  columnId: string | undefined,
): RunRecordingLibrarySortKey {
  switch (columnId) {
    case "durationSeconds":
    case "fileName":
    case "sizeBytes":
    case "sourceLeague":
    case "createdAt":
      return columnId;
    default:
      return "createdAt";
  }
}

export { getCellClassName, getHeaderClassName, resolveSortBy };
