import { describe, expect, it } from "vitest";

import { normalizeMediaLibraryPageQuery } from "../MediaLibrary.utils";

describe("MediaLibrary.utils", () => {
  it("normalizes defaults and clamps invalid direct page input", () => {
    expect(
      normalizeMediaLibraryPageQuery(
        { pageIndex: -2, pageSize: 0 },
        {
          pageIndex: 1,
          pageSize: 20,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      ),
    ).toEqual({
      pageIndex: 0,
      pageSize: 1,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
  });

  it("normalizes a missing page query from defaults", () => {
    expect(
      normalizeMediaLibraryPageQuery(
        {},
        {
          pageIndex: 1,
          pageSize: 20,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      ),
    ).toEqual({
      pageIndex: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
  });
});
