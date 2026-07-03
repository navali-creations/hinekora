import { useEffect, useRef, useState } from "react";

import {
  useManagedRecorderShallow,
  useReplayClipsShallow,
  useSettingsShallow,
} from "~/renderer/store";

import { clampRewindSaveSeconds, defaultRewindSaveSeconds } from "~/types";

function useRecorderOverlayControls() {
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const bookmarkSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
  const showBookmarkAction = isSessionMode;
  const canSaveManualReplay =
    !isSessionMode &&
    gameRunning &&
    isBufferActive &&
    !isProcessing &&
    !isRecorderBusy;
  const canCreateBookmark =
    gameRunning && isSessionMode && isSessionActive && !isRecorderBusy;

  useEffect(
    () => () => {
      if (bookmarkSavedTimeoutRef.current) {
        clearTimeout(bookmarkSavedTimeoutRef.current);
      }
    },
    [],
  );

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
  const handleCreateBookmark = () => {
    if (!canCreateBookmark) {
      return;
    }

    void window.electron.bookmarks
      .createManual()
      .then((result) => {
        if (!result.ok) {
          return;
        }

        setBookmarkSaved(true);
        if (bookmarkSavedTimeoutRef.current) {
          clearTimeout(bookmarkSavedTimeoutRef.current);
        }
        bookmarkSavedTimeoutRef.current = setTimeout(() => {
          setBookmarkSaved(false);
          bookmarkSavedTimeoutRef.current = null;
        }, 3_000);
      })
      .catch(() => {
        setBookmarkSaved(false);
      });
  };

  return {
    bookmarkSaved,
    canCreateBookmark,
    canSaveManualReplay,
    canToggleRecording,
    gameRunning,
    handleCreateBookmark,
    handleSave,
    handleToggleRecording,
    isRecorderBusy,
    isSelectedModeActive,
    isSessionMode,
    isStartingRecording,
    isStoppingRecording,
    manualReplayTitle,
    recordingButtonTitle,
    showBookmarkAction,
  };
}

export { useRecorderOverlayControls };
