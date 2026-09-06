import { type ChangeEvent, type MouseEvent, useMemo, useState } from "react";

import { getSelectedProfile } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import {
  useAuraOverlayShallow,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

import { readAuraRouteParams } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { AuraOverlayBulkResizeCategoryControls } from "../AuraOverlayBulkResizeCategoryControls/AuraOverlayBulkResizeCategoryControls";
import {
  type AuraScaleCategory,
  auraScaleCategories,
  createAuraProfileUpdateMatchingAnchorSize,
  createAuraScaleAnchorOptions,
  createAuraScaleCategoryCounts,
  isAuraScaleCategory,
} from "./AuraOverlayBulkResize.utils";

interface AuraBulkResizeSelection {
  anchorId: string;
  categories: AuraScaleCategory[] | null;
  profileId: string | null;
}

function AuraOverlayBulkResize() {
  const { recordAuraHistory, selectPlacement } = useAuraOverlayShallow(
    (auraOverlay) => ({
      recordAuraHistory: auraOverlay.recordAuraHistory,
      selectPlacement: auraOverlay.selectPlacement,
    }),
  );
  const { profileItems, selectedProfileId, updateProfileFromCurrent } =
    useProfilesShallow((profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      updateProfileFromCurrent: profiles.updateFromCurrent,
    }));
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );
  const routeProfileId = readAuraRouteParams().get("profileId");
  const profile =
    (routeProfileId
      ? profileItems.find((item) => item.id === routeProfileId)
      : null) ??
    getSelectedProfile(profileItems, selectedProfileId, activeGame);
  const profileId = profile?.id ?? null;
  const [requestedSelection, setRequestedSelection] =
    useState<AuraBulkResizeSelection>({
      anchorId: "",
      categories: null,
      profileId,
    });
  const anchorOptions = useMemo(
    () => createAuraScaleAnchorOptions(profile),
    [profile],
  );
  const requestedAnchorIsAvailable = anchorOptions.some(
    (option) => option.value === requestedSelection.anchorId,
  );
  const selectionMatchesProfile = requestedSelection.profileId === profileId;
  const anchorId =
    selectionMatchesProfile && requestedAnchorIsAvailable
      ? requestedSelection.anchorId
      : (anchorOptions[0]?.value ?? "");
  const anchorOption = anchorOptions.find(
    (option) => option.value === anchorId,
  );
  const requestedCategories =
    selectionMatchesProfile && requestedAnchorIsAvailable
      ? requestedSelection.categories
      : null;
  const selectedCategories =
    requestedCategories ?? (anchorOption ? [anchorOption.category] : []);
  const categoryCounts = useMemo(
    () => createAuraScaleCategoryCounts(profile),
    [profile],
  );
  const selectedPlacementCount = selectedCategories.reduce(
    (count, category) => count + categoryCounts[category],
    0,
  );
  const allCategoriesSelected = auraScaleCategories.every((category) =>
    selectedCategories.includes(category),
  );
  const anchorIncluded = Boolean(
    anchorOption && selectedCategories.includes(anchorOption.category),
  );
  const resizeTargetCount = selectedPlacementCount - (anchorIncluded ? 1 : 0);
  const canResize = Boolean(profile && anchorId && resizeTargetCount > 0);

  const handleAnchorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextAnchorId = event.currentTarget.value;
    setRequestedSelection({
      anchorId: nextAnchorId,
      categories: null,
      profileId,
    });
    if (profile) {
      selectPlacement(nextAnchorId);
    }
  };

  const handleAnchorFocus = () => {
    if (profile && anchorId) {
      selectPlacement(anchorId);
    }
  };

  const handleCategoryToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const category = event.currentTarget.dataset.category;
    if (!anchorOption || !category) {
      return;
    }

    if (category === "all") {
      setRequestedSelection({
        anchorId,
        categories: allCategoriesSelected
          ? [anchorOption.category]
          : [...auraScaleCategories],
        profileId,
      });
      return;
    }
    if (!isAuraScaleCategory(category)) {
      return;
    }

    const categorySelected = selectedCategories.includes(category);
    if (categorySelected && selectedCategories.length === 1) {
      return;
    }

    setRequestedSelection({
      anchorId,
      categories: auraScaleCategories.filter((candidate) =>
        candidate === category
          ? !categorySelected
          : selectedCategories.includes(candidate),
      ),
      profileId,
    });
  };

  const handleResize = () => {
    if (!profile || !anchorId) {
      return;
    }

    void updateProfileFromCurrent(profile.id, (currentProfile) => {
      const update = createAuraProfileUpdateMatchingAnchorSize(
        currentProfile,
        anchorId,
        selectedCategories,
        {
          height: Math.max(1, window.innerHeight),
          width: Math.max(1, window.innerWidth),
        },
      );
      if (update) {
        recordAuraHistory(currentProfile);
      }

      return update;
    }).catch(() => undefined);
  };

  return (
    <section className="grid gap-2 py-2 last:pb-0">
      <div className="grid gap-1">
        <h3 className="m-0 font-black text-base-content text-xs">
          Match icon size
        </h3>
        <p className="m-0 font-bold text-primary/75">
          Match width and height to one aura or element. Arched auras also match
          an arched anchor's thickness.
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <label className="grid min-w-0 gap-1 font-black text-base-content">
          Size anchor
          <select
            aria-label="Aura size anchor"
            className="select select-bordered select-xs min-w-0 w-full bg-base-100 text-base-content"
            disabled={anchorOptions.length === 0}
            value={anchorId}
            onChange={handleAnchorChange}
            onFocus={handleAnchorFocus}
          >
            {anchorOptions.length === 0 && (
              <option className="bg-base-100 text-base-content" value="">
                No auras available
              </option>
            )}
            {anchorOptions.map((option) => (
              <option
                className="bg-base-100 text-base-content"
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-label="Resize all auras to match the size anchor"
          className="btn btn-primary btn-xs"
          disabled={!canResize}
          type="button"
          onClick={handleResize}
        >
          Resize
        </button>
      </div>
      <AuraOverlayBulkResizeCategoryControls
        allCategoriesSelected={allCategoriesSelected}
        categoryCounts={categoryCounts}
        selectedCategories={selectedCategories}
        onCategoryToggle={handleCategoryToggle}
      />
    </section>
  );
}

export { AuraOverlayBulkResize };
