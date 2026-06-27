import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { Profile } from "~/types";
import type { AuraPlacementPropertiesPatch } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import type { AuraVideoSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createPlacementPropertiesUpdate } from "../useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor.utils";

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface UseAuraOverlayPlacementPropertiesInput {
  profile: Profile | null;
  recordAuraHistory: () => boolean;
  referenceViewport: AuraVideoSize | null;
  targetViewport: AuraVideoSize;
  updateProfile: UpdateProfile;
}

function useAuraOverlayPlacementProperties({
  profile,
  recordAuraHistory,
  referenceViewport,
  targetViewport,
  updateProfile,
}: UseAuraOverlayPlacementPropertiesInput) {
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

    recordAuraHistory();
    void updateProfile({
      id: profile.id,
      cropRegions: profile.cropRegions.map((region) =>
        region.id === update.crop.id ? update.crop : region,
      ),
      overlayPlacements: profile.overlayPlacements.map((item) =>
        item.id === placement.id ? update.placement : item,
      ),
    });
  };

  return {
    handlePlacementPropertiesChange,
  };
}

export { useAuraOverlayPlacementProperties };
