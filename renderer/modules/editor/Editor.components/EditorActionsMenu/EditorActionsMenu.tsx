import { type MouseEvent, useRef } from "react";
import { FiClock, FiMoreHorizontal } from "react-icons/fi";

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
  const historyLabel = isHistoryVisible ? "Hide history" : "Show history";

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
