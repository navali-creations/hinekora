import { Tabs } from "~/renderer/components/Tabs/Tabs";
import { useEditorShallow } from "~/renderer/store";

import { editorAssetRailTabOptions } from "../EditorAssetRail/EditorAssetRail.utils";

function EditorAssetRailTabs() {
  const { isProcessing, mediaRailTab, setMediaRailTab } = useEditorShallow(
    (editor) => ({
      isProcessing: editor.clipboardState.status === "copying",
      mediaRailTab: editor.mediaRailTab,
      setMediaRailTab: editor.setMediaRailTab,
    }),
  );

  const handleMediaScopeChange = (
    value: (typeof editorAssetRailTabOptions)[number]["value"],
  ) => {
    setMediaRailTab(value);
  };

  return (
    <div className="border-base-content/10 border-b p-3">
      <Tabs
        ariaLabel="Media scope"
        disabled={isProcessing}
        items={editorAssetRailTabOptions}
        layout="equal"
        value={mediaRailTab}
        onChange={handleMediaScopeChange}
      />
    </div>
  );
}

export { EditorAssetRailTabs };
