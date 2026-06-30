import { useDraggable } from "@dnd-kit/react";
import clsx from "clsx";
import type { MouseEvent } from "react";
import { FiFilm, FiVideo } from "react-icons/fi";

import type { EditorMediaAsset } from "~/main/modules/editor";
import {
  formatBytes,
  formatDateTime,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useEditorShallow } from "~/renderer/store";

import {
  type EditorMediaAssetDragData,
  editorMediaAssetDragType,
} from "../../Editor.utils/Editor.utils";
import { assetStatusLabel } from "./EditorAssetCard.utils";

interface EditorAssetCardProps {
  asset: EditorMediaAsset;
}

function EditorAssetCard({ asset }: EditorAssetCardProps) {
  const { selectedAssetKey, selectAsset } = useEditorShallow((editor) => ({
    selectedAssetKey: editor.selectedAssetKey,
    selectAsset: editor.selectAsset,
  }));
  const isSelected = selectedAssetKey === asset.assetKey;
  const isReady =
    asset.exists && asset.status === "ready" && asset.mediaUrl !== null;
  const Icon = asset.kind === "clip" ? FiFilm : FiVideo;
  const { isDragging, ref } = useDraggable<EditorMediaAssetDragData>({
    data: {
      assetKey: asset.assetKey,
      kind: editorMediaAssetDragType,
    },
    disabled: !isReady,
    id: `asset:${asset.assetKey}`,
    type: editorMediaAssetDragType,
  });

  const handleAssetClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!isReady) {
      return;
    }

    selectAsset(event.currentTarget.dataset.assetKey ?? null);
  };

  return (
    <button
      className={clsx(
        "flex w-full items-stretch gap-1 rounded-lg border p-2 text-left transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed",
        "hover:border-primary/50 hover:bg-base-content/[0.03]",
        isReady
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-not-allowed opacity-60",
        isDragging &&
          "pointer-events-none cursor-grabbing opacity-70 ring-1 ring-primary/40",
        isSelected
          ? "border-primary/60 bg-primary/10"
          : "border-base-content/10 bg-base-300/55",
      )}
      data-asset-key={asset.assetKey}
      disabled={!isReady}
      ref={ref}
      type="button"
      onClick={handleAssetClick}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 rounded bg-base-100 p-1.5 text-primary">
            <Icon aria-hidden size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-sm">
              {asset.name}
            </span>
            <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-base-content/45">
              <span>{formatDateTime(asset.createdAt)}</span>
              <span>
                {isReady
                  ? formatBytes(asset.sizeBytes)
                  : assetStatusLabel(asset)}
              </span>
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

export { EditorAssetCard };
