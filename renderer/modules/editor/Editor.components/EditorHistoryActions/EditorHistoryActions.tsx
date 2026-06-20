import { FiCornerUpLeft, FiCornerUpRight } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

function EditorHistoryActions() {
  const { canRedo, canUndo, redoProjectChange, undoProjectChange } =
    useEditorShallow((editor) => ({
      canRedo: editor.historyFuture.length > 0,
      canUndo: editor.historyPast.length > 0,
      redoProjectChange: editor.redoProjectChange,
      undoProjectChange: editor.undoProjectChange,
    }));

  const handleUndo = () => {
    undoProjectChange();
  };

  const handleRedo = () => {
    redoProjectChange();
  };

  return (
    <div className="join no-drag">
      <button
        aria-label="Undo"
        className="btn btn-sm join-item border-base-content/20 bg-base-300 hover:bg-base-300/80"
        disabled={!canUndo}
        title="Undo"
        type="button"
        onClick={handleUndo}
      >
        <FiCornerUpLeft size={15} />
        Undo
      </button>
      <button
        aria-label="Redo"
        className="btn btn-sm join-item border-base-content/20 bg-base-300 hover:bg-base-300/80"
        disabled={!canRedo}
        title="Redo"
        type="button"
        onClick={handleRedo}
      >
        <FiCornerUpRight size={15} />
        Redo
      </button>
    </div>
  );
}

export { EditorHistoryActions };
