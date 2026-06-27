import type { PointerEvent } from "react";

import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { OverlayPlacement, Profile } from "~/types";
import {
  type AuraVideoSize,
  isAuraResizeCorner,
  resizeAuraPlacementFromCorner,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createReferenceDimensionsForPlacement } from "../useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor.utils";
import type { UseAuraOverlayPlacementInteractionStateResult } from "../useAuraOverlayPlacementInteractionState/useAuraOverlayPlacementInteractionState";

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface UseAuraOverlayPlacementResizeInput {
  interaction: UseAuraOverlayPlacementInteractionStateResult;
  profile: Profile | null;
  recordAuraHistory: () => boolean;
  referenceViewport: AuraVideoSize | null;
  selectPlacement: (placementId: string) => void;
  targetViewport: AuraVideoSize;
  updateProfile: UpdateProfile;
}

function useAuraOverlayPlacementResize({
  interaction,
  profile,
  recordAuraHistory,
  referenceViewport,
  selectPlacement,
  targetViewport,
  updateProfile,
}: UseAuraOverlayPlacementResizeInput) {
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

    const draftPlacement = resizeAuraPlacementFromCorner(
      crop,
      currentResizeState.initialPlacement,
      currentResizeState.corner,
      event.clientX - currentResizeState.startX,
      event.clientY - currentResizeState.startY,
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

    recordAuraHistory();
    const releasedResizeState = {
      ...currentResizeState,
      isReleased: true,
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
    }).finally(() => {
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
