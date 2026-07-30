import { describe, expect, it } from "vitest";

import { resolveBookmarkCategoryCountState } from "./Bookmarks.utils";

describe("Bookmarks utils", () => {
  it("resolves the all count and per-category lookup together", () => {
    const state = resolveBookmarkCategoryCountState([
      { category: "boss", count: 26 },
      { category: "death", count: 4 },
    ]);

    expect(state.allCount).toBe(30);
    expect(state.countsByCategory.get("boss")).toBe(26);
    expect(state.countsByCategory.get("death")).toBe(4);
  });
});
