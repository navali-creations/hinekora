import clsx from "clsx";
import { useState } from "react";
import { FiCommand, FiX } from "react-icons/fi";

import {
  editorCommandShortcutItems,
  editorShortcutItems,
  editorTimelineShortcutItems,
} from "../../Editor.utils/EditorShortcuts.utils";

interface EditorShortcutsRailProps {
  onClose: () => void;
}

type EditorShortcutsTab = "editor" | "timeline";

function EditorShortcutsRail({ onClose }: EditorShortcutsRailProps) {
  const [activeTab, setActiveTab] = useState<EditorShortcutsTab>("timeline");
  const activeItems =
    activeTab === "timeline"
      ? editorTimelineShortcutItems
      : editorCommandShortcutItems;

  const handleShowTimelineShortcuts = () => {
    setActiveTab("timeline");
  };

  const handleShowEditorShortcuts = () => {
    setActiveTab("editor");
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
            onClick={onClose}
          >
            <FiX size={15} />
          </button>
        </div>
      </div>

      <div className="border-base-content/10 border-b p-3">
        <div
          aria-label="Shortcut groups"
          className="tabs tabs-boxed tabs-xs grid grid-cols-2 bg-base-300 p-1"
          role="tablist"
        >
          <button
            aria-selected={activeTab === "timeline"}
            className={clsx(
              "tab rounded-md font-semibold",
              activeTab === "timeline"
                ? "tab-active bg-primary text-primary-content shadow-sm"
                : "text-base-content/65 hover:bg-base-200 hover:text-base-content",
            )}
            role="tab"
            type="button"
            onClick={handleShowTimelineShortcuts}
          >
            Timeline
          </button>
          <button
            aria-selected={activeTab === "editor"}
            className={clsx(
              "tab rounded-md font-semibold",
              activeTab === "editor"
                ? "tab-active bg-primary text-primary-content shadow-sm"
                : "text-base-content/65 hover:bg-base-200 hover:text-base-content",
            )}
            role="tab"
            type="button"
            onClick={handleShowEditorShortcuts}
          >
            Editor
          </button>
        </div>
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
