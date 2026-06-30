import type { ChangeEvent } from "react";

import { useEditorShallow } from "~/renderer/store";

import type { EditorMediaFilter } from "../../Editor.slice/Editor.slice.types";
import { editorAssetRailFilterOptions } from "../EditorAssetRail/EditorAssetRail.utils";

interface EditorAssetRailFilterOption<TValue extends string> {
  label: string;
  value: TValue;
}

function EditorAssetRailFilter() {
  const { isProcessing, mediaFilter, setMediaFilter } = useEditorShallow(
    (editor) => ({
      isProcessing:
        editor.clipboardState.status === "copying" ||
        editor.exportState.status === "exporting",
      mediaFilter: editor.mediaFilter,
      setMediaFilter: editor.setMediaFilter,
    }),
  );

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!isProcessing) {
      setMediaFilter(event.currentTarget.value as EditorMediaFilter);
    }
  };

  return (
    <div className="border-base-content/10 border-b p-3">
      <select
        aria-label="Media type"
        className="select select-bordered select-sm w-full"
        disabled={isProcessing}
        value={mediaFilter}
        onChange={handleChange}
      >
        {editorAssetRailFilterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export type { EditorAssetRailFilterOption };
export { EditorAssetRailFilter };
