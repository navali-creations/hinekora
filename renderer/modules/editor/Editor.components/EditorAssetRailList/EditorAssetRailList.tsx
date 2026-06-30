import { useDragOperation } from "@dnd-kit/react";
import clsx from "clsx";
import type { WheelEvent } from "react";

import { isEditorMediaAssetDragData } from "../../Editor.utils/Editor.utils";
import { EditorAssetCard } from "../EditorAssetCard/EditorAssetCard";
import type { EditorAssetRailPageModel } from "../EditorAssetRail/useEditorAssetRailPageModel/useEditorAssetRailPageModel";
import { EditorSavedEditCard } from "../EditorSavedEditCard/EditorSavedEditCard";

type EditorAssetRailListModel = Pick<
  EditorAssetRailPageModel,
  | "currentSavedEditItems"
  | "isSavedEditsFilter"
  | "selectedFilterLabel"
  | "showMediaEmptyState"
  | "visibleAssets"
>;

function EditorAssetRailList({
  pageModel,
}: {
  pageModel: EditorAssetRailListModel;
}) {
  const {
    currentSavedEditItems,
    isSavedEditsFilter,
    selectedFilterLabel,
    showMediaEmptyState,
    visibleAssets,
  } = pageModel;
  const { source } = useDragOperation();
  const isDraggingMediaAsset = isEditorMediaAssetDragData(source?.data);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isDraggingMediaAsset) {
      event.preventDefault();
    }
  };

  return (
    <div
      className={clsx(
        "relative flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden p-3 [scrollbar-gutter:stable]",
        isDraggingMediaAsset ? "overflow-y-hidden" : "overflow-y-auto",
      )}
      data-editor-asset-scroll="true"
      onWheel={handleWheel}
    >
      {isSavedEditsFilter
        ? currentSavedEditItems.map((edit) => (
            <EditorSavedEditCard edit={edit} key={edit.id} />
          ))
        : visibleAssets.map((asset) => (
            <EditorAssetCard asset={asset} key={asset.assetKey} />
          ))}

      {isSavedEditsFilter && currentSavedEditItems.length === 0 && (
        <div className="rounded-lg border border-base-content/10 border-dashed p-4 text-center text-base-content/55 text-sm">
          No saved edits available.
        </div>
      )}

      {!isSavedEditsFilter && showMediaEmptyState && (
        <div className="rounded-lg border border-base-content/10 border-dashed p-4 text-center text-base-content/55 text-sm">
          No {selectedFilterLabel.toLowerCase()} available.
        </div>
      )}
    </div>
  );
}

export { EditorAssetRailList };
