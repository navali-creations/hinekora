import clsx from "clsx";
import type { ChangeEvent } from "react";
import { PiBezierCurve, PiSelection } from "react-icons/pi";
import { TbRouteSquare2 } from "react-icons/tb";

import type { CropRegionSelectionShape } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import { type TabItem, Tabs } from "~/renderer/components/Tabs/Tabs";
import {
  createAuraProfileUpdateFromSelection,
  getSelectedProfile,
} from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { isPoeProcessStateForGame } from "~/renderer/modules/game/GameStatusBadge/GameStatusBadge.utils";
import { getProfilesForGame } from "~/renderer/modules/profiles/Profiles.utils/Profiles.utils";
import {
  useCropEditorShallow,
  usePoeProcessSelector,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

type AuraLockMode = "locked" | "unlocked";

const auraLockTabs: TabItem<AuraLockMode>[] = [
  { label: "Lock", value: "locked" },
  { label: "Unlock", value: "unlocked" },
];

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
  const activeGameProfiles = getProfilesForGame(profileItems, activeGame);
  const profile = getSelectedProfile(
    profileItems,
    selectedProfileId,
    activeGame,
  );
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

    await window.electron.mainWindow.minimize().catch(() => undefined);
    const selection = await window.electron.overlayWindows.selectCropRegion({
      shape,
    });
    if (!selection) {
      return;
    }

    const { crop, profileUpdate } = createAuraProfileUpdateFromSelection(
      profile,
      selection,
    );

    await updateProfile(profileUpdate);
    selectAura(crop.id);
    await window.electron.overlayWindows.showAura(profile.id);
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
  };

  const handleAuraLockModeChange = (mode: AuraLockMode) => {
    void setAuraLocked(mode === "locked");
  };

  const handleAddRectAuraClick = () => {
    void handleAddAura("rect");
  };

  const handleAddArchedAuraClick = () => {
    void handleAddAura("arc");
  };

  const handleAddPointerAuraClick = () => {
    void handleAddAura("points");
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Aura profile"
        className="select select-bordered select-sm no-drag w-[min(180px,38vw)]"
        data-onboarding="aura-profile-select"
        disabled={activeGameProfiles.length === 0}
        value={profile?.id ?? ""}
        onChange={handleProfileChange}
      >
        {activeGameProfiles.length === 0 ? (
          <option value="">No profiles</option>
        ) : (
          activeGameProfiles.map((item) => (
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
        <Tabs
          ariaLabel="Aura overlay lock"
          className="[--tab-height:calc(var(--size-field,0.25rem)*7)]"
          items={auraLockTabs}
          selectionRole="radio"
          value={auraOverlayLocked ? "locked" : "unlocked"}
          onChange={handleAuraLockModeChange}
        />
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
          <PiSelection size={16} />
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
          <PiBezierCurve className="rotate-90" size={16} />
          Add arched aura
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
          onClick={handleAddPointerAuraClick}
        >
          <TbRouteSquare2 size={16} />
          Add pointer aura
        </button>
      </div>
    </div>
  );
}

export { CropEditorActions };
