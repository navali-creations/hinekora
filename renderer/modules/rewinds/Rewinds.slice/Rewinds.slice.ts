import type {
  BoundStoreStateCreator,
  RewindsSlice,
} from "~/renderer/store/store.types";

export const createRewindsSlice: BoundStoreStateCreator<RewindsSlice> = (
  set,
  get,
) => {
  const refresh: RewindsSlice["rewinds"]["refresh"] = async (queryInput) => {
    const query = queryInput ?? get().rewinds.query ?? {};
    set((state) => {
      state.rewinds.error = null;
      state.rewinds.isLoading = true;
      state.rewinds.query = query;
    });

    try {
      const page = await window.electron.bookmarks.listActivitySessions(query);
      set((state) => {
        state.rewinds.availableLeagues = page.availableLeagues;
        state.rewinds.error = null;
        state.rewinds.isLoading = false;
        state.rewinds.items = page.items;
        state.rewinds.page = page;
      });
    } catch (error) {
      set((state) => {
        state.rewinds.error =
          error instanceof Error ? error.message : "Rewinds failed";
        state.rewinds.isLoading = false;
      });
    }
  };

  return {
    rewinds: {
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
    },
  };
};
