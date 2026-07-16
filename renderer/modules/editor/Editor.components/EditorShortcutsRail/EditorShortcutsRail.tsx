import { useState } from "react";
import { FiCommand, FiX } from "react-icons/fi";

import { type TabItem, Tabs } from "~/renderer/components/Tabs/Tabs";
import { useEditorShallow } from "~/renderer/store";

import {
  editorCommandShortcutItems,
  editorShortcutItems,
  editorTimelineShortcutItems,
} from "../../Editor.utils/EditorShortcuts.utils";

type EditorShortcutsTab = "editor" | "timeline";

const shortcutTabs: TabItem<EditorShortcutsTab>[] = [
  { label: "Timeline", value: "timeline" },
  { label: "Editor", value: "editor" },
];

function EditorShortcutsRail() {
  const [activeTab, setActiveTab] = useState<EditorShortcutsTab>("timeline");
  const closeSidePanel = useEditorShallow((editor) => editor.closeSidePanel);
  const activeItems =
    activeTab === "timeline"
      ? editorTimelineShortcutItems
      : editorCommandShortcutItems;

  const handleShortcutTabChange = (tab: EditorShortcutsTab) => {
    setActiveTab(tab);
  };

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200">
      <div className="flex items-center gap-2 border-base-content/10 border-b p-3">
        <span className="rounded bg-base-300 p-1.5 text-primary">
          <FiCommand size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-semibold text-sm">Shortcuts</h2>
          <p className="m-0 text-base-content/55 text-xs">
            {editorShortcutItems.length} commands
          </p>
        </div>
        <div
          className="tooltip tooltip-left no-drag"
          data-tip="Close shortcuts panel"
        >
          <button
            aria-label="Close shortcuts panel"
            className="btn btn-ghost btn-xs"
            type="button"
            onClick={closeSidePanel}
          >
            <FiX size={15} />
          </button>
        </div>
      </div>

      <div className="border-base-content/10 border-b p-3">
        <Tabs
          ariaLabel="Shortcut groups"
          items={shortcutTabs}
          layout="equal"
          value={activeTab}
          onChange={handleShortcutTabChange}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid">
          {activeItems.map((item) => (
            <div
              className="grid gap-1.5 border-base-content/10 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
              key={item.keys.join("+")}
            >
              <div className="flex flex-wrap gap-1">
                {item.keys.map((key) => (
                  <kbd className="kbd kbd-sm" key={key}>
                    {key}
                  </kbd>
                ))}
              </div>
              <p className="m-0 text-base-content/60 text-xs">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export { EditorShortcutsRail };
