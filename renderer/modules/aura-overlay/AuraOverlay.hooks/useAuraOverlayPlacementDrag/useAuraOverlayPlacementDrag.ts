import type { PointerEvent } from "react";

import {
  useAuraOverlayShallow,
  useBoundStore,
  useProfilesShallow,
} from "~/renderer/store";

import type { Profile } from "~/types";
import {
  type AuraSize,
  type AuraVideoSize,
  resolveAuraPlacementGeometry,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import type { UseAuraOverlayPlacementInteractionStateResult } from "../useAuraOverlayPlacementInteractionState/useAuraOverlayPlacementInteractionState";
import { createAuraOverlayPlacementMove } from "./createAuraOverlayPlacementMove";
import {
  createAuraOverlayDragInitialPositions,
  createAuraOverlaySnapContext,
  resolveAuraOverlayDragSnap,
} from "./useAuraOverlayPlacementDrag.utils";

interface UseAuraOverlayPlacementDragInput {
  gridCellSize: AuraSize;
  guideViewport: AuraVideoSize;
  interaction: UseAuraOverlayPlacementInteractionStateResult;
  profile: Profile | null;
  referenceViewport: AuraVideoSize | null;
  snapEnabled: boolean;
  targetViewport: AuraVideoSize;
}

function useAuraOverlayPlacementDrag({
  gridCellSize,
  guideViewport,
  interaction,
  profile,
  referenceViewport,
  snapEnabled,
  targetViewport,
}: UseAuraOverlayPlacementDragInput) {
  const updateProfile = useProfilesShallow((profiles) => profiles.update);
  const {
    clearAreaSelection,
    moveAreaSelection,
    recordAuraHistory,
    selectPlacement,
  } = useAuraOverlayShallow((auraOverlay) => ({
    clearAreaSelection: auraOverlay.clearAreaSelection,
    moveAreaSelection: auraOverlay.moveAreaSelection,
    recordAuraHistory: auraOverlay.recordAuraHistory,
    selectPlacement: auraOverlay.selectPlacement,
  }));
  const {
    arcThicknessResizeStateRef,
    commitDragState,
    dragStateRef,
    publishInteractionSnapshot,
    resizeStateRef,
  } = interaction;

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      !profile ||
      dragStateRef.current ||
      resizeStateRef.current ||
      arcThicknessResizeStateRef.current ||
      event.button !== 0
    ) {
      return;
    }

    const placementId = event.currentTarget.dataset.placementId;
    const placement = profile.overlayPlacements.find(
      (item) => item.id === placementId,
    );
    const crop = profile.cropRegions.find(
      (item) => item.id === placement?.cropRegionId,
    );

    if (!placement || !crop) {
      return;
    }
    const areaSelectedPlacementIds =
      useBoundStore.getState().auraOverlay.areaSelection?.placementIds ?? [];
    const areaSelectionDrag = areaSelectedPlacementIds.includes(placement.id);
    const placementIds = areaSelectionDrag
      ? areaSelectedPlacementIds
      : [placement.id];
    const { visualBounds } = resolveAuraPlacementGeometry(
      crop,
      placement,
      targetViewport,
      referenceViewport,
    );
    const initialDisplayPositions = createAuraOverlayDragInitialPositions({
      fallbackReferenceViewport: referenceViewport,
      placementIds,
      profile,
      targetViewport,
    });

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!areaSelectionDrag) {
      clearAreaSelection();
      selectPlacement(placement.id);
    }
    commitDragState({
      areaSelectionDrag,
      initialDisplayPositions,
      placementId: placement.id,
      placementIds,
      startX: event.clientX,
      startY: event.clientY,
      initialDisplayX: visualBounds.x,
      initialDisplayY: visualBounds.y,
      deltaX: 0,
      deltaY: 0,
      isReleased: false,
      snapContext:
        snapEnabled && !areaSelectionDrag
          ? createAuraOverlaySnapContext({
              fallbackReferenceViewport: referenceViewport,
              gridCellSize,
              guideViewport,
              placementId: placement.id,
              profile,
              targetViewport,
            })
          : null,
      snapGuideX: null,
      snapGuideY: null,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const currentDragState = dragStateRef.current;
    if (!currentDragState || currentDragState.isReleased) {
      return;
    }

    const rawX =
      currentDragState.initialDisplayX +
      event.clientX -
      currentDragState.startX;
    const rawY =
      currentDragState.initialDisplayY +
      event.clientY -
      currentDragState.startY;
    const snappedPosition = currentDragState.snapContext
      ? resolveAuraOverlayDragSnap({
          rawX,
          rawY,
          snapContext: currentDragState.snapContext,
        })
      : { guideX: null, guideY: null, x: rawX, y: rawY };

    dragStateRef.current = {
      ...currentDragState,
      deltaX: snappedPosition.x - currentDragState.initialDisplayX,
      deltaY: snappedPosition.y - currentDragState.initialDisplayY,
      snapGuideX: snappedPosition.guideX,
      snapGuideY: snappedPosition.guideY,
    };
    publishInteractionSnapshot();
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const currentDragState = dragStateRef.current;
    if (!profile || !currentDragState || currentDragState.isReleased) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (
      Math.round(currentDragState.initialDisplayX + currentDragState.deltaX) ===
        Math.round(currentDragState.initialDisplayX) &&
      Math.round(currentDragState.initialDisplayY + currentDragState.deltaY) ===
        Math.round(currentDragState.initialDisplayY)
    ) {
      commitDragState(null);
      return;
    }
    const placementIds = currentDragState.placementIds ?? [
      currentDragState.placementId,
    ];
    const move = createAuraOverlayPlacementMove({
      deltaX: currentDragState.deltaX,
      deltaY: currentDragState.deltaY,
      placementIds,
      primaryPlacementId: currentDragState.placementId,
      profile,
      referenceViewport,
      targetViewport,
    });
    if (!move) {
      commitDragState(null);
      return;
    }

    recordAuraHistory(profile);
    const releasedDragState = {
      ...currentDragState,
      deltaX: move.deltaX,
      deltaY: move.deltaY,
      isReleased: true,
      snapContext: null,
      snapGuideX: null,
      snapGuideY: null,
    };
    commitDragState(releasedDragState);
    const clearReleasedDragState = () => {
      if (dragStateRef.current === releasedDragState) {
        commitDragState(null);
      }
    };
    void updateProfile({
      id: profile.id,
      ...move.update,
    }).then(() => {
      if (currentDragState.areaSelectionDrag) {
        moveAreaSelection(move.deltaX, move.deltaY);
      }
      clearReleasedDragState();
    }, clearReleasedDragState);
  };

  const handlePointerCancel = () => {
    if (dragStateRef.current?.isReleased) {
      return;
    }

    commitDragState(null);
  };

  return {
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

export { useAuraOverlayPlacementDrag };
