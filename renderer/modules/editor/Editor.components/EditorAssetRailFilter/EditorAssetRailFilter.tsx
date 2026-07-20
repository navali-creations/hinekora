import type { ChangeEvent } from "react";

import { useEditorShallow, useSettingsShallow } from "~/renderer/store";

import type { EditorMediaFilter } from "../../Editor.slice/Editor.slice.types";
import { editorAssetRailFilterOptions } from "../EditorAssetRail/EditorAssetRail.utils";

interface EditorAssetRailFilterOption<TValue extends string> {
  label: string;
  value: TValue;
}

function EditorAssetRailFilter() {
  const { isProcessing, mediaFilter, setMediaFilter } = useEditorShallow(
    (editor) => ({
      isProcessing: editor.clipboardState.status === "copying",
      mediaFilter: editor.mediaFilter,
      setMediaFilter: editor.setMediaFilter,
    }),
  );
  const { filterError, updatePreference } = useSettingsShallow((settings) => ({
    filterError: settings.preferenceErrors.editorMediaFilter ?? null,
    updatePreference: settings.updatePreference,
  }));

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!isProcessing) {
      const nextFilter = event.currentTarget.value as EditorMediaFilter;
      setMediaFilter(nextFilter);
      void updatePreference("editorMediaFilter", nextFilter);
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
      {filterError && (
        <p className="mt-2 mb-0 text-error text-xs" role="status">
          {filterError}
        </p>
      )}
    </div>
  );
}

export type { EditorAssetRailFilterOption };
export { EditorAssetRailFilter };
