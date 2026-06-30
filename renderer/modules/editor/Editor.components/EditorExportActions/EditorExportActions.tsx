import { FiArrowLeft, FiCheck, FiClipboard, FiFolder } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import { useEditorCopyActionState } from "../../Editor.hooks/useEditorCopyActionState/useEditorCopyActionState";

function EditorExportActions() {
  const { copyExport, keepEditingAfterExport, result, revealExport, status } =
    useEditorShallow((editor) => ({
      copyExport: editor.copyExport,
      keepEditingAfterExport: editor.keepEditingAfterExport,
      result: editor.exportState.result,
      revealExport: editor.revealExport,
      status: editor.exportState.status,
    }));
  const { copyState, isCopied, isCopying, runCopyAction } =
    useEditorCopyActionState();

  const handleKeepEditing = () => {
    keepEditingAfterExport();
  };

  const handleRevealExport = () => {
    if (!result) {
      return;
    }

    void revealExport(result.exportId);
  };

  const handleCopyExport = () => {
    if (!result || isCopying) {
      return;
    }

    runCopyAction(() => copyExport(result.exportId), {
      onCrash: (error) => {
        console.warn("[editor] Copy saved video crashed", { error });
      },
      onFailure: (error) => {
        console.warn("[editor] Copy saved video failed", {
          error,
        });
      },
    });
  };

  let copyLabel = "Copy to clipboard";
  if (copyState === "copied") {
    copyLabel = "Copied";
  } else if (copyState === "failed") {
    copyLabel = "Copy failed";
  }

  return (
    <>
      <button
        className="btn btn-ghost btn-sm no-drag"
        type="button"
        onClick={handleKeepEditing}
      >
        <FiArrowLeft size={15} />
        Keep editing
      </button>
      {status === "ready" && (
        <>
          <button
            className="btn btn-primary btn-sm no-drag"
            disabled={!result || isCopying}
            type="button"
            onClick={handleCopyExport}
          >
            {isCopied ? <FiCheck size={15} /> : <FiClipboard size={15} />}
            {copyLabel}
          </button>
          <button
            className="btn btn-ghost btn-sm no-drag"
            disabled={!result}
            type="button"
            onClick={handleRevealExport}
          >
            <FiFolder size={15} />
            Open file location
          </button>
        </>
      )}
    </>
  );
}

export { EditorExportActions };
