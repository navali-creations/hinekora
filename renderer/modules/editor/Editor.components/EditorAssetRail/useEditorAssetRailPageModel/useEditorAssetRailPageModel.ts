import { useMemo } from "react";

import type { MediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { areSavedEditsLibraryQueriesEqual } from "~/renderer/modules/saved-edits/SavedEdits.slice/SavedEdits.slice.utils";
import { useEditorShallow, useSavedEditsShallow } from "~/renderer/store";

import {
  createEditorAssetRailMediaPageState,
  createEditorAssetRailMediaQuery,
  createEditorAssetRailSavedEditsQuery,
  getEditorAssetRailFilterLabel,
  getEditorAssetRailTimelineAssetKeys,
  isReadyEditorAsset,
} from "../EditorAssetRail.utils";

function useEditorAssetRailPageModel(scope: MediaLibraryScope) {
  const { game, league } = scope;
  const {
    isProcessing,
    mediaAssetPage,
    mediaAssetPendingQuery,
    mediaAssetQuery,
    mediaFilter,
    mediaPageIndex,
    mediaRailTab,
    mediaRecentlyClippedSince,
    project,
    savedEditPageIndex,
  } = useEditorShallow((editor) => ({
    isProcessing: editor.clipboardState.status === "copying",
    mediaAssetPage: editor.mediaAssetPage,
    mediaAssetPendingQuery: editor.mediaAssetPendingQuery,
    mediaAssetQuery: editor.mediaAssetQuery,
    mediaFilter: editor.mediaFilter,
    mediaPageIndex: editor.mediaPageIndex,
    mediaRailTab: editor.mediaRailTab,
    mediaRecentlyClippedSince: editor.mediaRecentlyClippedSince,
    project: editor.project,
    savedEditPageIndex: editor.savedEditPageIndex,
  }));
  const {
    savedEditItems,
    savedEditLibraryPage,
    savedEditLibraryPendingQuery,
    savedEditLibraryQuery,
  } = useSavedEditsShallow((savedEdits) => ({
    savedEditItems: savedEdits.items,
    savedEditLibraryPage: savedEdits.libraryPage,
    savedEditLibraryPendingQuery: savedEdits.libraryPendingQuery,
    savedEditLibraryQuery: savedEdits.libraryQuery,
  }));
  const timelineAssetKeys = useMemo(
    () => getEditorAssetRailTimelineAssetKeys({ project }),
    [project],
  );
  const mediaAssetsQuery = useMemo(
    () =>
      createEditorAssetRailMediaQuery({
        mediaFilter,
        mediaPageIndex,
        mediaRailTab,
        recentlyClippedSince: mediaRecentlyClippedSince,
        scope: { game, league },
        timelineAssetKeys,
      }),
    [
      game,
      league,
      mediaFilter,
      mediaPageIndex,
      mediaRailTab,
      mediaRecentlyClippedSince,
      timelineAssetKeys,
    ],
  );
  const mediaPageState = createEditorAssetRailMediaPageState({
    mediaAssetPage,
    mediaAssetPendingQuery,
    mediaAssetQuery,
    mediaAssetsQuery,
    mediaFilter,
    mediaRailTab,
    timelineAssetKeys,
  });
  const isSavedEditsFilter = mediaFilter === "saved-edits";
  const savedEditsQuery = useMemo(
    () =>
      createEditorAssetRailSavedEditsQuery({
        savedEditPageIndex,
        scope: { game, league },
      }),
    [game, league, savedEditPageIndex],
  );
  const hasCurrentSavedEditLibraryPage =
    savedEditLibraryQuery !== null &&
    areSavedEditsLibraryQueriesEqual(savedEditLibraryQuery, savedEditsQuery);
  const currentSavedEditItems = hasCurrentSavedEditLibraryPage
    ? savedEditItems
    : [];
  const currentSavedEditTotalCount =
    hasCurrentSavedEditLibraryPage && savedEditLibraryPage
      ? savedEditLibraryPage.totalCount
      : 0;
  const currentSavedEditPageCount =
    hasCurrentSavedEditLibraryPage && savedEditLibraryPage
      ? savedEditLibraryPage.pageCount
      : 1;
  const revealableAsset =
    mediaPageState.visibleAssets.find(isReadyEditorAsset) ?? null;
  const revealableSavedEdit = currentSavedEditItems[0] ?? null;

  return {
    canRevealCurrentFilter: isSavedEditsFilter
      ? revealableSavedEdit !== null
      : revealableAsset !== null,
    currentSavedEditItems,
    isMediaAssetPagePending: mediaAssetPendingQuery !== null,
    isProcessing,
    isSavedEditsFilter,
    mediaAssetsQuery,
    mediaFilter,
    mediaPageIndex,
    mediaRailTab,
    pageCount: isSavedEditsFilter
      ? currentSavedEditPageCount
      : mediaPageState.currentMediaAssetPageCount,
    pageIndex: isSavedEditsFilter ? savedEditPageIndex : mediaPageIndex,
    paginationDisabled:
      isProcessing ||
      (isSavedEditsFilter
        ? savedEditLibraryPendingQuery !== null
        : mediaAssetPendingQuery !== null),
    revealableAsset,
    revealableSavedEdit,
    savedEditsQuery,
    selectedFilterLabel: getEditorAssetRailFilterLabel(mediaFilter),
    showMediaEmptyState: mediaPageState.shouldShowMediaEmptyState,
    timelineAssetKeys,
    totalCount: isSavedEditsFilter
      ? currentSavedEditTotalCount
      : mediaPageState.currentMediaAssetTotalCount,
    visibleAssets: mediaPageState.visibleAssets,
  };
}

type EditorAssetRailPageModel = ReturnType<typeof useEditorAssetRailPageModel>;

export type { EditorAssetRailPageModel };
export { useEditorAssetRailPageModel };
