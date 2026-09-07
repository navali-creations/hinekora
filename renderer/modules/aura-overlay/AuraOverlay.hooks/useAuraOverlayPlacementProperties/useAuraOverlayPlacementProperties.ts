import { useAuraOverlayShallow, useProfilesShallow } from "~/renderer/store";

import type { Profile } from "~/types";
import type { AuraPlacementPropertiesPatch } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import type { AuraVideoSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createPlacementPropertiesUpdate } from "./useAuraOverlayPlacementProperties.utils";

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
  const updateProfileFromCurrent = useProfilesShallow(
    (profiles) => profiles.updateFromCurrent,
  );
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

    void updateProfileFromCurrent(profile.id, (currentProfile) => {
      const placement = currentProfile.overlayPlacements.find(
        (item) => item.id === placementId,
      );
      const crop = currentProfile.cropRegions.find(
        (region) => region.id === placement?.cropRegionId,
      );
      if (!placement || !crop) {
        return null;
      }

      const update = createPlacementPropertiesUpdate(
        placement,
        crop,
        patch,
        targetViewport,
        referenceViewport,
      );

      if (patch.recordHistory !== false) {
        recordAuraHistory(currentProfile);
      }
      return {
        cropRegions: currentProfile.cropRegions.map((region) =>
          region.id === update.crop.id ? update.crop : region,
        ),
        overlayPlacements: currentProfile.overlayPlacements.map((item) =>
          item.id === placement.id ? update.placement : item,
        ),
      };
    }).catch(() => undefined);
  };

  return {
    handlePlacementPropertiesChange,
  };
}

export { useAuraOverlayPlacementProperties };
