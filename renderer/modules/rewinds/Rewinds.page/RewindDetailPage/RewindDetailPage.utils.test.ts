import { describe, expect, it } from "vitest";

import type {
  ActivitySessionBookmark,
  ActivitySessionClip,
} from "~/main/modules/bookmarks/Bookmarks.dto";
import { allRecordingBookmarkCategoriesValue } from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";

import {
  calculateRewindDurationSeconds,
  defaultRewindTimelineMarkerFilterValue,
  filterRewindTimelineMarkerBookmarks,
  mapRewindTimelineBookmarks,
  resolveRewindBookmarkSeekSeconds,
  resolveRewindClipSegment,
} from "./RewindDetailPage.utils";

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

function createClip(
  input: Pick<
    ActivitySessionClip,
    | "bookmarkId"
    | "durationSeconds"
    | "id"
    | "offsetSeconds"
    | "targetDurationSeconds"
    | "targetId"
  >,
): ActivitySessionClip {
  return {
    activitySessionId: "rewind-1",
    createdAt: "2026-07-03T10:00:00.000Z",
    targetKind: "replay-clip",
    updatedAt: "2026-07-03T10:00:00.000Z",
    ...input,
  };
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
          durationSeconds: 11,
          targetDurationSeconds: 11,
          targetId: "clip-death",
        },
        "replay-1": {
          durationSeconds: 7,
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

  it("distinguishes default rewind markers from explicit category filters", () => {
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
      ],
      clipTargetsByBookmarkId: {},
      durationSeconds: 60,
    });

    expect(
      filterRewindTimelineMarkerBookmarks({
        bookmarks,
        categoryFilter: defaultRewindTimelineMarkerFilterValue,
      }).map((bookmark) => bookmark.id),
    ).toEqual(["death-1", "replay-1"]);

    expect(
      filterRewindTimelineMarkerBookmarks({
        bookmarks,
        categoryFilter: allRecordingBookmarkCategoriesValue,
      }).map((bookmark) => bookmark.id),
    ).toEqual(["map-1", "death-1", "town-1", "replay-1"]);

    expect(
      filterRewindTimelineMarkerBookmarks({
        bookmarks,
        categoryFilter: "map",
      }).map((bookmark) => bookmark.id),
    ).toEqual(["map-1"]);
  });

  it("seeks linked clip bookmarks to the clip segment start", () => {
    const bookmark = createBookmark({
      category: "death",
      id: "death-1",
      label: "Death",
      occurredAt: "2026-07-03T10:02:18.000Z",
      offsetSeconds: 138,
      source: "client-log",
    });

    expect(
      resolveRewindBookmarkSeekSeconds({
        bookmark,
        clips: [
          createClip({
            bookmarkId: "death-1",
            durationSeconds: 11,
            id: "clip-link-1",
            offsetSeconds: 138,
            targetDurationSeconds: 11,
            targetId: "clip-death",
          }),
        ],
      }),
    ).toBe(127);
  });

  it("extends early replay clips only to the finalized media duration", () => {
    const clip = createClip({
      bookmarkId: "death-1",
      durationSeconds: 34.5,
      id: "clip-link-1",
      offsetSeconds: 30,
      targetDurationSeconds: 50,
      targetId: "clip-death",
    });

    expect(resolveRewindClipSegment(clip)).toEqual({
      startSeconds: 0,
      endSeconds: 34.5,
    });
    expect(
      calculateRewindDurationSeconds({
        bookmarks: [],
        bookmarkTimelineItemsTruncated: false,
        clips: [clip],
        clipTimelineItemsTruncated: false,
        session: {
          createdAt: "2026-07-03T10:00:00.000Z",
          id: "rewind-1",
          mode: "rewind",
          sourceGame: "poe2",
          sourceLeague: "Standard",
          startedAt: "2026-07-03T10:00:00.000Z",
          stoppedAt: "2026-07-03T10:00:20.000Z",
          updatedAt: "2026-07-03T10:00:20.000Z",
        },
      }),
    ).toBe(34.5);
  });

  it("falls back to bookmark offset for non-clip bookmarks", () => {
    const bookmark = createBookmark({
      category: "map",
      id: "map-1",
      label: "Kriar Village",
      occurredAt: "2026-07-03T10:00:00.000Z",
      offsetSeconds: 22,
      source: "client-log",
    });

    expect(
      resolveRewindBookmarkSeekSeconds({
        bookmark,
        clips: [
          createClip({
            bookmarkId: "death-1",
            durationSeconds: 11,
            id: "clip-link-1",
            offsetSeconds: 138,
            targetDurationSeconds: 11,
            targetId: "clip-death",
          }),
        ],
      }),
    ).toBe(22);
  });
});
