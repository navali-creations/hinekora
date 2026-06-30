import type { SavedEditsLibraryQuery } from "~/main/modules/saved-edits";
import type { SavedEditsSlice } from "~/renderer/modules/saved-edits/SavedEdits.slice/SavedEdits.slice.types";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import {
  areSavedEditsLibraryAppendQueries,
  areSavedEditsLibraryQueriesEqual,
} from "./SavedEdits.slice.utils";

const createSavedEditsSlice: BoundStoreStateCreator<SavedEditsSlice> = (
  set,
  get,
) => {
  let libraryRequestId = 0;
  const loadLibrary = async (
    query: SavedEditsLibraryQuery,
    options: {
      clearBeforeLoad?: boolean;
      mode?: "append" | "replace";
    } = {},
  ) => {
    libraryRequestId += 1;
    const requestId = libraryRequestId;
    const currentSavedEdits = get().savedEdits;
    const shouldAppendLibraryItems =
      options.mode === "append" &&
      query.pageIndex !== undefined &&
      query.pageIndex > 0 &&
      currentSavedEdits.libraryPage !== null &&
      currentSavedEdits.libraryQuery !== null &&
      areSavedEditsLibraryAppendQueries({
        current: currentSavedEdits.libraryQuery,
        next: query,
      });

    set((state) => {
      state.savedEdits.error = null;
      if (options.clearBeforeLoad !== false && !shouldAppendLibraryItems) {
        state.savedEdits.items = [];
        state.savedEdits.libraryPage = null;
        state.savedEdits.libraryQuery = null;
      }
      state.savedEdits.libraryPendingQuery = query;
    });

    try {
      const libraryPage = await window.electron.savedEdits.listLibrary(query);
      set((state) => {
        if (
          requestId !== libraryRequestId ||
          state.savedEdits.libraryPendingQuery === null ||
          !areSavedEditsLibraryQueriesEqual(
            state.savedEdits.libraryPendingQuery,
            query,
          )
        ) {
          return;
        }

        const currentLibraryPage = state.savedEdits.libraryPage;
        const currentLibraryQuery = state.savedEdits.libraryQuery;
        const canAppendLibraryItems =
          shouldAppendLibraryItems &&
          currentLibraryPage !== null &&
          currentLibraryQuery !== null &&
          areSavedEditsLibraryAppendQueries({
            current: currentLibraryQuery,
            next: query,
          });
        const nextLibraryPage = canAppendLibraryItems
          ? {
              ...libraryPage,
              items: [...currentLibraryPage.items, ...libraryPage.items],
            }
          : libraryPage;

        state.savedEdits.error = null;
        state.savedEdits.libraryPendingQuery = null;
        state.savedEdits.libraryPage = nextLibraryPage;
        state.savedEdits.items = nextLibraryPage.items;
        state.savedEdits.libraryQuery = query;
      });
    } catch (error) {
      set((state) => {
        if (
          requestId !== libraryRequestId ||
          state.savedEdits.libraryPendingQuery === null ||
          !areSavedEditsLibraryQueriesEqual(
            state.savedEdits.libraryPendingQuery,
            query,
          )
        ) {
          return;
        }

        state.savedEdits.libraryPendingQuery = null;
        state.savedEdits.error =
          error instanceof Error ? error.message : "Saved edits failed";
      });
    }
  };

  return {
    savedEdits: {
      deleteAllEdits: async () => {
        set((state) => {
          state.savedEdits.error = null;
        });

        try {
          await window.electron.savedEdits.deleteAll();
          await get().savedEdits.refreshLibrary();
        } catch (error) {
          set((state) => {
            state.savedEdits.error =
              error instanceof Error ? error.message : "Saved edits failed";
          });
        }
      },
      deleteEdit: async (projectId) => {
        set((state) => {
          state.savedEdits.error = null;
        });

        try {
          await window.electron.savedEdits.delete(projectId);
          await get().savedEdits.refreshLibrary();
        } catch (error) {
          set((state) => {
            state.savedEdits.error =
              error instanceof Error ? error.message : "Saved edits failed";
          });
        }
      },
      error: null,
      items: [],
      libraryPage: null,
      libraryPendingQuery: null,
      libraryQuery: null,
      hydrateLibrary: loadLibrary,
      revealEditInExplorer: async (projectId) => {
        set((state) => {
          state.savedEdits.error = null;
        });

        try {
          const result =
            await window.electron.savedEdits.revealInExplorer(projectId);
          if (result.status !== "success") {
            throw new Error(result.error ?? "Saved edit source is unavailable");
          }
        } catch (error) {
          set((state) => {
            state.savedEdits.error =
              error instanceof Error ? error.message : "Saved edits failed";
          });
        }
      },
      refreshLibrary: async () => {
        const query = get().savedEdits.libraryQuery;
        if (!query) {
          return;
        }

        await loadLibrary(query, { clearBeforeLoad: false });
      },
    },
  };
};

export { createSavedEditsSlice };
