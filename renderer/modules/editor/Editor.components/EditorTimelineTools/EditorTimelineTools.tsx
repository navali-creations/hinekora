import clsx from "clsx";
import { CgSpaceBetween } from "react-icons/cg";
import {
  FiRotateCcw,
  FiRotateCw,
  FiScissors,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";
import { TbColumnRemove, TbZoomReset } from "react-icons/tb";

import { useBoundStore } from "~/renderer/store";

import {
  calculateEditorTimelineDuration,
  calculateTimelineGaps,
} from "../../Editor.utils/Editor.utils";
import { EditorTimelineSpeedMenu } from "../EditorTimelineSpeedMenu/EditorTimelineSpeedMenu";
import { EditorTimelineToolButton } from "../EditorTimelineToolButton/EditorTimelineToolButton";

function EditorTimelineTools() {
  const hasRedo = useBoundStore(
    (state) => state.editor.historyFuture.length > 0,
  );
  const hasUndo = useBoundStore((state) => state.editor.historyPast.length > 0);
  const isProcessing = useBoundStore(
    (state) => state.editor.clipboardState.status === "copying",
  );
  const project = useBoundStore((state) => state.editor.project);
  const previewHasAudio = useBoundStore(
    (state) => state.editor.previewHasAudio,
  );
  const selectedClipId = useBoundStore((state) => state.editor.selectedClipId);
  const isTimelineFitToEdit = useBoundStore(
    (state) => state.editor.isTimelineFitToEdit,
  );
  const isAudioMuted = project?.isAudioMuted === true;
  const videoTracks =
    project?.tracks.filter((track) => track.kind === "video") ?? [];
  const timelineDurationSeconds = calculateEditorTimelineDuration(project);
  const hasTimelineGaps = project
    ? calculateTimelineGaps(videoTracks, project.durationSeconds).length > 0
    : false;
  const canRedo = hasRedo && !isProcessing;
  const canUndo = hasUndo && !isProcessing;
  const canEditGaps = hasTimelineGaps && !isProcessing;
  const canFitTimeline =
    timelineDurationSeconds > 0 && !isProcessing && !isTimelineFitToEdit;
  const isClipToolDisabled = isProcessing || !selectedClipId;
  const isAudioToolDisabled = isProcessing || !project || !selectedClipId;
  const ghostToolButtonClass = "btn-ghost";
  const shouldShowAudioTools = previewHasAudio !== false;

  const handleUndo = () => {
    if (!canUndo) {
      return;
    }

    useBoundStore.getState().editor.undoProjectChange();
  };

  const handleRedo = () => {
    if (!canRedo) {
      return;
    }

    useBoundStore.getState().editor.redoProjectChange();
  };

  const handleSplitClip = () => {
    if (isClipToolDisabled) {
      return;
    }

    const { playbackSeconds, splitTimelineClipAt } =
      useBoundStore.getState().editor;
    splitTimelineClipAt(playbackSeconds);
  };

  const handleToggleAudioMuted = () => {
    if (isAudioToolDisabled) {
      return;
    }

    useBoundStore.getState().editor.toggleProjectAudioMuted();
  };

  const handleFitTimeline = () => {
    if (!canFitTimeline) {
      return;
    }

    useBoundStore.getState().editor.fitTimelineToEdit();
  };

  const handleRemoveAllGaps = () => {
    if (!canEditGaps) {
      return;
    }

    useBoundStore.getState().editor.removeAllTimelineGaps();
  };

  const handleHighlightGaps = () => {
    if (!canEditGaps) {
      return;
    }

    useBoundStore.getState().editor.setTimelineGapsHighlighted(true);
  };

  const handleClearGapHighlight = () => {
    useBoundStore.getState().editor.setTimelineGapsHighlighted(false);
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
      className="relative z-30 flex w-fit items-center justify-self-start rounded-md bg-base-300 p-1 shadow-sm"
      role="toolbar"
    >
      <EditorTimelineToolButton
        ariaLabel="Undo"
        className={ghostToolButtonClass}
        disabled={!canUndo}
        icon={FiRotateCcw}
        tooltip="Undo last edit"
        onClick={handleUndo}
      />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-base-content/15" />
      <EditorTimelineToolButton
        ariaLabel="Redo"
        className={ghostToolButtonClass}
        disabled={!canRedo}
        icon={FiRotateCw}
        tooltip="Redo last edit"
        onClick={handleRedo}
      />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-base-content/15" />
      <EditorTimelineToolButton
        ariaLabel="Split"
        className={ghostToolButtonClass}
        disabled={isClipToolDisabled}
        icon={FiScissors}
        tooltip="Split selected clip"
        onClick={handleSplitClip}
      />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-base-content/15" />
      <EditorTimelineSpeedMenu />
      {shouldShowAudioTools && (
        <>
          <span
            aria-hidden="true"
            className="mx-1 h-5 w-px bg-base-content/15"
          />
          <EditorTimelineToolButton
            ariaLabel={isAudioMuted ? "Unmute audio" : "Mute audio"}
            ariaPressed={isAudioMuted}
            className={isAudioMuted ? "btn-primary" : "btn-ghost"}
            disabled={isAudioToolDisabled}
            icon={isAudioMuted ? FiVolumeX : FiVolume2}
            tooltip={
              isAudioMuted
                ? "Restore audio in saved and copied videos"
                : "Mute audio in saved and copied videos"
            }
            onClick={handleToggleAudioMuted}
          />
        </>
      )}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-base-content/15" />
      <EditorTimelineToolButton
        ariaLabel="Fit timeline"
        className={isTimelineFitToEdit ? "btn-primary" : ghostToolButtonClass}
        disabled={!canFitTimeline}
        icon={TbZoomReset}
        tooltip="Fit timeline to edit"
        onClick={handleFitTimeline}
      />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-base-content/15" />
      <EditorTimelineToolButton
        ariaLabel="Clear gaps"
        className={ghostToolButtonClass}
        disabled={!canEditGaps}
        icon={CgSpaceBetween}
        tooltip="Clear every empty gap from the timeline"
        onBlur={handleClearGapHighlight}
        onClick={handleRemoveAllGaps}
        onFocus={handleHighlightGaps}
        onMouseEnter={handleHighlightGaps}
        onMouseLeave={handleClearGapHighlight}
      />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-base-content/15" />
      <EditorTimelineToolButton
        ariaLabel="Delete selected clip"
        className={clsx(
          ghostToolButtonClass,
          "text-error disabled:text-base-content/35",
        )}
        disabled={isClipToolDisabled}
        icon={TbColumnRemove}
        tooltip="Delete selected clip"
        onClick={handleDeleteClip}
      />
    </div>
  );
}

export { EditorTimelineTools };
