import { useCallback, useMemo } from "react";

import {
  createCaptureTargetFromPreviewSource,
  sourceMatchesCaptureTarget,
} from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import {
  useCaptureProfilesShallow,
  useSettingsShallow,
} from "~/renderer/store";

import type { CapturePreviewSource } from "~/types";
import {
  isCapturePreviewSourceCompatibleWithProfile,
  isSameCaptureTarget,
  resolveCaptureTargetProfile,
} from "../../CapturePreview.utils/CapturePreview.utils";

function useCapturePreviewSourcePersistence(
  selectedSource: CapturePreviewSource | null,
) {
  const {
    isProfileUnlocked,
    profileItems,
    selectedProfileId,
    updateProfile,
    selectProfile,
  } = useCaptureProfilesShallow((profiles) => ({
    isProfileUnlocked: profiles.isProfileUnlocked,
    profileItems: profiles.items,
    selectedProfileId: profiles.selectedProfileId,
    selectProfile: profiles.select,
    updateProfile: profiles.update,
  }));
  const { activeGame, updateSettings } = useSettingsShallow((settings) => ({
    activeGame: settings.value?.activeGame ?? "poe1",
    updateSettings: settings.update,
  }));

  const selectedSourceProfile = useMemo(
    () =>
      selectedSource
        ? resolveCaptureTargetProfile(
            profileItems,
            selectedProfileId,
            activeGame,
            selectedSource,
          )
        : null,
    [activeGame, profileItems, selectedProfileId, selectedSource],
  );

  const persistCaptureTarget = useCallback(
    (source: CapturePreviewSource) => {
      const targetProfile = resolveCaptureTargetProfile(
        profileItems,
        selectedProfileId,
        activeGame,
        source,
      );
      if (
        !targetProfile ||
        !isCapturePreviewSourceCompatibleWithProfile(source, targetProfile)
      ) {
        return;
      }

      const captureTarget = createCaptureTargetFromPreviewSource(source);
      if (source.game && source.game !== activeGame) {
        void updateSettings({ activeGame: source.game });
      }
      if (targetProfile.id !== selectedProfileId) {
        selectProfile(targetProfile.id);
      }
      if (
        !isProfileUnlocked ||
        isSameCaptureTarget(targetProfile.captureTarget, captureTarget)
      ) {
        return;
      }

      void updateProfile({
        id: targetProfile.id,
        captureTarget,
      });
    },
    [
      activeGame,
      isProfileUnlocked,
      profileItems,
      selectedProfileId,
      selectProfile,
      updateProfile,
      updateSettings,
    ],
  );

  const selectedSourceMatchesProfileTarget =
    !selectedSource ||
    !selectedSourceProfile?.captureTarget ||
    sourceMatchesCaptureTarget(
      selectedSource,
      selectedSourceProfile.captureTarget,
    );

  return {
    persistCaptureTarget,
    selectedSourceMatchesProfileTarget,
    selectedSourceProfile,
  };
}

export { useCapturePreviewSourcePersistence };
