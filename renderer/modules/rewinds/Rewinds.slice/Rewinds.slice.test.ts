import { describe, expect, it } from "vitest";

import {
  allBookmarkCategoriesValue,
  defaultRewindTimelineMarkerFilterValue,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createRewindsSlice } from "./Rewinds.slice";

function createTestStore() {
  return createBoundStoreForTests((set, get, api) => {
    const rewindsSlice = createRewindsSlice(set, get, api);

    return rewindsSlice as unknown as BoundStore;
  });
}

describe("Rewinds slice", () => {
  it("tracks rewind detail filters and hover state", () => {
    const store = createTestStore();

    expect(store.getState().rewinds.detail).toEqual({
      bookmarkCategoryFilter: allBookmarkCategoriesValue,
      bookmarkErrorMessage: null,
      bookmarkIsLoading: false,
      bookmarkPageIndex: 0,
      bookmarkSearchText: "",
      hoveredBookmarkId: null,
      timelineMarkerCategoryFilter: defaultRewindTimelineMarkerFilterValue,
    });

    store.getState().rewinds.setDetailBookmarkPageIndex(4);
    store.getState().rewinds.setDetailHoveredBookmarkId("bookmark-2");
    store.getState().rewinds.setDetailBookmarkPanelStatus({
      errorMessage: "Failed",
      isLoading: true,
    });
    store.getState().rewinds.setDetailBookmarkSearchText("atlas");
    store.getState().rewinds.selectDetailBookmarkCategory("map");

    expect(store.getState().rewinds.detail).toEqual({
      bookmarkCategoryFilter: "map",
      bookmarkErrorMessage: "Failed",
      bookmarkIsLoading: true,
      bookmarkPageIndex: 0,
      bookmarkSearchText: "atlas",
      hoveredBookmarkId: "bookmark-2",
      timelineMarkerCategoryFilter: "map",
    });

    store.getState().rewinds.setDetailTimelineMarkerCategory("death");
    expect(store.getState().rewinds.detail.timelineMarkerCategoryFilter).toBe(
      "death",
    );

    store.getState().rewinds.setDetailBookmarkPageIndex(-3);
    expect(store.getState().rewinds.detail.bookmarkPageIndex).toBe(0);

    store.getState().rewinds.resetDetail();
    expect(store.getState().rewinds.detail).toEqual({
      bookmarkCategoryFilter: allBookmarkCategoriesValue,
      bookmarkErrorMessage: null,
      bookmarkIsLoading: false,
      bookmarkPageIndex: 0,
      bookmarkSearchText: "",
      hoveredBookmarkId: null,
      timelineMarkerCategoryFilter: defaultRewindTimelineMarkerFilterValue,
    });
  });
});
