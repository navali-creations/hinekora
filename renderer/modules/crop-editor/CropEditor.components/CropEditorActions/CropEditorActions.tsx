import clsx from "clsx";
import type { ChangeEvent } from "react";
import { FiPlus as Plus } from "react-icons/fi";

import {
  createPlacementForCrop,
  getSelectedProfile,
  resolveSelectionPlacementViewport,
} from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { isPoeProcessStateForGame } from "~/renderer/modules/game/GameStatusBadge/GameStatusBadge.utils";
import {
  useCropEditorShallow,
  usePoeProcessSelector,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

import type { CropRegion } from "~/types";

function CropEditorActions() {
  const { profileItems, selectedProfileId, selectProfile, updateProfile } =
    useProfilesShallow((profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      selectProfile: profiles.select,
      updateProfile: profiles.update,
    }));
  const poeProcessState = usePoeProcessSelector(
    (poeProcess) => poeProcess.state,
  );
  const { auraOverlayLocked, selectAura, setAuraOverlayLocked } =
    useCropEditorShallow((cropEditor) => ({
      auraOverlayLocked: cropEditor.auraOverlayLocked,
      selectAura: cropEditor.selectAura,
      setAuraOverlayLocked: cropEditor.setAuraOverlayLocked,
    }));
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );
  const profile = getSelectedProfile(profileItems, selectedProfileId);
  const canAddNewAura =
    profile !== null && isPoeProcessStateForGame(poeProcessState, activeGame);
  const addAuraTooltip = !profile
    ? "Create a profile first."
    : !canAddNewAura
      ? "Start the selected Path of Exile game before adding a new aura. Hinekora needs the game process to capture the source area."
      : "Capture a source area and create its aura overlay.";

  const handleProfileChange = (event: ChangeEvent<HTMLSelectElement>) => {
    selectProfile(event.currentTarget.value);
  };

  const handleAddAura = async () => {
    if (!profile || !canAddNewAura) {
      return;
    }

    await window.electron.mainWindow.minimize().catch(() => undefined);
    const selection = await window.electron.overlayWindows.selectCropRegion();
    if (!selection) {
      return;
    }

    const crop: CropRegion = {
      id: crypto.randomUUID(),
      label: `Aura ${profile.cropRegions.length + 1}`,
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };
    const placement = createPlacementForCrop(
      crop,
      profile.overlayPlacements.length,
      resolveSelectionPlacementViewport(selection),
    );

    await updateProfile({
      id: profile.id,
      cropRegions: [...profile.cropRegions, crop],
      overlayPlacements: [...profile.overlayPlacements, placement],
    });
    selectAura(crop.id);
    await window.electron.overlayWindows.showAura(profile.id);
  };

  const setAuraLocked = async (locked: boolean) => {
    setAuraOverlayLocked(locked);
    await window.electron.overlayWindows.setAuraLocked(locked);
    if (!locked && profile) {
      await window.electron.overlayWindows.showAura(profile.id);
    }
  };

  const handleLockClick = () => {
    void setAuraLocked(true);
  };

  const handleUnlockClick = () => {
    void setAuraLocked(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Aura profile"
        className="select select-bordered select-sm no-drag w-[min(180px,38vw)]"
        disabled={profileItems.length === 0}
        value={profile?.id ?? ""}
        onChange={handleProfileChange}
      >
        {profileItems.length === 0 ? (
          <option value="">No profiles</option>
        ) : (
          profileItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))
        )}
      </select>
      <div
        className="tooltip tooltip-bottom no-drag"
        data-tip="Lock keeps auras click-through for gameplay. Unlock lets you drag and resize aura positions."
      >
        <div
          className="tabs tabs-box tabs-xs [--tab-height:calc(var(--size-field,0.25rem)*7)]"
          role="tablist"
        >
          <button
            aria-selected={auraOverlayLocked}
            className={clsx("tab", auraOverlayLocked && "tab-active")}
            role="tab"
            type="button"
            onClick={handleLockClick}
          >
            Lock
          </button>
          <button
            aria-selected={!auraOverlayLocked}
            className={clsx("tab", !auraOverlayLocked && "tab-active")}
            role="tab"
            type="button"
            onClick={handleUnlockClick}
          >
            Unlock
          </button>
        </div>
      </div>
      <div
        className={clsx(
          "tooltip tooltip-left no-drag",
          canAddNewAura && "before:hidden after:hidden",
        )}
        data-tip={canAddNewAura ? "" : addAuraTooltip}
      >
        <button
          className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canAddNewAura}
          type="button"
          onClick={handleAddAura}
        >
          <Plus size={16} />
          Add new aura
        </button>
      </div>
    </div>
  );
}

export { CropEditorActions };
