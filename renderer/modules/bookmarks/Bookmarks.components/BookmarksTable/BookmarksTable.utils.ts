import clsx from "clsx";

import type {
  BookmarkLibraryItem,
  BookmarkLibrarySortKey,
} from "~/main/modules/bookmarks/Bookmarks.dto";

interface BookmarkTableContext {
  key: string;
  label: "Recording" | "Rewind";
}

interface BookmarkTableSeparator {
  nextLabel: BookmarkTableContext["label"];
  previousLabel: BookmarkTableContext["label"];
}

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

function resolveBookmarkTableContext(
  bookmark: Pick<
    BookmarkLibraryItem,
    "activeActivitySessionId" | "activeRecordingId" | "archivedRecordingId"
  >,
): BookmarkTableContext | null {
  const recordingId =
    bookmark.activeRecordingId ?? bookmark.archivedRecordingId;
  if (recordingId) {
    return { key: `recording:${recordingId}`, label: "Recording" };
  }

  if (bookmark.activeActivitySessionId) {
    return {
      key: `rewind:${bookmark.activeActivitySessionId}`,
      label: "Rewind",
    };
  }

  return null;
}

function resolveBookmarkTableSeparator(input: {
  previousBookmark: BookmarkLibraryItem;
  bookmark: BookmarkLibraryItem;
}): BookmarkTableSeparator | null {
  const previousContext = resolveBookmarkTableContext(input.previousBookmark);
  const nextContext = resolveBookmarkTableContext(input.bookmark);

  if (
    !previousContext ||
    !nextContext ||
    previousContext.key === nextContext.key
  ) {
    return null;
  }

  return {
    nextLabel: nextContext.label,
    previousLabel: previousContext.label,
  };
}

export type { BookmarkTableSeparator };
export {
  getCellClassName,
  getHeaderClassName,
  resolveBookmarkTableSeparator,
  resolveSortBy,
};
