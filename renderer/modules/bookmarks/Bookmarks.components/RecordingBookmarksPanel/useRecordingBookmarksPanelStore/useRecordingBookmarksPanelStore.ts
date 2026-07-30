import { useShallow } from "zustand/react/shallow";

import { useBoundStore } from "~/renderer/store";

type RecordingBookmarksPanelOwner =
  | "editorRecording"
  | "recordingDetail"
  | "rewindDetail";

function useRecordingBookmarksPanelStore(owner: RecordingBookmarksPanelOwner) {
  return useBoundStore(
    useShallow((state) => {
      if (owner === "rewindDetail") {
        return {
          activeCategoryFilter: state.rewinds.detail.bookmarkCategoryFilter,
          categoryFilter: state.rewinds.detail.bookmarkCategoryFilter,
          errorMessage: state.rewinds.detail.bookmarkErrorMessage,
          isLoading: state.rewinds.detail.bookmarkIsLoading,
          pageIndex: state.rewinds.detail.bookmarkPageIndex,
          searchText: state.rewinds.detail.bookmarkSearchText,
          selectedBookmarkId: null,
          selectCategory: state.rewinds.selectDetailBookmarkCategory,
          setHoveredBookmarkId: state.rewinds.setDetailHoveredBookmarkId,
          setPageIndex: state.rewinds.setDetailBookmarkPageIndex,
          setSearchText: state.rewinds.setDetailBookmarkSearchText,
        };
      }

      const panelState =
        owner === "editorRecording"
          ? state.bookmarks.editorRecording
          : state.bookmarks.recordingDetail;
      return {
        activeCategoryFilter: panelState.hasInteracted
          ? panelState.categoryFilter
          : null,
        categoryFilter: panelState.categoryFilter,
        errorMessage: panelState.errorMessage,
        isLoading: panelState.isLoading,
        pageIndex: panelState.pageIndex,
        searchText: panelState.searchText,
        selectedBookmarkId: panelState.selectedBookmarkId,
        selectCategory:
          owner === "editorRecording"
            ? state.bookmarks.selectEditorRecordingCategory
            : state.bookmarks.selectRecordingDetailCategory,
        setHoveredBookmarkId:
          owner === "editorRecording"
            ? state.bookmarks.setEditorRecordingHoveredBookmarkId
            : state.bookmarks.setRecordingDetailHoveredBookmarkId,
        setPageIndex:
          owner === "editorRecording"
            ? state.bookmarks.setEditorRecordingPageIndex
            : state.bookmarks.setRecordingDetailPageIndex,
        setSearchText:
          owner === "editorRecording"
            ? state.bookmarks.setEditorRecordingSearchText
            : state.bookmarks.setRecordingDetailSearchText,
      };
    }),
  );
}

export type { RecordingBookmarksPanelOwner };
export { useRecordingBookmarksPanelStore };
