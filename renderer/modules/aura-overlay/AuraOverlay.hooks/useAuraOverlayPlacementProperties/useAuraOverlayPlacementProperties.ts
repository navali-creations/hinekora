import { useAuraOverlayShallow, useProfilesShallow } from "~/renderer/store";

import type { Profile } from "~/types";
import type { AuraPlacementPropertiesPatch } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import type { AuraVideoSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createPlacementPropertiesUpdate } from "../useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor.utils";

interface UseAuraOverlayPlacementPropertiesInput {
  profile: Profile | null;
  referenceViewport: AuraVideoSize | null;
  targetViewport: AuraVideoSize;
}

function useAuraOverlayPlacementProperties({
  profile,
  referenceViewport,
  targetViewport,
}: UseAuraOverlayPlacementPropertiesInput) {
  const updateProfile = useProfilesShallow((profiles) => profiles.update);
  const recordAuraHistory = useAuraOverlayShallow(
    (auraOverlay) => auraOverlay.recordAuraHistory,
  );
  const handlePlacementPropertiesChange = (
    placementId: string,
    patch: AuraPlacementPropertiesPatch,
  ) => {
    if (!profile) {
      return;
    }

    const placement = profile.overlayPlacements.find(
      (item) => item.id === placementId,
    );
    const crop = profile.cropRegions.find(
      (region) => region.id === placement?.cropRegionId,
    );
    if (!placement || !crop) {
      return;
    }

    const update = createPlacementPropertiesUpdate(
      placement,
      crop,
      patch,
      targetViewport,
      referenceViewport,
    );

    if (patch.recordHistory !== false) {
      recordAuraHistory(profile);
    }
    void updateProfile({
      id: profile.id,
      cropRegions: profile.cropRegions.map((region) =>
        region.id === update.crop.id ? update.crop : region,
      ),
      overlayPlacements: profile.overlayPlacements.map((item) =>
        item.id === placement.id ? update.placement : item,
      ),
    }).catch(() => undefined);
  };

  return {
    handlePlacementPropertiesChange,
  };
}

export { useAuraOverlayPlacementProperties };
