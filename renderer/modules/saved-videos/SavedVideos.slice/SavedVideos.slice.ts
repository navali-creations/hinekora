import type { SavedVideosLibraryQuery } from "~/main/modules/saved-videos";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import type { SavedVideosSlice } from "./SavedVideos.slice.types";

function areQueriesEqual(
  left: SavedVideosLibraryQuery | null,
  right: SavedVideosLibraryQuery,
): boolean {
  return (
    left !== null &&
    left.pageIndex === right.pageIndex &&
    left.pageSize === right.pageSize &&
    left.sortBy === right.sortBy &&
    left.sortDirection === right.sortDirection
  );
}

const createSavedVideosSlice: BoundStoreStateCreator<SavedVideosSlice> = (
  set,
  get,
) => {
  let requestId = 0;

  const loadLibrary = async (query: SavedVideosLibraryQuery) => {
    requestId += 1;
    const currentRequestId = requestId;
    set((state) => {
      state.savedVideos.error = null;
    });

    try {
      const page = await window.electron.savedVideos.listLibrary(query);
      set((state) => {
        if (currentRequestId !== requestId) {
          return;
        }
        state.savedVideos.error = null;
        state.savedVideos.items = page.items;
        state.savedVideos.libraryPage = page;
        state.savedVideos.libraryQuery = query;
      });
    } catch (error) {
      set((state) => {
        if (currentRequestId !== requestId) {
          return;
        }
        state.savedVideos.error =
          error instanceof Error ? error.message : "Saved edits failed";
      });
    }
  };

  const runFileAction = async (
    action: () => Promise<{ error: string | null; ok: boolean }>,
  ) => {
    set((state) => {
      state.savedVideos.error = null;
    });
    try {
      const result = await action();
      if (!result.ok) {
        throw new Error(result.error ?? "Saved edit video is unavailable");
      }
    } catch (error) {
      set((state) => {
        state.savedVideos.error =
          error instanceof Error ? error.message : "Saved edits failed";
      });
    }
  };

  return {
    savedVideos: {
      deleteVideo: async (id) => {
        await runFileAction(() => window.electron.savedVideos.delete(id));
        if (get().savedVideos.error === null) {
          await get().savedVideos.refreshLibrary();
        }
      },
      error: null,
      hydrateLibrary: async (query) => {
        if (areQueriesEqual(get().savedVideos.libraryQuery, query)) {
          return;
        }
        await loadLibrary(query);
      },
      items: [],
      libraryPage: null,
      libraryQuery: null,
      openVideo: (id) =>
        runFileAction(() => window.electron.savedVideos.open(id)),
      refreshLibrary: async () => {
        const query = get().savedVideos.libraryQuery;
        if (query) {
          await loadLibrary(query);
        }
      },
      revealVideo: (id) =>
        runFileAction(() => window.electron.savedVideos.reveal(id)),
    },
  };
};

export { createSavedVideosSlice };
