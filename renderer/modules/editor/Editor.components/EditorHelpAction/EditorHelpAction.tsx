import { useRef, useState } from "react";
import type { IconType } from "react-icons";
import { CgSpaceBetween } from "react-icons/cg";
import {
  FiClipboard,
  FiClock,
  FiHelpCircle,
  FiMoreHorizontal,
  FiSave,
  FiScissors,
  FiVolumeX,
} from "react-icons/fi";
import { TbColumnRemove } from "react-icons/tb";

import { Modal, type ModalHandle } from "~/renderer/components/Modal/Modal";
import { type TabItem, Tabs } from "~/renderer/components/Tabs/Tabs";

import { editorHistoryLimit } from "../../Editor.slice/Editor.slice.constants";

type EditorHelpTab = "tools" | "saving" | "history" | "more";

const editorHelpTabs: {
  Icon: IconType;
  label: string;
  value: EditorHelpTab;
}[] = [
  { Icon: FiScissors, label: "Tools", value: "tools" },
  { Icon: FiSave, label: "Saving", value: "saving" },
  { Icon: FiClock, label: "History", value: "history" },
  { Icon: FiMoreHorizontal, label: "More", value: "more" },
];

const toolHelpItems: { Icon: IconType; label: string; text: string }[] = [
  {
    Icon: FiScissors,
    label: "Split",
    text: "Cuts the selected clip at the current playhead.",
  },
  {
    Icon: FiVolumeX,
    label: "Mute",
    text: "Toggles silent output for saved and copied videos. Hidden when the selected video has no audio track.",
  },
  {
    Icon: CgSpaceBetween,
    label: "Clear gaps",
    text: "Moves timeline clips together without changing their trims.",
  },
  {
    Icon: TbColumnRemove,
    label: "Delete",
    text: "Removes the selected timeline clip or hovered gap.",
  },
];

function EditorHelpAction() {
  const modalRef = useRef<ModalHandle>(null);
  const [activeTab, setActiveTab] = useState<EditorHelpTab>("tools");

  const handleOpenHelp = () => {
    modalRef.current?.open();
  };

  const handleCloseHelp = () => {
    modalRef.current?.close();
  };

  const handleHelpTabChange = (tab: EditorHelpTab) => {
    setActiveTab(tab);
  };

  const helpTabItems: TabItem<EditorHelpTab>[] = editorHelpTabs.map(
    ({ Icon, label, value }) => ({
      label: (
        <span className="flex items-center gap-1.5">
          <Icon size={14} />
          <span>{label}</span>
        </span>
      ),
      value,
    }),
  );

  return (
    <>
      <button
        aria-label="Editor help"
        className="btn btn-ghost btn-sm btn-square no-drag"
        title="Editor help"
        type="button"
        onClick={handleOpenHelp}
      >
        <FiHelpCircle size={17} />
      </button>

      <Modal ref={modalRef} size="lg" surface="base-200">
        <div className="grid min-h-[430px] grid-rows-[auto_auto_1fr_auto] gap-4">
          <header>
            <h2 className="m-0 font-bold text-lg">Editor help</h2>
            <p className="m-0 mt-1 text-base-content/65 text-sm">
              Timeline edits autosave to the selected edit. Saving, copying, and
              tool actions use the current timeline state.
            </p>
          </header>

          <Tabs
            ariaLabel="Editor help sections"
            items={helpTabItems}
            layout="equal"
            value={activeTab}
            onChange={handleHelpTabChange}
          />

          <div className="min-h-[230px]">
            {activeTab === "tools" && (
              <section className="grid gap-3">
                <ul className="m-0 grid list-none gap-2 p-0 text-sm">
                  {toolHelpItems.map(({ Icon, label, text }) => (
                    <li className="grid grid-cols-[auto_1fr] gap-2" key={label}>
                      <Icon className="mt-0.5 text-primary" size={15} />
                      <span>
                        <strong>{label}:</strong> {text}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-2 text-sm">
                  <p className="m-0 flex flex-wrap items-center gap-2">
                    <kbd className="kbd kbd-sm">Del</kbd>
                    <span>Delete the selected clip or hovered gap.</span>
                  </p>
                </div>
              </section>
            )}

            {activeTab === "saving" && (
              <section className="grid gap-3">
                <p className="m-0 grid grid-cols-[auto_1fr] gap-2 text-sm">
                  <FiSave className="mt-0.5 text-primary" size={15} />
                  <span>
                    Edits autosave to the selected edit. Save video renders a
                    new MP4 or overwrites the selected source, depending on the
                    save mode.
                  </span>
                </p>
                <p className="m-0 grid grid-cols-[auto_1fr] gap-2 text-sm">
                  <FiClipboard className="mt-0.5 text-primary" size={15} />
                  <span>
                    Copy to clipboard is in More options. It renders the current
                    edit as a temporary MP4, shows Processing while it works,
                    and places that file on the clipboard.
                  </span>
                </p>
              </section>
            )}

            {activeTab === "history" && (
              <section className="grid gap-3">
                <p className="m-0 text-sm">
                  Open history from More editor actions. The rail shows recent
                  undo and redo entries for the selected edit.
                </p>
                <p className="m-0 text-base-content/65 text-sm">
                  Hinekora keeps up to {editorHistoryLimit} history entries per
                  edit while the editor is open.
                </p>
              </section>
            )}

            {activeTab === "more" && (
              <section className="grid gap-3">
                <ul className="m-0 grid list-none gap-2 p-0 text-sm">
                  <li>
                    <strong>Save:</strong> Opens save settings for the current
                    edit.
                  </li>
                  <li>
                    <strong>Copy to clipboard:</strong> Renders the current edit
                    and copies the temporary MP4 file.
                  </li>
                  <li>
                    <strong>New edit:</strong> Creates a fresh editor project.
                  </li>
                  <li>
                    <strong>History:</strong> Shows undo and redo history.
                  </li>
                  <li>
                    <strong>Shortcuts:</strong> Opens the grouped timeline and
                    editor command shortcut rail.
                  </li>
                  <li>
                    <strong>Delete edit:</strong> Removes the selected saved
                    edit.
                  </li>
                  <li>
                    <strong>Delete all edits:</strong> Removes all saved editor
                    edits.
                  </li>
                  <li>
                    <strong>Auto-prune all but last 5:</strong> Automatically
                    keeps only the newest saved edits.
                  </li>
                </ul>
              </section>
            )}
          </div>

          <div className="modal-action m-0">
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={handleCloseHelp}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export { EditorHelpAction };
