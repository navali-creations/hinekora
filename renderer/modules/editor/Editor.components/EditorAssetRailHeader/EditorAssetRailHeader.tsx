import { FiFolder, FiRefreshCw } from "react-icons/fi";

import type { MediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useEditorShallow, useSavedEditsShallow } from "~/renderer/store";

import {
  createEditorAssetRailMediaQuery,
  revealEditorAssetFolder,
} from "../EditorAssetRail/EditorAssetRail.utils";
import type { EditorAssetRailPageModel } from "../EditorAssetRail/useEditorAssetRailPageModel/useEditorAssetRailPageModel";

type EditorAssetRailHeaderModel = Pick<
  EditorAssetRailPageModel,
  | "canRevealCurrentFilter"
  | "isProcessing"
  | "isSavedEditsFilter"
  | "mediaAssetsQuery"
  | "mediaFilter"
  | "mediaPageIndex"
  | "mediaRailTab"
  | "pageIndex"
  | "revealableAsset"
  | "revealableSavedEdit"
  | "savedEditsQuery"
  | "timelineAssetKeys"
>;

function EditorAssetRailHeader({
  pageModel,
  scope,
}: {
  pageModel: EditorAssetRailHeaderModel;
  scope: MediaLibraryScope;
}) {
  const {
    hydrateMediaAssets,
    refreshMediaRecentlyClippedSince,
    resetMediaPagination,
  } = useEditorShallow((editor) => ({
    hydrateMediaAssets: editor.hydrateMediaAssets,
    refreshMediaRecentlyClippedSince: editor.refreshMediaRecentlyClippedSince,
    resetMediaPagination: editor.resetMediaPagination,
  }));
  const { hydrateLibrary, revealEditInExplorer } = useSavedEditsShallow(
    (savedEdits) => ({
      hydrateLibrary: savedEdits.hydrateLibrary,
      revealEditInExplorer: savedEdits.revealEditInExplorer,
    }),
  );
  const {
    canRevealCurrentFilter,
    isProcessing,
    isSavedEditsFilter,
    mediaAssetsQuery,
    mediaFilter,
    mediaPageIndex,
    mediaRailTab,
    pageIndex,
    revealableAsset,
    revealableSavedEdit,
    savedEditsQuery,
    timelineAssetKeys,
  } = pageModel;

  const handleRefresh = () => {
    if (isProcessing) {
      return;
    }

    if (isSavedEditsFilter) {
      if (pageIndex === 0) {
        void hydrateLibrary(savedEditsQuery);
        return;
      }

      resetMediaPagination();
      return;
    }

    if (mediaRailTab === "recently-clipped") {
      const recentlyClippedSince = refreshMediaRecentlyClippedSince();
      if (mediaPageIndex === 0) {
        const nextMediaAssetsQuery = createEditorAssetRailMediaQuery({
          mediaFilter,
          mediaPageIndex,
          mediaRailTab,
          recentlyClippedSince,
          scope,
          timelineAssetKeys,
        });
        if (nextMediaAssetsQuery) {
          void hydrateMediaAssets(nextMediaAssetsQuery);
        }
        return;
      }
    }

    if (mediaPageIndex === 0 && mediaAssetsQuery) {
      void hydrateMediaAssets(mediaAssetsQuery);
      return;
    }

    resetMediaPagination();
  };

  const handleRevealCurrentFolder = () => {
    if (isProcessing) {
      return;
    }

    if (isSavedEditsFilter) {
      if (revealableSavedEdit) {
        void revealEditInExplorer(revealableSavedEdit.id);
      }
      return;
    }

    if (revealableAsset) {
      void revealEditorAssetFolder(revealableAsset);
    }
  };

  return (
    <div className="flex items-center justify-between border-base-content/10 border-b p-3">
      <div>
        <h2 className="m-0 font-semibold text-sm">My media</h2>
        <p className="m-0 text-base-content/55 text-xs">
          Drag clips into the timeline
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          aria-label="Open current media folder in explorer"
          className="btn btn-ghost btn-xs"
          disabled={isProcessing || !canRevealCurrentFilter}
          title="Open in explorer"
          type="button"
          onClick={handleRevealCurrentFolder}
        >
          <FiFolder size={14} />
        </button>
        <button
          aria-label="Refresh media"
          className="btn btn-ghost btn-xs"
          disabled={isProcessing}
          type="button"
          onClick={handleRefresh}
        >
          <FiRefreshCw size={14} />
        </button>
      </div>
    </div>
  );
}

export { EditorAssetRailHeader };
