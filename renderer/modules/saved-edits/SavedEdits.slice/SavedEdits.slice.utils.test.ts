import { describe, expect, it } from "vitest";

import {
  areSavedEditsLibraryAppendQueries,
  areSavedEditsLibraryQueriesEqual,
} from "./SavedEdits.slice.utils";

describe("SavedEdits slice utilities", () => {
  it("compares saved edit library queries", () => {
    expect(
      areSavedEditsLibraryQueriesEqual(
        {
          game: "poe2",
          league: "Standard",
          pageIndex: 1,
          pageSize: 5,
          sortBy: "updatedAt",
          sortDirection: "desc",
        },
        {
          game: "poe2",
          league: "Standard",
          pageIndex: 1,
          pageSize: 5,
          sortBy: "updatedAt",
          sortDirection: "desc",
        },
      ),
    ).toBe(true);
    expect(
      areSavedEditsLibraryQueriesEqual(
        {
          game: "poe2",
          pageIndex: 1,
          pageSize: 5,
        },
        {
          game: "poe2",
          pageIndex: 2,
          pageSize: 5,
        },
      ),
    ).toBe(false);
  });

  it("detects sequential append queries", () => {
    expect(
      areSavedEditsLibraryAppendQueries({
        current: {
          game: "poe2",
          league: "Standard",
          pageIndex: 0,
          pageSize: 5,
          sortBy: "updatedAt",
          sortDirection: "desc",
        },
        next: {
          game: "poe2",
          league: "Standard",
          pageIndex: 1,
          pageSize: 5,
          sortBy: "updatedAt",
          sortDirection: "desc",
        },
      }),
    ).toBe(true);
    expect(
      areSavedEditsLibraryAppendQueries({
        current: { game: "poe2", pageIndex: 0, pageSize: 5 },
        next: { game: "poe2", pageIndex: 2, pageSize: 5 },
      }),
    ).toBe(false);
    expect(
      areSavedEditsLibraryAppendQueries({
        current: { game: "poe2", pageSize: 5 },
        next: { game: "poe2", pageIndex: 1, pageSize: 5 },
      }),
    ).toBe(true);
    expect(
      areSavedEditsLibraryAppendQueries({
        current: { game: "poe2", pageIndex: -1, pageSize: 5 },
        next: { game: "poe2", pageSize: 5 },
      }),
    ).toBe(true);
  });
});
