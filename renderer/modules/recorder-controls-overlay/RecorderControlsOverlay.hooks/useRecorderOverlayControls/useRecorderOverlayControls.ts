import {
  useManagedRecorderShallow,
  useReplayClipsShallow,
} from "~/renderer/store";

function useRecorderOverlayControls() {
  const {
    captureMode,
    status,
    startBuffer,
    startRunRecording,
    stopBuffer,
    stopRunRecording,
  } = useManagedRecorderShallow((managedRecorder) => ({
    captureMode: managedRecorder.captureMode,
    status: managedRecorder.status,
    startBuffer: managedRecorder.startBuffer,
    startRunRecording: managedRecorder.startRunRecording,
    stopBuffer: managedRecorder.stopBuffer,
    stopRunRecording: managedRecorder.stopRunRecording,
  }));
  const { clip, saveManualClip } = useReplayClipsShallow((replayClips) => ({
    clip: replayClips.activeClip,
    saveManualClip: replayClips.saveManual,
  }));
  const isProcessing =
    clip?.status === "death_detected" ||
    clip?.status === "saving_replay" ||
    clip?.status === "processing";
  const isSessionMode = captureMode === "session";
  const isBufferActive = status?.bufferActive === true;
  const isSessionActive = status?.runRecordingActive === true;
  const isSelectedModeActive = isSessionMode ? isSessionActive : isBufferActive;
  const isStartingRecording = status?.isStartingRecording === true;
  const isStoppingRecording = status?.isStoppingRecording === true;
  const isRecorderBusy = isStartingRecording || isStoppingRecording;
  const gameRunning = status?.gameRunning === true;
  const canStart = status?.available === true && gameRunning;
  const canToggleRecording =
    !isRecorderBusy &&
    (isSelectedModeActive ||
      (canStart && (isSessionMode ? !isBufferActive : !isSessionActive)));
  const recordingButtonTitle = isSessionMode
    ? isSessionActive
      ? "Stop & save recording"
      : "Start recording"
    : isBufferActive
      ? "Disable Rewind"
      : "Enable Rewind";
  const manualClipTitle = "Save last 60 seconds";
  const canSaveManualClip =
    !isSessionMode &&
    gameRunning &&
    isBufferActive &&
    !isProcessing &&
    !isRecorderBusy;

  const handleStart = () => {
    void (isSessionMode ? startRunRecording() : startBuffer());
  };
  const handleStop = () => {
    void (isSessionMode ? stopRunRecording() : stopBuffer());
  };
  const handleToggleRecording = () => {
    if (isRecorderBusy) {
      return;
    }

    if (isSelectedModeActive) {
      handleStop();
      return;
    }

    handleStart();
  };
  const handleSave = () => void saveManualClip();

  return {
    canSaveManualClip,
    canToggleRecording,
    gameRunning,
    handleSave,
    handleToggleRecording,
    isRecorderBusy,
    isSelectedModeActive,
    isSessionMode,
    isStartingRecording,
    isStoppingRecording,
    manualClipTitle,
    recordingButtonTitle,
  };
}

export { useRecorderOverlayControls };
