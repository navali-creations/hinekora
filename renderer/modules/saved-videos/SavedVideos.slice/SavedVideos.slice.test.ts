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
  sourceProjectId: null,
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
  const onLibraryChanged = vi.fn();
  const openVideo = vi.fn();
  const revealVideo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    deleteVideo.mockResolvedValue({ error: null, ok: true });
    listLibrary.mockResolvedValue(createPage([video]));
    openVideo.mockResolvedValue({ error: null, ok: true });
    revealVideo.mockResolvedValue({ error: null, ok: true });
    onLibraryChanged.mockImplementation(() => () => undefined);
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        savedVideos: {
          delete: deleteVideo,
          listLibrary,
          onLibraryChanged,
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
    expect(store.getState().savedVideos.isLoading).toBe(true);
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
    expect(store.getState().savedVideos).toMatchObject({
      isLoading: false,
      isStale: true,
    });
  });

  it("coalesces identical requests and retries an initial failure", async () => {
    let rejectFirst!: (error: Error) => void;
    listLibrary
      .mockReturnValueOnce(
        new Promise<SavedVideosLibraryPage>((_resolve, reject) => {
          rejectFirst = reject;
        }),
      )
      .mockResolvedValueOnce(createPage([video]));
    const store = createTestStore();
    const query = { pageIndex: 0, pageSize: 10 };

    const first = store.getState().savedVideos.hydrateLibrary(query);
    const duplicate = store.getState().savedVideos.hydrateLibrary(query);
    expect(listLibrary).toHaveBeenCalledOnce();
    rejectFirst(new Error("Library unavailable"));
    await Promise.all([first, duplicate]);

    expect(store.getState().savedVideos.libraryQuery).toEqual(query);
    await store.getState().savedVideos.refreshLibrary();
    expect(listLibrary).toHaveBeenCalledTimes(2);
    expect(store.getState().savedVideos.items).toEqual([video]);
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
    expect(listLibrary).toHaveBeenCalledTimes(1);

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

  it("refreshes an active query when the main process invalidates it", async () => {
    const listeners: Array<() => void> = [];
    const unsubscribe = vi.fn();
    onLibraryChanged.mockImplementation((callback: () => void) => {
      listeners.push(callback);
      return unsubscribe;
    });
    const store = createTestStore();
    const stopListening = store.getState().savedVideos.startListening();
    listeners[0]?.();
    expect(listLibrary).not.toHaveBeenCalled();
    await store
      .getState()
      .savedVideos.hydrateLibrary({ pageSize: 20, sortBy: "savedAt" });
    listLibrary.mockResolvedValueOnce(createPage([]));

    listeners[0]?.();
    await vi.waitFor(() =>
      expect(store.getState().savedVideos.items).toEqual([]),
    );

    expect(listLibrary).toHaveBeenCalledTimes(2);
    expect(store.getState().savedVideos.isStale).toBe(false);
    stopListening();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
