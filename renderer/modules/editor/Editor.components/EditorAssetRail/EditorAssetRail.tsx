import { useDragOperation } from "@dnd-kit/react";
import clsx from "clsx";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

import type { EditorMediaAssetCategory } from "~/main/modules/editor";
import { useEditorShallow } from "~/renderer/store";

import { isEditorMediaAssetDragData } from "../../Editor.utils/Editor.utils";
import { EditorAssetCard } from "../EditorAssetCard/EditorAssetCard";

type EditorMediaFilter = EditorMediaAssetCategory;

const mediaFilterOptions: Array<{
  label: string;
  value: EditorMediaFilter;
}> = [
  { label: "Recordings", value: "recording" },
  { label: "Death Clips", value: "death-clip" },
  { label: "Manual Replays", value: "manual-replay" },
];

function EditorAssetRail() {
  const { source } = useDragOperation();
  const [filter, setFilter] = useState<EditorMediaFilter>("death-clip");
  const { refreshMedia, selectedAssetKey, workspace } = useEditorShallow(
    (editor) => ({
      refreshMedia: editor.refreshMedia,
      selectedAssetKey: editor.selectedAssetKey,
      workspace: editor.workspace,
    }),
  );
  const assets = workspace?.assets ?? [];
  const selectedAssetCategory =
    assets.find((asset) => asset.assetKey === selectedAssetKey)?.category ??
    null;
  const filteredAssets = useMemo(
    () => assets.filter((asset) => asset.category === filter),
    [assets, filter],
  );
  const selectedFilterLabel =
    mediaFilterOptions.find((option) => option.value === filter)?.label ??
    "media";
  const isDraggingMediaAsset = isEditorMediaAssetDragData(source?.data);

  const handleRefresh = () => {
    void refreshMedia();
  };

  const handleFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setFilter(event.currentTarget.value as EditorMediaFilter);
  };

  useEffect(() => {
    if (selectedAssetCategory) {
      setFilter(selectedAssetCategory);
    }
  }, [selectedAssetCategory]);

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200">
      <div className="flex items-center justify-between border-base-content/10 border-b p-3">
        <div>
          <h2 className="m-0 font-semibold text-sm">My media</h2>
          <p className="m-0 text-base-content/55 text-xs">
            Drag clips into the timeline
          </p>
        </div>
        <button
          aria-label="Refresh media"
          className="btn btn-ghost btn-xs"
          type="button"
          onClick={handleRefresh}
        >
          <FiRefreshCw size={14} />
        </button>
      </div>

      <div className="border-base-content/10 border-b p-3">
        <select
          aria-label="Media type"
          className="select select-bordered select-sm w-full"
          value={filter}
          onChange={handleFilterChange}
        >
          {mediaFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className={clsx(
          "min-h-0 flex-1 space-y-2 overflow-x-hidden p-3",
          isDraggingMediaAsset ? "overflow-y-hidden" : "overflow-y-auto",
        )}
      >
        {filteredAssets.map((asset) => (
          <EditorAssetCard asset={asset} key={asset.assetKey} />
        ))}

        {filteredAssets.length === 0 && (
          <div className="rounded-lg border border-base-content/10 border-dashed p-4 text-center text-base-content/55 text-sm">
            No {selectedFilterLabel.toLowerCase()} available.
          </div>
        )}
      </div>
    </aside>
  );
}

export { EditorAssetRail };
