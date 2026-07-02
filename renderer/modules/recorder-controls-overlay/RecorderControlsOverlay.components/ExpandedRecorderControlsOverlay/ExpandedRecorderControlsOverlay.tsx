import type { ChangeEvent } from "react";
import {
  FiLoader as Loader2,
  FiPlay as Play,
  FiSquare as Square,
} from "react-icons/fi";
import { HiViewGrid } from "react-icons/hi";
import { PiBezierCurve, PiFilmSlate, PiSelection } from "react-icons/pi";
import { TbRouteSquare2 } from "react-icons/tb";

import {
  getProfilesForGame,
  resolveActiveGameProfile,
} from "~/renderer/modules/profiles/Profiles.utils/Profiles.utils";
import { CaptureModeTabs } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.components/CaptureModeTabs/CaptureModeTabs";
import { RecorderOverlayTimer } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.components/RecorderOverlayTimer/RecorderOverlayTimer";
import { useRecorderOverlayControls } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.hooks/useRecorderOverlayControls/useRecorderOverlayControls";
import { useProfilesShallow, useSettingsSelector } from "~/renderer/store";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";
import { RecorderAuraActionButton } from "../RecorderAuraActionButton/RecorderAuraActionButton";
import { RecorderOverlayWindowActions } from "../RecorderOverlayWindowActions/RecorderOverlayWindowActions";
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
  } = useRecorderOverlayControls();
  const { profileItems, selectedProfileId, selectProfile } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      selectProfile: profiles.select,
    }),
  );
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );
  const activeGameProfiles = getProfilesForGame(profileItems, activeGame);
  const selectedProfile = resolveActiveGameProfile(
    profileItems,
    selectedProfileId,
    activeGame,
  );
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
      addAuraShape: "rect",
      gameRunning,
      isRecorderBusy,
      profileId: selectedProfile?.id ?? null,
      startAddingAura: true,
    });
  const handleAddArchedAura = () =>
    openRecorderAuraOverlay({
      addAuraShape: "arc",
      gameRunning,
      isRecorderBusy,
      profileId: selectedProfile?.id ?? null,
      startAddingAura: true,
    });
  const handleAddPointerAura = () =>
    openRecorderAuraOverlay({
      addAuraShape: "points",
      gameRunning,
      isRecorderBusy,
      profileId: selectedProfile?.id ?? null,
      startAddingAura: true,
    });
  const handleCloseOverlay = () => closeRecorderOverlay();

  return (
    <main
      className={`${styles.overlay} box-border flex h-screen w-screen flex-col gap-1.5 overflow-hidden p-2`}
    >
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
        <RecorderOverlayTimer />
        <RecorderOverlayWindowActions
          onClose={handleCloseOverlay}
          onMinimize={onMinimize}
        />
      </div>
      <span
        className={`${styles.horizontalDivider} block h-px w-full`}
        aria-hidden="true"
      />
      <div className="flex min-w-0 items-center gap-[0.3125rem] overflow-hidden">
        <CaptureModeTabs />
        <span
          className={`${styles.divider} mx-0.5 h-[26px] w-px`}
          aria-hidden="true"
        />
        <div className="flex min-w-0 items-center gap-[0.3125rem]">
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
        </div>
      </div>
      <section
        className="flex min-w-0 flex-1 flex-col items-stretch gap-[0.3125rem]"
        aria-label="Aura controls"
      >
        <select
          id="recorder-aura-profile"
          className={`${styles.profileSelect} my-2 select select-bordered select-primary select-xs h-7 min-h-7 w-full min-w-0 pl-2 pr-6 text-[0.6875rem] font-medium`}
          value={selectedProfile?.id ?? ""}
          onChange={handleProfileChange}
          disabled={activeGameProfiles.length === 0}
          title="Aura profile"
          aria-label="Aura profile"
        >
          {activeGameProfiles.length === 0 ? (
            <option value="">No profiles</option>
          ) : (
            activeGameProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))
          )}
        </select>
        <span
          className={`${styles.auraActionHeader} block min-h-[0.6875rem] whitespace-nowrap text-center text-[0.6875rem] font-bold leading-none`}
        >
          Aura controls
        </span>
        <div className={styles.auraActionList}>
          <RecorderAuraActionButton
            ariaLabel="Edit auras"
            disabled={!canUnlockAuras}
            icon={HiViewGrid}
            label="Edit"
            title={
              !gameRunning
                ? "Start the selected game before editing auras"
                : "Edit auras"
            }
            variant="edit"
            onClick={handleEditAura}
          />
          <RecorderAuraActionButton
            ariaLabel="Add default aura"
            disabled={!canUnlockAuras}
            icon={PiSelection}
            label="Default"
            title={
              !gameRunning
                ? "Start the selected game before adding auras"
                : "Add default aura"
            }
            onClick={handleAddAura}
          />
          <RecorderAuraActionButton
            ariaLabel="Add arc aura"
            disabled={!canUnlockAuras}
            icon={PiBezierCurve}
            iconClassName="rotate-90"
            label="Arc"
            title={
              !gameRunning
                ? "Start the selected game before adding arched auras"
                : "Add arc aura"
            }
            onClick={handleAddArchedAura}
          />
          <RecorderAuraActionButton
            ariaLabel="Add pointer aura"
            disabled={!canUnlockAuras}
            icon={TbRouteSquare2}
            label="Pointer"
            title={
              !gameRunning
                ? "Start the selected game before adding pointer auras"
                : "Add pointer aura"
            }
            onClick={handleAddPointerAura}
          />
        </div>
      </section>
    </main>
  );
}

export { ExpandedRecorderControlsOverlay };
