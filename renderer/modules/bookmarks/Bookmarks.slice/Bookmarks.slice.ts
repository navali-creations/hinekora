import type {
  BookmarksSlice,
  BoundStoreStateCreator,
} from "~/renderer/store/store.types";

import {
  allBookmarkCategoriesValue,
  resolveBookmarkCategoryToggle,
} from "../Bookmarks.utils";

const createInitialBookmarkPanelState = () => ({
  categoryFilter: allBookmarkCategoriesValue,
  hasInteracted: false,
  hoveredBookmarkId: null,
  pageIndex: 0,
  selectedBookmarkId: null,
});

function resolveBookmarkPageIndex(
  currentPageIndex: number,
  pageIndex: Parameters<
    BookmarksSlice["bookmarks"]["setEditorRecordingPageIndex"]
  >[0],
): number {
  const nextPageIndex =
    typeof pageIndex === "function" ? pageIndex(currentPageIndex) : pageIndex;

  return Math.max(0, nextPageIndex);
}

export const createBookmarksSlice: BoundStoreStateCreator<BookmarksSlice> = (
  set,
  get,
) => {
  let refreshRequestId = 0;

  const refresh: BookmarksSlice["bookmarks"]["refresh"] = async (
    queryInput,
  ) => {
    refreshRequestId += 1;
    const requestId = refreshRequestId;
    const query = queryInput ?? get().bookmarks.query ?? {};
    set((state) => {
      state.bookmarks.error = null;
      state.bookmarks.isLoading = true;
      state.bookmarks.query = query;
    });

    try {
      const page = await window.electron.bookmarks.listLibrary(query);
      if (requestId !== refreshRequestId) {
        return;
      }

      set((state) => {
        state.bookmarks.availableCategories = page.availableCategories;
        state.bookmarks.availableLeagues = page.availableLeagues;
        state.bookmarks.items = page.items;
        state.bookmarks.page = page;
        state.bookmarks.isLoading = false;
      });
    } catch (error) {
      if (requestId !== refreshRequestId) {
        return;
      }

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
      editorRecording: createInitialBookmarkPanelState(),
      recordingDetail: createInitialBookmarkPanelState(),
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
      resetEditorRecordingBookmarks: () => {
        set((state) => {
          state.bookmarks.editorRecording = createInitialBookmarkPanelState();
        });
      },
      selectEditorRecordingCategory: (category) => {
        set((state) => {
          const nextState = resolveBookmarkCategoryToggle(
            state.bookmarks.editorRecording,
            category,
          );
          state.bookmarks.editorRecording.categoryFilter =
            nextState.categoryFilter;
          state.bookmarks.editorRecording.hasInteracted =
            nextState.hasInteracted;
          state.bookmarks.editorRecording.pageIndex = 0;
        });
      },
      setEditorRecordingHoveredBookmarkId: (id) => {
        set((state) => {
          state.bookmarks.editorRecording.hoveredBookmarkId = id;
        });
      },
      setEditorRecordingPageIndex: (pageIndex) => {
        set((state) => {
          state.bookmarks.editorRecording.pageIndex = resolveBookmarkPageIndex(
            state.bookmarks.editorRecording.pageIndex,
            pageIndex,
          );
        });
      },
      setEditorRecordingSelectedBookmarkId: (id) => {
        set((state) => {
          state.bookmarks.editorRecording.selectedBookmarkId = id;
        });
      },
      resetRecordingDetail: () => {
        set((state) => {
          state.bookmarks.recordingDetail = createInitialBookmarkPanelState();
        });
      },
      selectRecordingDetailCategory: (category) => {
        set((state) => {
          const nextState = resolveBookmarkCategoryToggle(
            state.bookmarks.recordingDetail,
            category,
          );
          state.bookmarks.recordingDetail.categoryFilter =
            nextState.categoryFilter;
          state.bookmarks.recordingDetail.hasInteracted =
            nextState.hasInteracted;
          state.bookmarks.recordingDetail.pageIndex = 0;
        });
      },
      setRecordingDetailHoveredBookmarkId: (id) => {
        set((state) => {
          state.bookmarks.recordingDetail.hoveredBookmarkId = id;
        });
      },
      setRecordingDetailPageIndex: (pageIndex) => {
        set((state) => {
          state.bookmarks.recordingDetail.pageIndex = resolveBookmarkPageIndex(
            state.bookmarks.recordingDetail.pageIndex,
            pageIndex,
          );
        });
      },
      setRecordingDetailSelectedBookmarkId: (id) => {
        set((state) => {
          state.bookmarks.recordingDetail.selectedBookmarkId = id;
        });
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
