import { describe, expect, it } from "vitest";

import type { ActivitySessionBookmark } from "~/main/modules/bookmarks";

import { mapRewindTimelineBookmarks } from "./RewindDetailPage.utils";

const baseBookmark = {
  createdAt: "2026-07-03T10:00:00.000Z",
  note: null,
  sceneName: null,
  source: "client-log",
  sourceGame: "poe2",
  sourceLeague: "Standard",
  subcategory: null,
  updatedAt: "2026-07-03T10:00:00.000Z",
} satisfies Partial<ActivitySessionBookmark>;

function createBookmark(
  input: Pick<
    ActivitySessionBookmark,
    "category" | "id" | "label" | "occurredAt" | "offsetSeconds" | "source"
  >,
): ActivitySessionBookmark {
  return {
    ...baseBookmark,
    ...input,
  } as ActivitySessionBookmark;
}

describe("RewindDetailPage utils", () => {
  it("derives location segment durations while preserving replay clip durations", () => {
    const bookmarks = mapRewindTimelineBookmarks({
      bookmarks: [
        createBookmark({
          category: "map",
          id: "map-1",
          label: "Qimah Reservoir",
          occurredAt: "2026-07-03T10:00:00.000Z",
          offsetSeconds: 0,
          source: "client-log",
        }),
        createBookmark({
          category: "death",
          id: "death-1",
          label: "Death",
          occurredAt: "2026-07-03T10:00:20.000Z",
          offsetSeconds: 20,
          source: "client-log",
        }),
        createBookmark({
          category: "town",
          id: "town-1",
          label: "The Khari Bazaar",
          occurredAt: "2026-07-03T10:00:30.000Z",
          offsetSeconds: 30,
          source: "client-log",
        }),
        createBookmark({
          category: "rewind-manual-replay",
          id: "replay-1",
          label: "Manual replay",
          occurredAt: "2026-07-03T10:00:45.000Z",
          offsetSeconds: 45,
          source: "system",
        }),
        createBookmark({
          category: "manual",
          id: "manual-1",
          label: "Manual bookmark",
          occurredAt: "2026-07-03T10:00:50.000Z",
          offsetSeconds: 50,
          source: "manual",
        }),
      ],
      clipTargetsByBookmarkId: {
        "death-1": {
          targetDurationSeconds: 11,
          targetId: "clip-death",
        },
        "replay-1": {
          targetDurationSeconds: 7,
          targetId: "clip-replay",
        },
      },
      durationSeconds: 60,
    });

    expect(
      bookmarks.map((bookmark) => ({
        category: bookmark.category,
        durationSeconds: bookmark.durationSeconds,
        id: bookmark.id,
      })),
    ).toEqual([
      { category: "map", durationSeconds: 30, id: "map-1" },
      { category: "death", durationSeconds: 11, id: "death-1" },
      { category: "town", durationSeconds: 30, id: "town-1" },
      {
        category: "rewind-manual-replay",
        durationSeconds: 7,
        id: "replay-1",
      },
    ]);
  });
});
