import type { MouseEvent } from "react";

import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { Profile } from "~/types";
import type { AuraVideoSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { useAuraOverlayArcThicknessResize } from "../useAuraOverlayArcThicknessResize/useAuraOverlayArcThicknessResize";
import { useAuraOverlayPlacementDrag } from "../useAuraOverlayPlacementDrag/useAuraOverlayPlacementDrag";
import { useAuraOverlayPlacementInteractionState } from "../useAuraOverlayPlacementInteractionState/useAuraOverlayPlacementInteractionState";
import { useAuraOverlayPlacementProperties } from "../useAuraOverlayPlacementProperties/useAuraOverlayPlacementProperties";
import { useAuraOverlayPlacementResize } from "../useAuraOverlayPlacementResize/useAuraOverlayPlacementResize";

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface UseAuraOverlayPlacementEditorInput {
  profile: Profile | null;
  referenceViewport: AuraVideoSize | null;
  recordAuraHistory: () => boolean;
  selectPlacement: (placementId: string) => void;
  targetViewport: AuraVideoSize;
  updateProfile: UpdateProfile;
}

function useAuraOverlayPlacementEditor({
  profile,
  referenceViewport,
  recordAuraHistory,
  selectPlacement,
  targetViewport,
  updateProfile,
}: UseAuraOverlayPlacementEditorInput) {
  const interaction = useAuraOverlayPlacementInteractionState();
  const { arcThicknessResizeState, dragState, resizeState } = interaction;
  const {
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useAuraOverlayPlacementDrag({
    interaction,
    profile,
    recordAuraHistory,
    referenceViewport,
    selectPlacement,
    targetViewport,
    updateProfile,
  });
  const {
    handleResizePointerCancel,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
  } = useAuraOverlayPlacementResize({
    interaction,
    profile,
    recordAuraHistory,
    referenceViewport,
    selectPlacement,
    targetViewport,
    updateProfile,
  });
  const {
    handleThicknessPointerCancel,
    handleThicknessPointerDown,
    handleThicknessPointerMove,
    handleThicknessPointerUp,
  } = useAuraOverlayArcThicknessResize({
    interaction,
    profile,
    recordAuraHistory,
    referenceViewport,
    selectPlacement,
    targetViewport,
    updateProfile,
  });
  const { handlePlacementPropertiesChange } = useAuraOverlayPlacementProperties(
    {
      profile,
      recordAuraHistory,
      referenceViewport,
      targetViewport,
      updateProfile,
    },
  );

  const handleAuraClick = (event: MouseEvent<HTMLElement>) => {
    const placementId = event.currentTarget.dataset.placementId;
    if (placementId) {
      selectPlacement(placementId);
    }
  };

  return {
    arcThicknessResizeState,
    dragState,
    handleAuraClick,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePlacementPropertiesChange,
    handleResizePointerCancel,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
    handleThicknessPointerCancel,
    handleThicknessPointerDown,
    handleThicknessPointerMove,
    handleThicknessPointerUp,
    resizeState,
  };
}

export { useAuraOverlayPlacementEditor };
