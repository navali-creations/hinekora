import type { ChangeEvent } from "react";
import { useCallback } from "react";

import {
  getProfilesForGame,
  resolveActiveGameProfile,
} from "~/renderer/modules/profiles/Profiles.utils/Profiles.utils";
import { useProfilesShallow, useSettingsSelector } from "~/renderer/store";

import { openRecorderAuraOverlay } from "../ExpandedRecorderControlsOverlay.utils";

function useExpandedRecorderAuraControls(input: {
  gameRunning: boolean;
  isRecorderBusy: boolean;
}) {
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
  const selectedProfileIdForAction = selectedProfile?.id ?? null;

  const handleProfileChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const profileId = event.currentTarget.value;
      if (!profileId) {
        return;
      }

      selectProfile(profileId);
      if (input.gameRunning) {
        void window.electron.overlayWindows.showAura(profileId);
      }
    },
    [input.gameRunning, selectProfile],
  );
  const openAuraOverlay = useCallback(
    (options: {
      addAuraShape?: "arc" | "points" | "rect";
      startAddingAura: boolean;
    }) =>
      openRecorderAuraOverlay({
        ...options,
        gameRunning: input.gameRunning,
        isRecorderBusy: input.isRecorderBusy,
        profileId: selectedProfileIdForAction,
      }),
    [input.gameRunning, input.isRecorderBusy, selectedProfileIdForAction],
  );
  const handleEditAura = useCallback(
    () => openAuraOverlay({ startAddingAura: false }),
    [openAuraOverlay],
  );
  const handleAddAura = useCallback(
    () => openAuraOverlay({ addAuraShape: "rect", startAddingAura: true }),
    [openAuraOverlay],
  );
  const handleAddArchedAura = useCallback(
    () => openAuraOverlay({ addAuraShape: "arc", startAddingAura: true }),
    [openAuraOverlay],
  );
  const handleAddPointerAura = useCallback(
    () => openAuraOverlay({ addAuraShape: "points", startAddingAura: true }),
    [openAuraOverlay],
  );

  return {
    activeGameProfiles,
    canUnlockAuras:
      input.gameRunning && !input.isRecorderBusy && Boolean(selectedProfile),
    handleAddArchedAura,
    handleAddAura,
    handleAddPointerAura,
    handleEditAura,
    handleProfileChange,
    selectedProfile,
  };
}

export { useExpandedRecorderAuraControls };
