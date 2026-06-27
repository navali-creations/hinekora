import type { PointerEvent } from "react";

import type { ProfilesSlice } from "~/renderer/store/store.types";

import { createCoordinateReferenceDimensions, type Profile } from "~/types";
import {
  type AuraVideoSize,
  projectAuraOverlayPlacement,
  resolveAuraReferenceViewport,
  unprojectAuraPoint,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import type { UseAuraOverlayPlacementInteractionStateResult } from "../useAuraOverlayPlacementInteractionState/useAuraOverlayPlacementInteractionState";

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface UseAuraOverlayPlacementDragInput {
  interaction: UseAuraOverlayPlacementInteractionStateResult;
  profile: Profile | null;
  recordAuraHistory: () => boolean;
  referenceViewport: AuraVideoSize | null;
  selectPlacement: (placementId: string) => void;
  targetViewport: AuraVideoSize;
  updateProfile: UpdateProfile;
}

function useAuraOverlayPlacementDrag({
  interaction,
  profile,
  recordAuraHistory,
  referenceViewport,
  selectPlacement,
  targetViewport,
  updateProfile,
}: UseAuraOverlayPlacementDragInput) {
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
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const currentDragState = dragStateRef.current;
    if (!currentDragState || currentDragState.isReleased) {
      return;
    }

    dragStateRef.current = {
      ...currentDragState,
      deltaX: event.clientX - currentDragState.startX,
      deltaY: event.clientY - currentDragState.startY,
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

    recordAuraHistory();
    const releasedDragState = {
      ...currentDragState,
      deltaX: x - currentDragState.initialDisplayX,
      deltaY: y - currentDragState.initialDisplayY,
      isReleased: true,
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
    }).finally(() => {
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
