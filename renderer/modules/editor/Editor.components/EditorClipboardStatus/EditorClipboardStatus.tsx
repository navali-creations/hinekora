import clsx from "clsx";
import { FiAlertCircle, FiCheck } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

function EditorClipboardStatus() {
  const clipboardState = useEditorShallow((editor) => editor.clipboardState);
  if (clipboardState.status === "idle") {
    return null;
  }

  const isCopying = clipboardState.status === "copying";
  const isCopied = clipboardState.status === "copied";
  const label = isCopying ? "Processing" : isCopied ? "Copied" : "Copy failed";

  return (
    <div
      aria-live="polite"
      className={clsx(
        "no-drag flex h-8 items-center gap-2 rounded-md border px-3 font-medium text-xs",
        isCopying && "border-primary/30 bg-primary/10 text-primary",
        isCopied && "border-success/30 bg-success/10 text-success",
        clipboardState.status === "failed" &&
          "border-error/30 bg-error/10 text-error",
      )}
      role="status"
    >
      {isCopying ? (
        <span className="loading loading-spinner loading-xs" />
      ) : isCopied ? (
        <FiCheck size={14} />
      ) : (
        <FiAlertCircle size={14} />
      )}
      <span>{label}</span>
    </div>
  );
}

export { EditorClipboardStatus };
