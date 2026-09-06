import type { MouseEvent } from "react";

import { useAuraOverlayShallow } from "~/renderer/store";

import type { Profile } from "~/types";
import type {
  AuraSize,
  AuraVideoSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { useAuraOverlayArcThicknessResize } from "../useAuraOverlayArcThicknessResize/useAuraOverlayArcThicknessResize";
import { useAuraOverlayPlacementDrag } from "../useAuraOverlayPlacementDrag/useAuraOverlayPlacementDrag";
import { useAuraOverlayPlacementInteractionState } from "../useAuraOverlayPlacementInteractionState/useAuraOverlayPlacementInteractionState";
import { useAuraOverlayPlacementProperties } from "../useAuraOverlayPlacementProperties/useAuraOverlayPlacementProperties";
import { useAuraOverlayPlacementResize } from "../useAuraOverlayPlacementResize/useAuraOverlayPlacementResize";

interface UseAuraOverlayPlacementEditorInput {
  gridCellSize: AuraSize;
  guideViewport: AuraVideoSize;
  profile: Profile | null;
  referenceViewport: AuraVideoSize | null;
  snapEnabled: boolean;
  targetViewport: AuraVideoSize;
}

function useAuraOverlayPlacementEditor({
  gridCellSize,
  guideViewport,
  profile,
  referenceViewport,
  snapEnabled,
  targetViewport,
}: UseAuraOverlayPlacementEditorInput) {
  const selectPlacement = useAuraOverlayShallow(
    (auraOverlay) => auraOverlay.selectPlacement,
  );
  const interaction = useAuraOverlayPlacementInteractionState();
  const { arcThicknessResizeState, dragState, resizeState } = interaction;
  const {
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useAuraOverlayPlacementDrag({
    gridCellSize,
    guideViewport,
    interaction,
    profile,
    referenceViewport,
    snapEnabled,
    targetViewport,
  });
  const {
    handleResizePointerCancel,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
  } = useAuraOverlayPlacementResize({
    interaction,
    profile,
    referenceViewport,
    snapEnabled,
    targetViewport,
  });
  const {
    handleThicknessPointerCancel,
    handleThicknessPointerDown,
    handleThicknessPointerMove,
    handleThicknessPointerUp,
  } = useAuraOverlayArcThicknessResize({
    interaction,
    profile,
    referenceViewport,
    targetViewport,
  });
  const { handlePlacementPropertiesChange } = useAuraOverlayPlacementProperties(
    {
      profile,
      referenceViewport,
      targetViewport,
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
