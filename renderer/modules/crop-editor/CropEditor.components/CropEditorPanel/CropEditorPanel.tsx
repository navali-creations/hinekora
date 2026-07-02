import { useEffect } from "react";

import { CropLayoutPreview } from "~/renderer/modules/crop-editor/CropEditor.components/CropLayoutPreview/CropLayoutPreview";
import { getSelectedProfile } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { isPoeProcessStateForGame } from "~/renderer/modules/game/GameStatusBadge/GameStatusBadge.utils";
import {
  useCapturePreviewSelector,
  usePoeProcessSelector,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

function CropEditorPanel() {
  const { profileItems, selectedProfileId } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
    }),
  );
  const selectedSourceId = useCapturePreviewSelector(
    (capturePreview) => capturePreview.selectedSourceId,
  );
  const poeProcessState = usePoeProcessSelector(
    (poeProcess) => poeProcess.state,
  );
  const settingsValue = useSettingsSelector((settings) => settings.value);
  const activeGame = settingsValue?.activeGame ?? "poe1";
  const profile = getSelectedProfile(
    profileItems,
    selectedProfileId,
    activeGame,
  );
  const hasAuraSource = Boolean(profile?.captureTarget || selectedSourceId);
  const isGameRunning = isPoeProcessStateForGame(poeProcessState, activeGame);
  const shouldShowAuraOverlay =
    settingsValue !== null &&
    profile !== null &&
    profile.overlayPlacements.length > 0 &&
    hasAuraSource &&
    isGameRunning;
  useEffect(() => {
    if (!shouldShowAuraOverlay) {
      return;
    }

    void window.electron.overlayWindows.showAura(profile?.id);
  }, [profile?.id, shouldShowAuraOverlay]);

  return (
    <section className="col-span-9 grid gap-3 rounded-lg border border-base-content/10 bg-neutral p-3 shadow-lg">
      {profile && <CropLayoutPreview />}
    </section>
  );
}

export { CropEditorPanel };
