import { type MouseEvent, useRef } from "react";
import { FiMoreHorizontal } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import { EditorCopyActions } from "../EditorCopyActions/EditorCopyActions";
import { EditorDebugCopyAction } from "../EditorDebugCopyAction/EditorDebugCopyAction";
import { EditorDeleteAllEditsAction } from "../EditorDeleteAllEditsAction/EditorDeleteAllEditsAction";
import { EditorDeleteEditAction } from "../EditorDeleteEditAction/EditorDeleteEditAction";
import { EditorNewEditAction } from "../EditorNewEditAction/EditorNewEditAction";
import { EditorProjectRetentionToggle } from "../EditorProjectRetentionToggle/EditorProjectRetentionToggle";
import { EditorSaveActions } from "../EditorSaveActions/EditorSaveActions";
import { EditorShortcutCombo } from "../EditorShortcutCombo/EditorShortcutCombo";

interface EditorActionsMenuProps {
  isHistoryVisible: boolean;
  isShortcutsVisible: boolean;
  onToggleHistory: () => void;
  onToggleShortcuts: () => void;
}

function EditorActionsMenu({
  isHistoryVisible,
  isShortcutsVisible,
  onToggleHistory,
  onToggleShortcuts,
}: EditorActionsMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const isProcessing = useEditorShallow(
    (editor) =>
      editor.clipboardState.status === "copying" ||
      editor.exportState.status === "exporting",
  );
  const historyLabel = isHistoryVisible ? "Hide history" : "Show history";
  const shortcutsLabel = isShortcutsVisible
    ? "Hide shortcuts"
    : "Show shortcuts";

  const handleMenuClick = (event: MouseEvent<HTMLUListElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("button") instanceof HTMLButtonElement
    ) {
      detailsRef.current?.removeAttribute("open");
    }
  };

  const handleToggleHistory = () => {
    onToggleHistory();
  };

  const handleToggleShortcuts = () => {
    onToggleShortcuts();
  };

  return (
    <details className="dropdown dropdown-end no-drag" ref={detailsRef}>
      <summary
        aria-label="More editor actions"
        className="btn btn-primary btn-sm list-none [&::-webkit-details-marker]:hidden"
        data-onboarding="editor-more-options"
      >
        <FiMoreHorizontal size={17} />
      </summary>
      <ul
        className="dropdown-content z-50 mt-1 grid w-56 list-none gap-1 rounded-box border border-base-content/10 bg-base-200 p-2 shadow-lg"
        onClick={handleMenuClick}
      >
        <li className="list-none">
          <EditorSaveActions disabled={isProcessing} variant="menu" />
        </li>
        <li className="list-none">
          <EditorCopyActions disabled={isProcessing} variant="menu" />
        </li>
        <li className="list-none">
          <EditorNewEditAction disabled={isProcessing} variant="menu" />
        </li>
        <li aria-hidden="true" className="list-none py-1">
          <div className="h-px w-full bg-base-content/10" />
        </li>
        <li className="list-none">
          <button
            className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300"
            type="button"
            onClick={handleToggleHistory}
          >
            {historyLabel}
            <EditorShortcutCombo keys={["Ctrl", "H"]} />
          </button>
        </li>
        <li className="list-none">
          <button
            className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300"
            type="button"
            onClick={handleToggleShortcuts}
          >
            {shortcutsLabel}
          </button>
        </li>
        <li aria-hidden="true" className="list-none py-1">
          <div className="h-px w-full bg-base-content/10" />
        </li>
        <li className="list-none">
          <EditorDeleteEditAction disabled={isProcessing} />
        </li>
        <li className="list-none">
          <EditorDeleteAllEditsAction />
        </li>
        <li className="list-none">
          <EditorProjectRetentionToggle disabled={isProcessing} />
        </li>
        <li aria-hidden="true" className="list-none py-1">
          <div className="h-px w-full bg-base-content/10" />
        </li>
        <li className="list-none">
          <EditorDebugCopyAction />
        </li>
      </ul>
    </details>
  );
}

export { EditorActionsMenu };
