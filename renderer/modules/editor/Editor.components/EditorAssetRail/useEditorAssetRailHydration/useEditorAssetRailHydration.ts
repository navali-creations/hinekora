import { useEffect } from "react";

import { useEditorShallow, useSavedEditsShallow } from "~/renderer/store";

import type { EditorAssetRailPageModel } from "../useEditorAssetRailPageModel/useEditorAssetRailPageModel";

type EditorAssetRailHydrationModel = Pick<
  EditorAssetRailPageModel,
  "isSavedEditsFilter" | "mediaAssetsQuery" | "savedEditsQuery"
>;

function useEditorAssetRailHydration({
  isSavedEditsFilter,
  mediaAssetsQuery,
  savedEditsQuery,
}: EditorAssetRailHydrationModel) {
  const { hydrateMediaAssets } = useEditorShallow((editor) => ({
    hydrateMediaAssets: editor.hydrateMediaAssets,
  }));
  const { hydrateLibrary } = useSavedEditsShallow((savedEdits) => ({
    hydrateLibrary: savedEdits.hydrateLibrary,
  }));

  useEffect(() => {
    if (!isSavedEditsFilter) {
      return;
    }

    void hydrateLibrary(savedEditsQuery);
  }, [hydrateLibrary, isSavedEditsFilter, savedEditsQuery]);

  useEffect(() => {
    if (!mediaAssetsQuery || isSavedEditsFilter) {
      return;
    }

    void hydrateMediaAssets(mediaAssetsQuery);
  }, [hydrateMediaAssets, isSavedEditsFilter, mediaAssetsQuery]);
}

export { useEditorAssetRailHydration };
