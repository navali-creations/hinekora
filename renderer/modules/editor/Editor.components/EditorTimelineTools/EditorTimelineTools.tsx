import { FiScissors, FiTrash2 } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

function EditorTimelineTools() {
  const selectedClipId = useBoundStore((state) => state.editor.selectedClipId);
  const isDisabled = !selectedClipId;

  const handleSplitClip = () => {
    if (isDisabled) {
      return;
    }

    const { playbackSeconds, splitTimelineClipAt } =
      useBoundStore.getState().editor;
    splitTimelineClipAt(playbackSeconds);
  };

  const handleDeleteClip = () => {
    const { removeTimelineClip, selectedClipId } =
      useBoundStore.getState().editor;
    if (!selectedClipId) {
      return;
    }

    removeTimelineClip(selectedClipId);
  };

  return (
    <div
      aria-label="Editor tools"
      className="join w-fit justify-self-start rounded-md bg-base-300 p-1"
      role="toolbar"
    >
      <button
        aria-label="Split"
        className="btn btn-ghost btn-xs join-item gap-1.5"
        disabled={isDisabled}
        title="Split"
        type="button"
        onClick={handleSplitClip}
      >
        <FiScissors size={15} />
        <span>Split</span>
      </button>
      <button
        aria-label="Delete selected clip"
        className="btn btn-ghost btn-xs join-item gap-1.5 text-error disabled:text-base-content/35"
        disabled={isDisabled}
        title="Delete selected clip"
        type="button"
        onClick={handleDeleteClip}
      >
        <FiTrash2 size={15} />
        <span>Delete</span>
      </button>
    </div>
  );
}

export { EditorTimelineTools };
