import type {
  BookmarksSlice,
  BoundStoreStateCreator,
} from "~/renderer/store/store.types";

export const createBookmarksSlice: BoundStoreStateCreator<BookmarksSlice> = (
  set,
  get,
) => {
  const refresh: BookmarksSlice["bookmarks"]["refresh"] = async (
    queryInput,
  ) => {
    const query = queryInput ?? get().bookmarks.query ?? {};
    set((state) => {
      state.bookmarks.error = null;
      state.bookmarks.isLoading = true;
      state.bookmarks.query = query;
    });

    try {
      const page = await window.electron.bookmarks.listLibrary(query);
      set((state) => {
        state.bookmarks.availableCategories = page.availableCategories;
        state.bookmarks.availableLeagues = page.availableLeagues;
        state.bookmarks.items = page.items;
        state.bookmarks.page = page;
        state.bookmarks.isLoading = false;
      });
    } catch (error) {
      set((state) => {
        state.bookmarks.error =
          error instanceof Error ? error.message : "Bookmarks failed";
        state.bookmarks.isLoading = false;
      });
    }
  };

  return {
    bookmarks: {
      availableCategories: [],
      availableLeagues: [],
      error: null,
      isLoading: false,
      isManualRenameSaving: false,
      items: [],
      manualRenameDraft: null,
      page: null,
      query: null,
      closeManualRenameDialog: () => {
        set((state) => {
          if (state.bookmarks.isManualRenameSaving) {
            return;
          }

          state.bookmarks.manualRenameDraft = null;
        });
      },
      openManualRenameDialog: (input) => {
        set((state) => {
          state.bookmarks.manualRenameDraft = input;
        });
      },
      hydrate: async () => {
        await refresh();
      },
      refresh,
      deleteManual: async (id) => {
        await window.electron.bookmarks.deleteManual(id);
        await refresh();
      },
      saveManualRename: async (label) => {
        const draft = get().bookmarks.manualRenameDraft;
        const trimmedLabel = label.trim();
        if (!draft || !trimmedLabel) {
          return;
        }

        set((state) => {
          state.bookmarks.error = null;
          state.bookmarks.isManualRenameSaving = true;
        });

        try {
          await window.electron.bookmarks.updateManual({
            id: draft.id,
            label: trimmedLabel,
          });
          set((state) => {
            state.bookmarks.isManualRenameSaving = false;
            state.bookmarks.manualRenameDraft = null;
          });
          await refresh();
        } catch (error) {
          set((state) => {
            state.bookmarks.error =
              error instanceof Error ? error.message : "Bookmark rename failed";
            state.bookmarks.isManualRenameSaving = false;
          });
        }
      },
      updateManual: async (id, label, note) => {
        await window.electron.bookmarks.updateManual({
          id,
          label,
          ...(note !== undefined ? { note } : {}),
        });
        await refresh();
      },
    },
  };
};
