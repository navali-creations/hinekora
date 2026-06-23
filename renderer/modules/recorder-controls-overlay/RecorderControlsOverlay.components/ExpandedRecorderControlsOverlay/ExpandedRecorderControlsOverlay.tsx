import type { ChangeEvent } from "react";
import {
  FiLoader as Loader2,
  FiMinimize2 as Minimize,
  FiPlay as Play,
  FiPlusSquare as PlusSquare,
  FiSquare as Square,
  FiX as X,
} from "react-icons/fi";
import { HiViewGrid } from "react-icons/hi";
import { PiFilmSlate } from "react-icons/pi";

import { CaptureModeTabs } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.components/CaptureModeTabs/CaptureModeTabs";
import { RecorderOverlayTimer } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.components/RecorderOverlayTimer/RecorderOverlayTimer";
import { useRecorderOverlayControls } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.hooks/useRecorderOverlayControls/useRecorderOverlayControls";
import { useProfilesShallow } from "~/renderer/store";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";
import {
  closeRecorderOverlay,
  openRecorderAuraOverlay,
} from "./ExpandedRecorderControlsOverlay.utils";

function ExpandedRecorderControlsOverlay({
  onMinimize,
}: {
  onMinimize: () => void;
}) {
  const {
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
  } = useRecorderOverlayControls();
  const { profileItems, selectedProfileId, selectProfile } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      selectProfile: profiles.select,
    }),
  );
  const selectedProfile =
    profileItems.find((profile) => profile.id === selectedProfileId) ??
    profileItems[0] ??
    null;
  const canUnlockAuras = gameRunning && !isRecorderBusy && !!selectedProfile;

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
  const handleEditAura = () =>
    openRecorderAuraOverlay({
      gameRunning,
      isRecorderBusy,
      profileId: selectedProfile?.id ?? null,
      startAddingAura: false,
    });
  const handleAddAura = () =>
    openRecorderAuraOverlay({
      gameRunning,
      isRecorderBusy,
      profileId: selectedProfile?.id ?? null,
      startAddingAura: true,
    });
  const handleCloseOverlay = () => closeRecorderOverlay();

  return (
    <main className={`${styles.overlay} ${styles.expanded}`}>
      <div className={styles.header}>
        <CaptureModeTabs />
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.primaryControls}>
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
              disabled={!canSaveManualClip}
              onClick={handleSave}
              title={manualClipTitle}
              aria-label={manualClipTitle}
            >
              <PiFilmSlate size={19} />
            </button>
          )}
          <RecorderOverlayTimer />
        </div>
        <div className={styles.windowControls}>
          <button
            type="button"
            className={`${styles.windowButton} btn btn-ghost btn-square`}
            title="Minimize overlay"
            aria-label="Minimize overlay"
            onClick={onMinimize}
          >
            <Minimize size={15} />
          </button>
          <button
            type="button"
            className={`${styles.windowButton} btn btn-ghost btn-square`}
            title="Close overlay"
            aria-label="Close overlay"
            onClick={handleCloseOverlay}
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className={styles.auraControls}>
        <button
          className={`${styles.iconButton} btn btn-primary btn-square`}
          type="button"
          disabled={!canUnlockAuras}
          onClick={handleEditAura}
          title={
            !gameRunning
              ? "Start the selected game before editing auras"
              : "Edit auras"
          }
          aria-label="Edit auras"
        >
          <HiViewGrid size={19} />
        </button>
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
          <PlusSquare size={19} />
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
      </div>
    </main>
  );
}

export { ExpandedRecorderControlsOverlay };
