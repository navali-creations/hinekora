import { type ChangeEvent, useMemo } from "react";
import {
  FiCrop as Crop,
  FiLoader as Loader2,
  FiPlay as Play,
  FiSquare as Square,
  FiX as X,
} from "react-icons/fi";
import { PiFilmSlate } from "react-icons/pi";

import { trackEvent } from "~/renderer/modules/umami";
import {
  useManagedRecorderShallow,
  useProfilesShallow,
  useReplayClipsShallow,
} from "~/renderer/store";

import styles from "./RecorderControlsOverlayPage.module.css";

function RecorderControlsOverlayPage() {
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
  const { profileItems, selectedProfileId, selectProfile } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      selectProfile: profiles.select,
    }),
  );
  const { clip, saveManualClip } = useReplayClipsShallow((replayClips) => ({
    clip: replayClips.activeClip,
    saveManualClip: replayClips.saveManual,
  }));
  const selectedProfile = useMemo(
    () =>
      profileItems.find((profile) => profile.id === selectedProfileId) ??
      profileItems[0] ??
      null,
    [profileItems, selectedProfileId],
  );
  const isProcessing =
    clip?.status === "death_detected" ||
    clip?.status === "saving_replay" ||
    clip?.status === "processing";

  const handleStart = () => {
    void (isSessionMode ? startRunRecording() : startBuffer());
  };
  const handleStop = () => {
    void (isSessionMode ? stopRunRecording() : stopBuffer());
  };
  const handleSave = () => void saveManualClip();
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
  const handleProfileChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const profileId = event.currentTarget.value;
    if (!profileId) {
      return;
    }

    selectProfile(profileId);
    if (gameRunning) {
      void window.electron.overlayWindows.showAura(profileId);
    }
  };
  const handleAddAura = () => {
    if (!selectedProfile || !gameRunning || isRecorderBusy) {
      return;
    }

    trackEvent("aura-add-started", {
      source: "recorder-overlay",
    });
    void window.electron.overlayWindows
      .setAuraLocked(false)
      .then(() =>
        window.electron.overlayWindows.showAura(selectedProfile.id, {
          startAddingAura: true,
        }),
      )
      .catch((error: unknown) => {
        console.warn("[recorder-overlay] Add aura failed", {
          error,
        });
        trackEvent("aura-add-failed", {
          source: "recorder-overlay",
        });
      });
  };
  const handleCloseOverlay = () => {
    trackEvent("recorder-overlay-closed", {
      source: "overlay",
    });
    void window.electron.overlayWindows.hideRecorder();
  };
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
  const manualClipTitle = isSessionMode
    ? "Manual clips are only available in Rewind"
    : "Save last 60 seconds";
  const canSaveManualClip =
    !isSessionMode &&
    gameRunning &&
    isBufferActive &&
    !isProcessing &&
    !isRecorderBusy;
  const canUnlockAuras = gameRunning && !isRecorderBusy && !!selectedProfile;

  return (
    <main className={styles.overlay}>
      <div className={styles.actions}>
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
        <button
          className={`${styles.iconButton} btn btn-primary btn-square`}
          type="button"
          disabled={!canSaveManualClip}
          onClick={handleSave}
          title={manualClipTitle}
          aria-label={manualClipTitle}
        >
          <PiFilmSlate size={19} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button
          className={`${styles.iconButton} btn btn-primary btn-square`}
          type="button"
          disabled={!canUnlockAuras}
          onClick={handleAddAura}
          title={
            !gameRunning
              ? "Start the selected game before adding auras"
              : "Add aura"
          }
          aria-label="Add aura"
        >
          <Crop size={18} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <select
          className={`${styles.profileSelect} select select-bordered select-primary select-xs`}
          value={selectedProfile?.id ?? ""}
          onChange={handleProfileChange}
          disabled={profileItems.length === 0}
          title="Aura profile"
          aria-label="Aura profile"
        >
          {profileItems.length === 0 ? (
            <option value="">No profiles</option>
          ) : (
            profileItems.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))
          )}
        </select>
        <span className={styles.divider} aria-hidden="true" />
        <button
          type="button"
          className={`${styles.iconButton} btn btn-primary btn-square`}
          title="Close overlay"
          aria-label="Close overlay"
          onClick={handleCloseOverlay}
        >
          <X size={16} />
        </button>
      </div>
    </main>
  );
}

export { RecorderControlsOverlayPage };
