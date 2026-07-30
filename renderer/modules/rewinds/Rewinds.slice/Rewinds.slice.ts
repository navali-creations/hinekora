import {
  allBookmarkCategoriesValue,
  defaultRewindTimelineMarkerFilterValue,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";
import type {
  BoundStoreStateCreator,
  RewindsSlice,
} from "~/renderer/store/store.types";

export const createRewindsSlice: BoundStoreStateCreator<RewindsSlice> = (
  set,
  get,
) => {
  let refreshRequestId = 0;

  const refresh: RewindsSlice["rewinds"]["refresh"] = async (queryInput) => {
    refreshRequestId += 1;
    const requestId = refreshRequestId;
    const query = queryInput ?? get().rewinds.query ?? {};
    set((state) => {
      state.rewinds.error = null;
      state.rewinds.isLoading = true;
      state.rewinds.query = query;
    });

    try {
      const page = await window.electron.bookmarks.listActivitySessions(query);
      if (requestId !== refreshRequestId) {
        return;
      }

      set((state) => {
        state.rewinds.availableLeagues = page.availableLeagues;
        state.rewinds.error = null;
        state.rewinds.isLoading = false;
        state.rewinds.items = page.items;
        state.rewinds.page = page;
      });
    } catch (error) {
      if (requestId !== refreshRequestId) {
        return;
      }

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
      detail: {
        bookmarkCategoryFilter: allBookmarkCategoriesValue,
        bookmarkErrorMessage: null,
        bookmarkIsLoading: false,
        bookmarkPageIndex: 0,
        bookmarkSearchText: "",
        hoveredBookmarkId: null,
        timelineMarkerCategoryFilter: defaultRewindTimelineMarkerFilterValue,
      },
      hydrate: async () => {
        await refresh();
      },
      refresh,
      resetDetail: () => {
        set((state) => {
          state.rewinds.detail = {
            bookmarkCategoryFilter: allBookmarkCategoriesValue,
            bookmarkErrorMessage: null,
            bookmarkIsLoading: false,
            bookmarkPageIndex: 0,
            bookmarkSearchText: "",
            hoveredBookmarkId: null,
            timelineMarkerCategoryFilter:
              defaultRewindTimelineMarkerFilterValue,
          };
        });
      },
      selectDetailBookmarkCategory: (category) => {
        set((state) => {
          state.rewinds.detail.bookmarkCategoryFilter = category;
          state.rewinds.detail.timelineMarkerCategoryFilter = category;
          state.rewinds.detail.bookmarkPageIndex = 0;
        });
      },
      setDetailBookmarkPageIndex: (pageIndex) => {
        set((state) => {
          state.rewinds.detail.bookmarkPageIndex = Math.max(0, pageIndex);
        });
      },
      setDetailBookmarkPanelStatus: (status) => {
        set((state) => {
          state.rewinds.detail.bookmarkErrorMessage = status.errorMessage;
          state.rewinds.detail.bookmarkIsLoading = status.isLoading;
        });
      },
      setDetailBookmarkSearchText: (searchText) => {
        set((state) => {
          state.rewinds.detail.bookmarkSearchText = searchText;
          state.rewinds.detail.bookmarkPageIndex = 0;
        });
      },
      setDetailHoveredBookmarkId: (id) => {
        set((state) => {
          state.rewinds.detail.hoveredBookmarkId = id;
        });
      },
      setDetailTimelineMarkerCategory: (category) => {
        set((state) => {
          state.rewinds.detail.timelineMarkerCategoryFilter = category;
        });
      },
    },
  };
};
