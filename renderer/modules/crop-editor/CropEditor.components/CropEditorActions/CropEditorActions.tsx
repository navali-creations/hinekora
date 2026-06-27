import clsx from "clsx";
import type { ChangeEvent } from "react";
import { FiPlus as Plus } from "react-icons/fi";
import { TbMoon as Moon } from "react-icons/tb";

import type { CropRegionSelectionShape } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import {
  createAuraProfileUpdateFromSelection,
  getSelectedProfile,
} from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { isPoeProcessStateForGame } from "~/renderer/modules/game/GameStatusBadge/GameStatusBadge.utils";
import { trackEvent } from "~/renderer/modules/umami";
import {
  useCropEditorShallow,
  usePoeProcessSelector,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

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

  const handleAddAura = async (shape: CropRegionSelectionShape) => {
    if (!profile || !canAddNewAura) {
      return;
    }

    if (auraOverlayLocked) {
      await setAuraLocked(false, { showAuraWhenUnlocked: false });
    }

    trackEvent("aura-capture-started", {
      game: activeGame,
      shape,
    });
    await window.electron.mainWindow.minimize().catch(() => undefined);
    const selection = await window.electron.overlayWindows.selectCropRegion({
      shape,
    });
    if (!selection) {
      trackEvent("aura-capture-cancelled");
      return;
    }

    const { crop, profileUpdate } = createAuraProfileUpdateFromSelection(
      profile,
      selection,
    );

    await updateProfile(profileUpdate);
    selectAura(crop.id);
    await window.electron.overlayWindows.showAura(profile.id);
    trackEvent("aura-created", {
      overlayCount: profile.overlayPlacements.length + 1,
      shape,
    });
  };

  const setAuraLocked = async (
    locked: boolean,
    options: { showAuraWhenUnlocked?: boolean } = {},
  ) => {
    setAuraOverlayLocked(locked);
    await window.electron.overlayWindows.setAuraLocked(locked);
    if (!locked && profile && options.showAuraWhenUnlocked !== false) {
      await window.electron.overlayWindows.showAura(profile.id);
    }
    trackEvent("aura-overlay-lock-changed", {
      locked,
    });
  };

  const handleLockClick = () => {
    void setAuraLocked(true);
  };

  const handleUnlockClick = () => {
    void setAuraLocked(false);
  };

  const handleAddRectAuraClick = () => {
    void handleAddAura("rect");
  };

  const handleAddArchedAuraClick = () => {
    void handleAddAura("arc");
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Aura profile"
        className="select select-bordered select-sm no-drag w-[min(180px,38vw)]"
        data-onboarding="aura-profile-select"
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
        data-onboarding="aura-lock-toggle"
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
        data-onboarding="aura-new-aura"
      >
        <button
          className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canAddNewAura}
          type="button"
          onClick={handleAddRectAuraClick}
        >
          <Plus size={16} />
          Add new aura
        </button>
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
          onClick={handleAddArchedAuraClick}
        >
          <Moon size={16} />
          Add arched aura
        </button>
      </div>
    </div>
  );
}

export { CropEditorActions };
