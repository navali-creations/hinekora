import { describe, expect, it } from "vitest";

import type { BookmarkLibraryItem } from "~/main/modules/bookmarks";

import { resolveBookmarkTableSeparator } from "./BookmarksTable.utils";

function createBookmarkLibraryItem(
  input: Partial<BookmarkLibraryItem>,
): BookmarkLibraryItem {
  return {
    activeActivitySessionId: null,
    activeActivitySessionOffsetSeconds: null,
    activeRecordingDurationSeconds: null,
    activeRecordingId: null,
    activeRecordingOffsetSeconds: null,
    archivedRecordingDurationSeconds: null,
    archivedRecordingId: null,
    archivedRecordingTitle: null,
    category: "map",
    createdAt: "2026-07-04T00:00:00.000Z",
    id: "bookmark",
    label: "Location",
    note: null,
    occurredAt: "2026-07-04T00:00:00.000Z",
    sceneName: "Location",
    source: "client-log",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    subcategory: null,
    updatedAt: "2026-07-04T00:00:00.000Z",
    ...input,
  };
}

describe("BookmarksTable utils", () => {
  it("does not separate rows from the same recording", () => {
    expect(
      resolveBookmarkTableSeparator({
        previousBookmark: createBookmarkLibraryItem({
          activeRecordingId: "recording-1",
          id: "bookmark-1",
        }),
        bookmark: createBookmarkLibraryItem({
          activeRecordingId: "recording-1",
          id: "bookmark-2",
        }),
      }),
    ).toBeNull();
  });

  it("separates rows when the owning recording or rewind changes", () => {
    expect(
      resolveBookmarkTableSeparator({
        previousBookmark: createBookmarkLibraryItem({
          activeRecordingId: "recording-1",
          id: "bookmark-1",
        }),
        bookmark: createBookmarkLibraryItem({
          activeActivitySessionId: "rewind-1",
          id: "bookmark-2",
        }),
      }),
    ).toEqual({
      nextLabel: "Rewind",
      previousLabel: "Recording",
    });
  });

  it("does not separate standalone bookmark rows", () => {
    expect(
      resolveBookmarkTableSeparator({
        previousBookmark: createBookmarkLibraryItem({ id: "bookmark-1" }),
        bookmark: createBookmarkLibraryItem({
          activeRecordingId: "recording-1",
          id: "bookmark-2",
        }),
      }),
    ).toBeNull();
  });
});
