import { useEffect } from "react";

import { Tabs } from "~/renderer/components/Tabs/Tabs";
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

  const handleAuraSelect = (cropRegionId: string) => {
    selectAura(cropRegionId);
  };

  if (!profile?.cropRegions.length) {
    return null;
  }

  return (
    <div className="col-span-12 flex min-w-0 items-center gap-2">
      <Tabs
        ariaLabel="Auras"
        className="no-drag min-h-8 w-full min-w-0"
        items={profile.cropRegions.map((region) => ({
          label: region.label,
          value: region.id,
        }))}
        size="sm"
        value={activeAuraCropRegionId ?? profile.cropRegions[0]!.id}
        onChange={handleAuraSelect}
      />
    </div>
  );
}

export { AuraTabs };
