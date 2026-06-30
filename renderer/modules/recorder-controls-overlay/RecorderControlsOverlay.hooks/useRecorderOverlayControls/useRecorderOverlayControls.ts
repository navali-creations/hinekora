import {
  useManagedRecorderShallow,
  useReplayClipsShallow,
  useSettingsShallow,
} from "~/renderer/store";

import { clampRewindSaveSeconds, defaultRewindSaveSeconds } from "~/types";

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
  const { clip, saveManualReplay } = useReplayClipsShallow((replayClips) => ({
    clip: replayClips.activeClip,
    saveManualReplay: replayClips.saveManualReplay,
  }));
  const rewindSaveSeconds = useSettingsShallow((settings) =>
    clampRewindSaveSeconds(
      settings.value?.deathClipSeconds ?? defaultRewindSaveSeconds,
    ),
  );
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
  const manualReplayTitle = `Save last ${rewindSaveSeconds} seconds`;
  const canSaveManualReplay =
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
  const handleSave = () => void saveManualReplay();

  return {
    canSaveManualReplay,
    canToggleRecording,
    gameRunning,
    handleSave,
    handleToggleRecording,
    isRecorderBusy,
    isSelectedModeActive,
    isSessionMode,
    isStartingRecording,
    isStoppingRecording,
    manualReplayTitle,
    recordingButtonTitle,
  };
}

export { useRecorderOverlayControls };
