import clsx from "clsx";

import type { ReplayClipLibrarySortKey } from "~/main/modules/replay-clips";

import type { ReplayClip } from "~/types";
import { hasPlayableClip } from "../../ReplayClips.utils/ReplayClips.utils";

function getHeaderClassName(columnId: string): string {
  return clsx(
    "sticky top-0 z-10 bg-base-200 text-base-content/55",
    columnId === "select" && "w-12 text-center",
    ["targetDurationSeconds", "sizeBytes", "actions"].includes(columnId) &&
      "text-right",
  );
}

function getCellClassName(columnId: string): string {
  return clsx(
    columnId === "name" && "max-w-0",
    columnId === "select" && "text-center",
    columnId === "sourceLeague" && "whitespace-nowrap",
    columnId === "createdAt" && "whitespace-nowrap",
    columnId === "targetDurationSeconds" && "text-right tabular-nums",
    columnId === "sizeBytes" && "text-right tabular-nums",
    columnId === "actions" && "text-right",
  );
}

function getRowClassName(clip: ReplayClip): string {
  return clsx(!hasPlayableClip(clip) && "text-base-content/45");
}

function resolveSortBy(columnId: string | undefined): ReplayClipLibrarySortKey {
  switch (columnId) {
    case "name":
    case "sourceLeague":
    case "targetDurationSeconds":
    case "sizeBytes":
    case "createdAt":
      return columnId;
    default:
      return "createdAt";
  }
}

export { getCellClassName, getHeaderClassName, getRowClassName, resolveSortBy };
