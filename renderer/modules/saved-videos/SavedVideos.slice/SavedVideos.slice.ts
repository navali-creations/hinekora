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
  let invalidationVersion = 0;
  let libraryRequest: {
    invalidationVersion: number;
    promise: Promise<void>;
    query: SavedVideosLibraryQuery;
  } | null = null;

  const loadLibrary = (query: SavedVideosLibraryQuery): Promise<void> => {
    if (
      libraryRequest?.invalidationVersion === invalidationVersion &&
      areQueriesEqual(libraryRequest.query, query)
    ) {
      return libraryRequest.promise;
    }
    requestId += 1;
    const currentRequestId = requestId;
    const currentInvalidationVersion = invalidationVersion;
    set((state) => {
      state.savedVideos.error = null;
      state.savedVideos.isLoading = true;
      state.savedVideos.libraryQuery = query;
    });

    const promise = (async () => {
      try {
        const page = await window.electron.savedVideos.listLibrary(query);
        set((state) => {
          if (currentRequestId !== requestId) {
            return;
          }
          state.savedVideos.error = null;
          state.savedVideos.isLoading = false;
          state.savedVideos.isStale =
            currentInvalidationVersion !== invalidationVersion;
          state.savedVideos.items = page.items;
          state.savedVideos.libraryPage = page;
        });
      } catch (error) {
        set((state) => {
          if (currentRequestId !== requestId) {
            return;
          }
          state.savedVideos.error =
            error instanceof Error ? error.message : "Saved edits failed";
          state.savedVideos.isLoading = false;
          state.savedVideos.isStale = true;
        });
      } finally {
        if (currentRequestId === requestId) {
          libraryRequest = null;
        }
      }
    })();
    libraryRequest = { invalidationVersion, promise, query };
    return promise;
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
      },
      error: null,
      hydrateLibrary: async (query) => {
        const state = get().savedVideos;
        if (
          areQueriesEqual(state.libraryQuery, query) &&
          state.libraryPage !== null &&
          !state.isStale &&
          state.error === null
        ) {
          return;
        }
        await loadLibrary(query);
      },
      isLoading: false,
      isStale: true,
      items: [],
      libraryPage: null,
      libraryQuery: null,
      openVideo: (id) =>
        runFileAction(() => window.electron.savedVideos.open(id)),
      refreshLibrary: async () => {
        const query = get().savedVideos.libraryQuery;
        if (query) {
          invalidationVersion += 1;
          set((state) => {
            state.savedVideos.isStale = true;
          });
          await loadLibrary(query);
        }
      },
      revealVideo: (id) =>
        runFileAction(() => window.electron.savedVideos.reveal(id)),
      startListening: () =>
        window.electron.savedVideos.onLibraryChanged(() => {
          invalidationVersion += 1;
          set((state) => {
            state.savedVideos.isStale = true;
          });
          const query = get().savedVideos.libraryQuery;
          if (query) {
            void loadLibrary(query);
          }
        }),
    },
  };
};

export { createSavedVideosSlice };
