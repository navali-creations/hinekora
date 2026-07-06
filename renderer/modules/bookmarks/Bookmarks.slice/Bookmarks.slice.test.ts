import { describe, expect, it } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { allBookmarkCategoriesValue } from "../Bookmarks.utils";
import { createBookmarksSlice } from "./Bookmarks.slice";

function createTestStore() {
  return createBoundStoreForTests((set, get, api) => {
    const bookmarksSlice = createBookmarksSlice(set, get, api);

    return bookmarksSlice as unknown as BoundStore;
  });
}

describe("Bookmarks slice", () => {
  it("tracks editor recording bookmark filters and selection state", () => {
    const store = createTestStore();

    expect(store.getState().bookmarks.editorRecording).toEqual({
      categoryFilter: allBookmarkCategoriesValue,
      hasInteracted: false,
      hoveredBookmarkId: null,
      pageIndex: 0,
      selectedBookmarkId: null,
    });

    store.getState().bookmarks.setEditorRecordingPageIndex(2);
    store
      .getState()
      .bookmarks.setEditorRecordingPageIndex(
        (currentPageIndex) => currentPageIndex + 1,
      );
    expect(store.getState().bookmarks.editorRecording.pageIndex).toBe(3);
    store
      .getState()
      .bookmarks.setEditorRecordingHoveredBookmarkId("bookmark-hovered");
    store
      .getState()
      .bookmarks.setEditorRecordingSelectedBookmarkId("bookmark-selected");
    store.getState().bookmarks.selectEditorRecordingCategory("map");

    expect(store.getState().bookmarks.editorRecording).toEqual({
      categoryFilter: "map",
      hasInteracted: true,
      hoveredBookmarkId: "bookmark-hovered",
      pageIndex: 0,
      selectedBookmarkId: "bookmark-selected",
    });

    store.getState().bookmarks.selectEditorRecordingCategory("map");
    expect(store.getState().bookmarks.editorRecording).toEqual({
      categoryFilter: allBookmarkCategoriesValue,
      hasInteracted: false,
      hoveredBookmarkId: "bookmark-hovered",
      pageIndex: 0,
      selectedBookmarkId: "bookmark-selected",
    });

    store.getState().bookmarks.setEditorRecordingPageIndex(-3);
    expect(store.getState().bookmarks.editorRecording.pageIndex).toBe(0);

    store.getState().bookmarks.resetEditorRecordingBookmarks();
    expect(store.getState().bookmarks.editorRecording).toEqual({
      categoryFilter: allBookmarkCategoriesValue,
      hasInteracted: false,
      hoveredBookmarkId: null,
      pageIndex: 0,
      selectedBookmarkId: null,
    });
  });

  it("tracks recording detail filters and hover state", () => {
    const store = createTestStore();

    expect(store.getState().bookmarks.recordingDetail).toEqual({
      categoryFilter: allBookmarkCategoriesValue,
      hasInteracted: false,
      hoveredBookmarkId: null,
      pageIndex: 0,
      selectedBookmarkId: null,
    });

    store.getState().bookmarks.setRecordingDetailPageIndex(3);
    store
      .getState()
      .bookmarks.setRecordingDetailPageIndex(
        (currentPageIndex) => currentPageIndex - 1,
      );
    expect(store.getState().bookmarks.recordingDetail.pageIndex).toBe(2);
    store
      .getState()
      .bookmarks.setRecordingDetailHoveredBookmarkId("bookmark-1");
    store
      .getState()
      .bookmarks.setRecordingDetailSelectedBookmarkId("bookmark-2");
    store.getState().bookmarks.selectRecordingDetailCategory("death");

    expect(store.getState().bookmarks.recordingDetail).toEqual({
      categoryFilter: "death",
      hasInteracted: true,
      hoveredBookmarkId: "bookmark-1",
      pageIndex: 0,
      selectedBookmarkId: "bookmark-2",
    });

    store.getState().bookmarks.selectRecordingDetailCategory("death");
    expect(store.getState().bookmarks.recordingDetail).toEqual({
      categoryFilter: allBookmarkCategoriesValue,
      hasInteracted: false,
      hoveredBookmarkId: "bookmark-1",
      pageIndex: 0,
      selectedBookmarkId: "bookmark-2",
    });

    store
      .getState()
      .bookmarks.selectRecordingDetailCategory(allBookmarkCategoriesValue);
    expect(store.getState().bookmarks.recordingDetail).toEqual({
      categoryFilter: allBookmarkCategoriesValue,
      hasInteracted: true,
      hoveredBookmarkId: "bookmark-1",
      pageIndex: 0,
      selectedBookmarkId: "bookmark-2",
    });

    store
      .getState()
      .bookmarks.selectRecordingDetailCategory(allBookmarkCategoriesValue);
    expect(store.getState().bookmarks.recordingDetail).toEqual({
      categoryFilter: allBookmarkCategoriesValue,
      hasInteracted: false,
      hoveredBookmarkId: "bookmark-1",
      pageIndex: 0,
      selectedBookmarkId: "bookmark-2",
    });

    store.getState().bookmarks.setRecordingDetailPageIndex(-2);
    expect(store.getState().bookmarks.recordingDetail.pageIndex).toBe(0);

    store.getState().bookmarks.resetRecordingDetail();
    expect(store.getState().bookmarks.recordingDetail).toEqual({
      categoryFilter: allBookmarkCategoriesValue,
      hasInteracted: false,
      hoveredBookmarkId: null,
      pageIndex: 0,
      selectedBookmarkId: null,
    });
  });
});
