import clsx from "clsx";
import type { MouseEvent } from "react";
import { useEffect } from "react";

import {
  getSelectedProfile,
  resolveActiveAuraCropRegionId,
} from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import {
  useCropEditorShallow,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

function AuraTabs() {
  const { profileItems, selectedProfileId } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
    }),
  );
  const { selectAura, selectedAuraCropRegionId } = useCropEditorShallow(
    (cropEditor) => ({
      selectAura: cropEditor.selectAura,
      selectedAuraCropRegionId: cropEditor.selectedAuraCropRegionId,
    }),
  );
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );
  const profile = getSelectedProfile(
    profileItems,
    selectedProfileId,
    activeGame,
  );
  const activeAuraCropRegionId = resolveActiveAuraCropRegionId(
    profile,
    selectedAuraCropRegionId,
  );

  useEffect(() => {
    const onlyAuraId = profile?.cropRegions[0]?.id ?? null;
    if (
      profile?.cropRegions.length === 1 &&
      selectedAuraCropRegionId !== onlyAuraId
    ) {
      selectAura(onlyAuraId);
    }
  }, [profile?.cropRegions, selectAura, selectedAuraCropRegionId]);

  const handleAuraSelect = (event: MouseEvent<HTMLButtonElement>) => {
    const cropRegionId = event.currentTarget.dataset.cropRegionId;
    if (cropRegionId) {
      selectAura(cropRegionId);
    }
  };

  if (!profile?.cropRegions.length) {
    return null;
  }

  return (
    <div className="col-span-12 flex min-w-0 items-center gap-2">
      <div
        aria-label="Auras"
        className="tabs tabs-box tabs-sm no-drag flex min-h-8 w-full min-w-0 items-center overflow-visible bg-base-200"
        role="tablist"
      >
        <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          {profile.cropRegions.map((region) => (
            <button
              aria-selected={region.id === activeAuraCropRegionId}
              className={clsx(
                "tab shrink-0 text-base-content/75 hover:text-primary",
                region.id === activeAuraCropRegionId &&
                  "tab-active rounded-md !bg-primary !text-primary-content shadow-sm",
              )}
              data-crop-region-id={region.id}
              key={region.id}
              role="tab"
              type="button"
              onClick={handleAuraSelect}
            >
              {region.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { AuraTabs };
