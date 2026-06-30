import {
  FiMaximize2 as Expand,
  FiLoader as Loader2,
  FiPlay as Play,
  FiSquare as Square,
  FiX as X,
} from "react-icons/fi";
import { PiFilmSlate } from "react-icons/pi";

import { RecorderOverlayTimer } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.components/RecorderOverlayTimer/RecorderOverlayTimer";
import { useRecorderOverlayControls } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.hooks/useRecorderOverlayControls/useRecorderOverlayControls";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";
import { closeRecorderOverlay } from "../ExpandedRecorderControlsOverlay/ExpandedRecorderControlsOverlay.utils";

interface MinimizedRecorderControlsOverlayProps {
  onExpand: () => void;
}

function MinimizedRecorderControlsOverlay({
  onExpand,
}: MinimizedRecorderControlsOverlayProps) {
  const {
    canSaveManualReplay,
    canToggleRecording,
    handleSave,
    handleToggleRecording,
    isSelectedModeActive,
    isSessionMode,
    isStartingRecording,
    isStoppingRecording,
    manualReplayTitle,
    recordingButtonTitle,
  } = useRecorderOverlayControls();
  return (
    <main
      className={`${styles.overlay} box-border flex h-screen w-screen items-center overflow-hidden px-1.5 py-[0.3125rem]`}
    >
      <div className="flex w-full min-w-0 items-center gap-[0.3125rem]">
        <button
          className={`${styles.iconButton} btn btn-primary btn-square`}
          type="button"
          disabled={!canToggleRecording}
          onClick={handleToggleRecording}
          title={recordingButtonTitle}
          aria-label={recordingButtonTitle}
        >
          {isStartingRecording || isStoppingRecording ? (
            <Loader2 className="animate-spin" size={18} />
          ) : isSelectedModeActive ? (
            <Square size={18} />
          ) : (
            <Play size={18} />
          )}
        </button>
        {!isSessionMode && (
          <button
            className={`${styles.iconButton} btn btn-primary btn-square`}
            type="button"
            disabled={!canSaveManualReplay}
            onClick={handleSave}
            title={manualReplayTitle}
            aria-label={manualReplayTitle}
          >
            <PiFilmSlate size={19} />
          </button>
        )}
        <RecorderOverlayTimer />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={`${styles.windowButton} btn btn-ghost btn-square`}
            title="Expand overlay"
            aria-label="Expand overlay"
            onClick={onExpand}
          >
            <Expand size={15} />
          </button>
          <button
            type="button"
            className={`${styles.windowButton} btn btn-ghost btn-square`}
            title="Close overlay"
            aria-label="Close overlay"
            onClick={closeRecorderOverlay}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </main>
  );
}

export { MinimizedRecorderControlsOverlay };
