import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SavedVideoItem,
  SavedVideosLibraryPage,
} from "~/main/modules/saved-videos";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createSavedVideosSlice } from "./SavedVideos.slice";

const video: SavedVideoItem = {
  fileName: "Saved.mp4",
  id: "a".repeat(64),
  savedAt: "2026-07-21T00:00:00.000Z",
  sizeBytes: 1024,
};

function createPage(items: SavedVideoItem[] = []): SavedVideosLibraryPage {
  return {
    isTruncated: false,
    items,
    pageCount: 1,
    pageIndex: 0,
    pageSize: 20,
    sortBy: "savedAt",
    sortDirection: "desc",
    totalCount: items.length,
  };
}

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createSavedVideosSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("SavedVideos slice", () => {
  const deleteVideo = vi.fn();
  const listLibrary = vi.fn();
  const openVideo = vi.fn();
  const revealVideo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    deleteVideo.mockResolvedValue({ error: null, ok: true });
    listLibrary.mockResolvedValue(createPage([video]));
    openVideo.mockResolvedValue({ error: null, ok: true });
    revealVideo.mockResolvedValue({ error: null, ok: true });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        savedVideos: {
          delete: deleteVideo,
          listLibrary,
          open: openVideo,
          reveal: revealVideo,
        },
      },
    });
  });

  it("hydrates once and refreshes the current page", async () => {
    const store = createTestStore();
    const query = { pageSize: 20, sortBy: "savedAt" as const };

    await store.getState().savedVideos.refreshLibrary();
    expect(listLibrary).not.toHaveBeenCalled();
    await store.getState().savedVideos.hydrateLibrary(query);
    await store.getState().savedVideos.hydrateLibrary(query);
    await store.getState().savedVideos.refreshLibrary();

    expect(listLibrary).toHaveBeenCalledTimes(2);
    expect(store.getState().savedVideos).toMatchObject({
      error: null,
      items: [video],
      libraryPage: createPage([video]),
      libraryQuery: query,
    });
  });

  it("keeps the newest library request and reports load failures", async () => {
    let resolveFirst!: (page: SavedVideosLibraryPage) => void;
    listLibrary
      .mockReturnValueOnce(
        new Promise<SavedVideosLibraryPage>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(createPage([video]));
    const store = createTestStore();
    const first = store
      .getState()
      .savedVideos.hydrateLibrary({ pageIndex: 0, pageSize: 10 });
    const second = store
      .getState()
      .savedVideos.hydrateLibrary({ pageIndex: 1, pageSize: 10 });
    await second;
    resolveFirst(createPage([]));
    await first;
    expect(store.getState().savedVideos.items).toEqual([video]);

    listLibrary.mockRejectedValueOnce(new Error("Library unavailable"));
    await store
      .getState()
      .savedVideos.hydrateLibrary({ pageIndex: 2, pageSize: 10 });
    expect(store.getState().savedVideos.error).toBe("Library unavailable");
  });

  it("runs video actions, refreshes after deletion, and surfaces failures", async () => {
    const store = createTestStore();
    await store
      .getState()
      .savedVideos.hydrateLibrary({ pageSize: 20, sortBy: "savedAt" });

    await store.getState().savedVideos.openVideo(video.id);
    await store.getState().savedVideos.revealVideo(video.id);
    await store.getState().savedVideos.deleteVideo(video.id);
    expect(openVideo).toHaveBeenCalledWith(video.id);
    expect(revealVideo).toHaveBeenCalledWith(video.id);
    expect(deleteVideo).toHaveBeenCalledWith(video.id);
    expect(listLibrary).toHaveBeenCalledTimes(2);

    openVideo.mockResolvedValueOnce({ error: "Cannot open", ok: false });
    await store.getState().savedVideos.openVideo(video.id);
    expect(store.getState().savedVideos.error).toBe("Cannot open");

    revealVideo.mockRejectedValueOnce("failed");
    await store.getState().savedVideos.revealVideo(video.id);
    expect(store.getState().savedVideos.error).toBe("Saved edits failed");

    deleteVideo.mockResolvedValueOnce({ error: null, ok: false });
    await store.getState().savedVideos.deleteVideo(video.id);
    expect(store.getState().savedVideos.error).toBe(
      "Saved edit video is unavailable",
    );
  });
});
