import {
  FiLoader as Loader2,
  FiPause as Pause,
  FiPlay as Play,
  FiSave as Save,
  FiSquare as Square,
  FiX as X,
} from "react-icons/fi";

import {
  useManagedRecorderShallow,
  useReplayClipsShallow,
} from "~/renderer/store";

import styles from "./RecorderControlsOverlayPage.module.css";

function RecorderControlsOverlayPage() {
  const { status, startBuffer, stopBuffer } = useManagedRecorderShallow(
    (managedRecorder) => ({
      status: managedRecorder.status,
      startBuffer: managedRecorder.startBuffer,
      stopBuffer: managedRecorder.stopBuffer,
    }),
  );
  const { clip, saveManualClip } = useReplayClipsShallow((replayClips) => ({
    clip: replayClips.activeClip,
    saveManualClip: replayClips.saveManual,
  }));
  const isProcessing =
    clip?.status === "death_detected" ||
    clip?.status === "saving_replay" ||
    clip?.status === "processing";

  const handleStart = () => {
    void startBuffer();
  };
  const handleStop = () => {
    void stopBuffer();
  };
  const handleSave = () => void saveManualClip();
  const handleCloseOverlay = () => {
    void window.electron.overlayWindows.hideRecorder();
  };
  const isBufferActive = status?.bufferActive === true;
  const isStartingRecording = status?.isStartingRecording === true;
  const isStoppingRecording = status?.isStoppingRecording === true;
  const isRecorderBusy = isStartingRecording || isStoppingRecording;
  const gameRunning = status?.gameRunning === true;
  const canStart = status?.available === true && gameRunning;
  const statusText = isStartingRecording
    ? "starting"
    : isStoppingRecording
      ? "stopping"
      : (clip?.status ?? (isBufferActive ? "rewind on" : "idle"));

  return (
    <main className={styles.overlay}>
      <div className={styles.actions}>
        <button
          className={`${styles.iconButton} btn btn-primary btn-square`}
          type="button"
          disabled={!canStart || isRecorderBusy || isBufferActive}
          onClick={handleStart}
          title="Enable Rewind"
        >
          {isStartingRecording ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Play size={18} />
          )}
        </button>
        <button
          className={`${styles.iconButton} btn btn-primary btn-square`}
          type="button"
          disabled={isRecorderBusy || !isBufferActive}
          onClick={handleStop}
          title="Disable Rewind"
        >
          {isStoppingRecording ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Square size={18} />
          )}
        </button>
        <button
          className={`${styles.iconButton} btn btn-primary btn-square`}
          type="button"
          disabled
          title="Pause unavailable in Rewind mode"
        >
          <Pause size={18} />
        </button>
        <button
          className={`${styles.iconButton} btn btn-primary btn-square`}
          type="button"
          disabled={
            !gameRunning || !isBufferActive || isProcessing || isRecorderBusy
          }
          onClick={handleSave}
          title="Save last 60 seconds"
        >
          <Save size={18} />
        </button>
      </div>
      <div className={styles.status}>
        {(isProcessing || isRecorderBusy) && (
          <Loader2 className="animate-spin" size={16} />
        )}
        <span className={styles.statusText}>{statusText}</span>
      </div>
      <button
        type="button"
        className={`${styles.iconButton} btn btn-primary btn-square`}
        title="Close overlay"
        aria-label="Close overlay"
        onClick={handleCloseOverlay}
      >
        <X size={16} />
      </button>
    </main>
  );
}

export { RecorderControlsOverlayPage };
