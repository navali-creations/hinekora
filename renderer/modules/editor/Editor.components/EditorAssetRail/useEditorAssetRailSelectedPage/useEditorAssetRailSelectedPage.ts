import { useEffect } from "react";

import { useEditorShallow } from "~/renderer/store";

import { getEditorAssetRailPageIndexForAssetKey } from "../EditorAssetRail.utils";
import type { EditorAssetRailPageModel } from "../useEditorAssetRailPageModel/useEditorAssetRailPageModel";

type EditorAssetRailSelectedPageModel = Pick<
  EditorAssetRailPageModel,
  | "isMediaAssetPagePending"
  | "isSavedEditsFilter"
  | "mediaPageIndex"
  | "mediaRailTab"
  | "timelineAssetKeys"
>;

function useEditorAssetRailSelectedPage({
  isMediaAssetPagePending,
  isSavedEditsFilter,
  mediaPageIndex,
  mediaRailTab,
  timelineAssetKeys,
}: EditorAssetRailSelectedPageModel) {
  const { selectedAssetKey, setMediaPageIndex } = useEditorShallow(
    (editor) => ({
      selectedAssetKey: editor.selectedAssetKey,
      setMediaPageIndex: editor.setMediaPageIndex,
    }),
  );

  useEffect(() => {
    if (
      isMediaAssetPagePending ||
      isSavedEditsFilter ||
      mediaRailTab !== "in-timeline"
    ) {
      return;
    }

    const selectedAssetPageIndex = getEditorAssetRailPageIndexForAssetKey({
      assetKey: selectedAssetKey,
      assetKeys: timelineAssetKeys,
    });
    if (
      selectedAssetPageIndex === null ||
      selectedAssetPageIndex === mediaPageIndex
    ) {
      return;
    }

    setMediaPageIndex(selectedAssetPageIndex);
  }, [
    isMediaAssetPagePending,
    isSavedEditsFilter,
    mediaPageIndex,
    mediaRailTab,
    selectedAssetKey,
    setMediaPageIndex,
    timelineAssetKeys,
  ]);
}

export { useEditorAssetRailSelectedPage };
