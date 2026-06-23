import clsx from "clsx";
import { type MouseEvent, useEffect, useRef } from "react";
import { FiClock, FiMoreHorizontal } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import { EditorCopyActions } from "../EditorCopyActions/EditorCopyActions";
import { EditorDeleteEditAction } from "../EditorDeleteEditAction/EditorDeleteEditAction";
import { EditorNewEditAction } from "../EditorNewEditAction/EditorNewEditAction";
import { EditorSaveActions } from "../EditorSaveActions/EditorSaveActions";

interface EditorActionsMenuProps {
  isHistoryVisible: boolean;
  onToggleHistory: () => void;
}

function EditorActionsMenu({
  isHistoryVisible,
  onToggleHistory,
}: EditorActionsMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const isClipboardBusy = useEditorShallow(
    (editor) => editor.clipboardState.status === "copying",
  );
  const historyLabel = isHistoryVisible ? "Hide history" : "Show history";

  useEffect(() => {
    if (isClipboardBusy) {
      detailsRef.current?.removeAttribute("open");
    }
  }, [isClipboardBusy]);

  const handleMenuClick = (event: MouseEvent<HTMLUListElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("button") instanceof HTMLButtonElement
    ) {
      detailsRef.current?.removeAttribute("open");
    }
  };

  const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
    if (isClipboardBusy) {
      event.preventDefault();
    }
  };

  const handleToggleHistory = () => {
    if (isClipboardBusy) {
      return;
    }

    onToggleHistory();
  };

  return (
    <details className="dropdown dropdown-end no-drag" ref={detailsRef}>
      <summary
        aria-disabled={isClipboardBusy}
        aria-label="More editor actions"
        className={clsx(
          "btn btn-primary btn-sm list-none [&::-webkit-details-marker]:hidden",
          isClipboardBusy && "btn-disabled",
        )}
        data-onboarding="editor-more-options"
        onClick={handleSummaryClick}
      >
        <FiMoreHorizontal size={17} />
      </summary>
      <ul
        className="dropdown-content z-50 mt-1 grid w-56 list-none gap-1 rounded-box border border-base-content/10 bg-base-200 p-2 shadow-lg"
        onClick={handleMenuClick}
      >
        <li className="list-none">
          <EditorSaveActions variant="menu" />
        </li>
        <li className="list-none">
          <EditorCopyActions variant="menu" />
        </li>
        <li aria-hidden="true" className="list-none py-1">
          <div className="h-px w-full bg-base-content/10" />
        </li>
        <li className="list-none">
          <EditorNewEditAction variant="menu" />
        </li>
        <li aria-hidden="true" className="list-none py-1">
          <div className="h-px w-full bg-base-content/10" />
        </li>
        <li className="list-none">
          <button
            className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300"
            disabled={isClipboardBusy}
            type="button"
            onClick={handleToggleHistory}
          >
            {historyLabel}
            <FiClock size={15} />
          </button>
        </li>
        <li aria-hidden="true" className="list-none py-1">
          <div className="h-px w-full bg-base-content/10" />
        </li>
        <li className="list-none">
          <EditorDeleteEditAction />
        </li>
      </ul>
    </details>
  );
}

export { EditorActionsMenu };
