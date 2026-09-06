import type { PointerEvent } from "react";

import { useAuraOverlayShallow, useProfilesShallow } from "~/renderer/store";

import type { OverlayPlacement, Profile } from "~/types";
import {
  type AuraVideoSize,
  isAuraResizeCorner,
  resizeAuraPlacementFromCorner,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createReferenceDimensionsForPlacement } from "../useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor.utils";
import type { UseAuraOverlayPlacementInteractionStateResult } from "../useAuraOverlayPlacementInteractionState/useAuraOverlayPlacementInteractionState";
import {
  createAuraOverlayScaleSnapContext,
  resizeAuraPlacementWithPeerScaleSnap,
} from "./useAuraOverlayPlacementResize.utils";

interface UseAuraOverlayPlacementResizeInput {
  interaction: UseAuraOverlayPlacementInteractionStateResult;
  profile: Profile | null;
  referenceViewport: AuraVideoSize | null;
  snapEnabled: boolean;
  targetViewport: AuraVideoSize;
}

function useAuraOverlayPlacementResize({
  interaction,
  profile,
  referenceViewport,
  snapEnabled,
  targetViewport,
}: UseAuraOverlayPlacementResizeInput) {
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
    commitResizeState,
    dragStateRef,
    publishInteractionSnapshot,
    resizeStateRef,
  } = interaction;

  const handleResizePointerDown = (event: PointerEvent<HTMLElement>) => {
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
    const corner = event.currentTarget.dataset.corner;
    const placement = profile.overlayPlacements.find(
      (item) => item.id === placementId,
    );
    const crop = profile.cropRegions.find(
      (item) => item.id === placement?.cropRegionId,
    );
    if (!placement || !isAuraResizeCorner(corner)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectPlacement(placement.id);
    commitDragState(null);
    commitResizeState({
      placementId: placement.id,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      initialPlacement: placement,
      draftPlacement: placement,
      isReleased: false,
      scaleSnapContext:
        snapEnabled && crop
          ? createAuraOverlayScaleSnapContext({
              crop,
              placement,
              profile,
              referenceViewport,
              targetViewport,
            })
          : null,
    });
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLElement>) => {
    const currentResizeState = resizeStateRef.current;
    if (!profile || !currentResizeState || currentResizeState.isReleased) {
      return;
    }

    event.stopPropagation();
    const crop = profile.cropRegions.find(
      (region) =>
        region.id === currentResizeState.initialPlacement.cropRegionId,
    );
    if (!crop) {
      return;
    }

    const deltaX = event.clientX - currentResizeState.startX;
    const deltaY = event.clientY - currentResizeState.startY;
    const draftPlacement = currentResizeState.scaleSnapContext
      ? resizeAuraPlacementWithPeerScaleSnap({
          corner: currentResizeState.corner,
          crop,
          deltaX,
          deltaY,
          placement: currentResizeState.initialPlacement,
          referenceViewport,
          scaleSnapContext: currentResizeState.scaleSnapContext,
          targetViewport,
        })
      : resizeAuraPlacementFromCorner(
          crop,
          currentResizeState.initialPlacement,
          currentResizeState.corner,
          deltaX,
          deltaY,
          targetViewport,
          referenceViewport,
        );

    resizeStateRef.current = { ...currentResizeState, draftPlacement };
    publishInteractionSnapshot();
  };

  const handleResizePointerUp = (event: PointerEvent<HTMLElement>) => {
    const currentResizeState = resizeStateRef.current;
    if (!profile || !currentResizeState || currentResizeState.isReleased) {
      return;
    }

    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const placementId = currentResizeState.placementId;
    const draftPlacement = currentResizeState.draftPlacement;
    if (
      hasSameResizePlacement(
        currentResizeState.initialPlacement,
        draftPlacement,
      )
    ) {
      commitResizeState(null);
      return;
    }

    const crop = profile.cropRegions.find(
      (region) =>
        region.id === currentResizeState.initialPlacement.cropRegionId,
    );
    const referenceDimensions = createReferenceDimensionsForPlacement(
      crop,
      draftPlacement,
      referenceViewport,
    );

    recordAuraHistory(profile);
    const releasedResizeState = {
      ...currentResizeState,
      isReleased: true,
      scaleSnapContext: null,
    };
    commitResizeState(releasedResizeState);
    void updateProfile({
      id: profile.id,
      cropRegions: profile.cropRegions.map((region) =>
        region.id === currentResizeState.initialPlacement.cropRegionId
          ? { ...region, ...referenceDimensions }
          : region,
      ),
      overlayPlacements: profile.overlayPlacements.map((placement) =>
        placement.id === placementId
          ? { ...draftPlacement, ...referenceDimensions }
          : placement,
      ),
    })
      .catch(() => undefined)
      .finally(() => {
        if (resizeStateRef.current === releasedResizeState) {
          commitResizeState(null);
        }
      });
  };

  const handleResizePointerCancel = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (resizeStateRef.current?.isReleased) {
      return;
    }

    commitResizeState(null);
  };

  return {
    handleResizePointerCancel,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
  };
}

function hasSameResizePlacement(
  initialPlacement: OverlayPlacement,
  draftPlacement: OverlayPlacement,
): boolean {
  return (
    initialPlacement.x === draftPlacement.x &&
    initialPlacement.y === draftPlacement.y &&
    initialPlacement.scale === draftPlacement.scale &&
    initialPlacement.width === draftPlacement.width &&
    initialPlacement.height === draftPlacement.height &&
    initialPlacement.referenceWidth === draftPlacement.referenceWidth &&
    initialPlacement.referenceHeight === draftPlacement.referenceHeight
  );
}

export { useAuraOverlayPlacementResize };
