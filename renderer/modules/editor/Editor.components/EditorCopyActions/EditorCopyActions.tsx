import clsx from "clsx";
import { FiCheck, FiClipboard } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import { EditorShortcutCombo } from "../EditorShortcutCombo/EditorShortcutCombo";
import { createCopyDisabledReason } from "./EditorCopyActions.utils";

interface EditorCopyActionsProps {
  disabled?: boolean;
  variant?: "button" | "menu";
}

function EditorCopyActions({
  disabled = false,
  variant = "button",
}: EditorCopyActionsProps) {
  const {
    clipboardStatus,
    copyProjectToClipboard,
    exportStatus,
    project,
    selectedClipId,
  } = useEditorShallow((editor) => ({
    clipboardStatus: editor.clipboardState.status,
    copyProjectToClipboard: editor.copyProjectToClipboard,
    exportStatus: editor.exportState.status,
    project: editor.project,
    selectedClipId: editor.selectedClipId,
  }));
  const isCopied = clipboardStatus === "copied";
  const isCopying = clipboardStatus === "copying";
  const isFailed = clipboardStatus === "failed";
  const isDisabled =
    disabled ||
    !project ||
    !selectedClipId ||
    isCopying ||
    exportStatus === "exporting";
  const disabledReason = createCopyDisabledReason({
    exportStatus,
    isCopying,
    project,
    selectedClipId,
  });
  let copyLabel = "Copy to clipboard";
  if (isCopying) {
    copyLabel = "Processing";
  } else if (isCopied) {
    copyLabel = "Copied to clipboard";
  } else if (isFailed) {
    copyLabel = "Copy failed";
  }

  const handleCopy = () => {
    if (isDisabled) {
      return;
    }

    void copyProjectToClipboard().then((result) => {
      if (!result.ok) {
        console.warn("[editor] Copy current edit failed", {
          error: result.error,
        });
      }
    });
  };

  const button = (
    <button
      className={clsx(
        "no-drag",
        variant === "menu"
          ? "flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300 disabled:cursor-not-allowed disabled:opacity-45"
          : "btn btn-outline btn-sm border-base-content/20 bg-base-200/70 hover:border-primary/55 hover:bg-base-300",
      )}
      disabled={isDisabled}
      type="button"
      onClick={handleCopy}
    >
      <span>{copyLabel}</span>
      {isCopying ? (
        <span className="loading loading-spinner loading-xs" />
      ) : isCopied ? (
        <FiCheck size={15} />
      ) : variant === "menu" ? (
        <EditorShortcutCombo keys={["Ctrl", "C"]} />
      ) : (
        <FiClipboard size={15} />
      )}
    </button>
  );

  if (variant === "menu") {
    if (!disabledReason) {
      return button;
    }

    return (
      <div
        className="tooltip tooltip-left no-drag block w-full"
        data-tip={disabledReason}
      >
        <span
          aria-disabled="true"
          className="flex h-8 w-full cursor-not-allowed items-center justify-between gap-3 rounded-md px-3 text-left text-base-content/45 text-sm"
        >
          <span>{copyLabel}</span>
          {isCopying ? (
            <span className="loading loading-spinner loading-xs" />
          ) : isCopied ? (
            <FiCheck size={15} />
          ) : variant === "menu" ? (
            <EditorShortcutCombo keys={["Ctrl", "C"]} />
          ) : (
            <FiClipboard size={15} />
          )}
        </span>
      </div>
    );
  }

  return (
    <div
      className="tooltip tooltip-left no-drag"
      data-tip={disabledReason ?? "Copies the video in its current state"}
    >
      {button}
    </div>
  );
}

export { EditorCopyActions };
