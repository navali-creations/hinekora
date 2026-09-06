import type { PointerEvent } from "react";

import { useAuraOverlayShallow, useProfilesShallow } from "~/renderer/store";

import { createCoordinateReferenceDimensions, type Profile } from "~/types";
import {
  type AuraSize,
  type AuraVideoSize,
  projectAuraOverlayPlacement,
  resolveAuraReferenceViewport,
  unprojectAuraPoint,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import type { UseAuraOverlayPlacementInteractionStateResult } from "../useAuraOverlayPlacementInteractionState/useAuraOverlayPlacementInteractionState";
import {
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
  const { recordAuraHistory, selectPlacement } = useAuraOverlayShallow(
    (auraOverlay) => ({
      recordAuraHistory: auraOverlay.recordAuraHistory,
      selectPlacement: auraOverlay.selectPlacement,
    }),
  );
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

    if (!placement) {
      return;
    }
    const cropReferenceViewport = resolveAuraReferenceViewport(
      crop,
      referenceViewport,
    );
    const projectedPlacement = projectAuraOverlayPlacement(
      placement,
      targetViewport,
      cropReferenceViewport,
    );

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectPlacement(placement.id);
    commitDragState({
      placementId: placement.id,
      startX: event.clientX,
      startY: event.clientY,
      initialDisplayX: projectedPlacement.x,
      initialDisplayY: projectedPlacement.y,
      deltaX: 0,
      deltaY: 0,
      isReleased: false,
      snapContext: snapEnabled
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
    const x = Math.max(
      0,
      Math.round(currentDragState.initialDisplayX + currentDragState.deltaX),
    );
    const y = Math.max(
      0,
      Math.round(currentDragState.initialDisplayY + currentDragState.deltaY),
    );
    const placementId = currentDragState.placementId;
    const placement = profile.overlayPlacements.find(
      (item) => item.id === placementId,
    );
    const crop = profile.cropRegions.find(
      (item) => item.id === placement?.cropRegionId,
    );
    if (
      x === Math.round(currentDragState.initialDisplayX) &&
      y === Math.round(currentDragState.initialDisplayY)
    ) {
      commitDragState(null);
      return;
    }
    if (!placement) {
      commitDragState(null);
      return;
    }
    const placementReferenceViewport = resolveAuraReferenceViewport(
      placement,
      resolveAuraReferenceViewport(crop, referenceViewport),
    );
    const referencePoint = unprojectAuraPoint(
      { x, y },
      placementReferenceViewport,
      targetViewport,
    );
    const referenceDimensions = createCoordinateReferenceDimensions(
      placementReferenceViewport,
    );
    const nextX = Math.max(0, Math.round(referencePoint.x));
    const nextY = Math.max(0, Math.round(referencePoint.y));

    recordAuraHistory(profile);
    const releasedDragState = {
      ...currentDragState,
      deltaX: x - currentDragState.initialDisplayX,
      deltaY: y - currentDragState.initialDisplayY,
      isReleased: true,
      snapContext: null,
      snapGuideX: null,
      snapGuideY: null,
    };
    commitDragState(releasedDragState);
    void updateProfile({
      id: profile.id,
      cropRegions: profile.cropRegions.map((region) =>
        region.id === placement.cropRegionId
          ? { ...region, ...referenceDimensions }
          : region,
      ),
      overlayPlacements: profile.overlayPlacements.map((placement) =>
        placement.id === placementId
          ? {
              ...placement,
              ...referenceDimensions,
              x: nextX,
              y: nextY,
            }
          : placement,
      ),
    })
      .catch(() => undefined)
      .finally(() => {
        if (dragStateRef.current === releasedDragState) {
          commitDragState(null);
        }
      });
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
