import clsx from "clsx";

import { useEditorShallow } from "~/renderer/store";

import { editorAssetRailTabOptions } from "../EditorAssetRail/EditorAssetRail.utils";

function EditorAssetRailTabs() {
  const { isProcessing, mediaRailTab, setMediaRailTab } = useEditorShallow(
    (editor) => ({
      isProcessing:
        editor.clipboardState.status === "copying" ||
        editor.exportState.status === "exporting",
      mediaRailTab: editor.mediaRailTab,
      setMediaRailTab: editor.setMediaRailTab,
    }),
  );

  return (
    <div className="border-base-content/10 border-b p-3">
      <div
        aria-label="Media scope"
        className="tabs tabs-boxed tabs-xs grid grid-cols-3 bg-base-300 p-1"
        role="tablist"
      >
        {editorAssetRailTabOptions.map((option) => {
          const handleClick = () => {
            if (!isProcessing) {
              setMediaRailTab(option.value);
            }
          };

          return (
            <button
              aria-selected={option.value === mediaRailTab}
              className={clsx(
                "tab whitespace-nowrap rounded-md font-semibold",
                isProcessing && "cursor-not-allowed opacity-45",
                option.value === mediaRailTab
                  ? "tab-active bg-primary text-primary-content shadow-sm"
                  : "text-base-content/65 hover:bg-base-200 hover:text-base-content",
              )}
              disabled={isProcessing}
              key={option.value}
              role="tab"
              type="button"
              onClick={handleClick}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { EditorAssetRailTabs };
