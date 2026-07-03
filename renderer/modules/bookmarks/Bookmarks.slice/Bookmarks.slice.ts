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
    });

    try {
      const page = await window.electron.bookmarks.listLibrary(query);
      set((state) => {
        state.bookmarks.availableCategories = page.availableCategories;
        state.bookmarks.availableLeagues = page.availableLeagues;
        state.bookmarks.items = page.items;
        state.bookmarks.page = page;
        state.bookmarks.query = query;
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
      items: [],
      page: null,
      query: null,
      hydrate: async () => {
        await refresh();
      },
      refresh,
      deleteManual: async (id) => {
        await window.electron.bookmarks.deleteManual(id);
        await refresh();
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
