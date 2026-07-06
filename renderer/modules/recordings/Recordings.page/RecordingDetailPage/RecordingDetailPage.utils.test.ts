import { describe, expect, it } from "vitest";

import type { RecordingBookmark } from "~/main/modules/bookmarks";

import { resolveRecordingDetailHighlightedBookmark } from "./RecordingDetailPage.utils";

function createRecordingBookmark(id: string): RecordingBookmark {
  return {
    category: "map",
    createdAt: "2026-07-04T00:00:00.000Z",
    durationSeconds: 10,
    id,
    label: id,
    note: null,
    occurredAt: "2026-07-04T00:00:00.000Z",
    offsetSeconds: 12,
    sceneName: id,
    source: "client-log",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    subcategory: null,
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

describe("resolveRecordingDetailHighlightedBookmark", () => {
  it("prefers hovered bookmarks over selected bookmarks", () => {
    const hovered = createRecordingBookmark("hovered");
    const selected = createRecordingBookmark("selected");

    expect(
      resolveRecordingDetailHighlightedBookmark({
        hoveredBookmarkId: hovered.id,
        latestBookmarks: [],
        selectedBookmarkId: selected.id,
        timelineBookmarks: [selected, hovered],
      }),
    ).toBe(hovered);
  });

  it("falls back to latest page bookmarks when the timeline page does not contain the bookmark", () => {
    const selected = createRecordingBookmark("selected");

    expect(
      resolveRecordingDetailHighlightedBookmark({
        hoveredBookmarkId: null,
        latestBookmarks: [selected],
        selectedBookmarkId: selected.id,
        timelineBookmarks: [],
      }),
    ).toBe(selected);
  });
});
