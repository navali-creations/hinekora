import type { PointerEvent } from "react";

import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { Profile } from "~/types";
import {
  type AuraVideoSize,
  resolveAuraPlacementArcVisibleThickness,
  resolveAuraPlacementDisplaySize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import {
  isArchedCropRegion,
  resizeArchedPlacementThickness,
} from "../useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor.utils";
import type { UseAuraOverlayPlacementInteractionStateResult } from "../useAuraOverlayPlacementInteractionState/useAuraOverlayPlacementInteractionState";

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface UseAuraOverlayArcThicknessResizeInput {
  interaction: UseAuraOverlayPlacementInteractionStateResult;
  profile: Profile | null;
  recordAuraHistory: () => boolean;
  referenceViewport: AuraVideoSize | null;
  selectPlacement: (placementId: string) => void;
  targetViewport: AuraVideoSize;
  updateProfile: UpdateProfile;
}

function useAuraOverlayArcThicknessResize({
  interaction,
  profile,
  recordAuraHistory,
  referenceViewport,
  selectPlacement,
  targetViewport,
  updateProfile,
}: UseAuraOverlayArcThicknessResizeInput) {
  const {
    arcThicknessResizeStateRef,
    commitArcThicknessResizeState,
    commitDragState,
    commitResizeState,
    dragStateRef,
    publishInteractionSnapshot,
    resizeStateRef,
  } = interaction;

  const handleThicknessPointerDown = (event: PointerEvent<HTMLElement>) => {
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
      (region) => region.id === placement?.cropRegionId,
    );
    if (!placement || !isArchedCropRegion(crop)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectPlacement(placement.id);
    commitDragState(null);
    commitResizeState(null);
    const displaySize = resolveAuraPlacementDisplaySize(
      crop,
      placement,
      targetViewport,
      referenceViewport,
    );
    commitArcThicknessResizeState({
      placementId: placement.id,
      startX: event.clientX,
      startY: event.clientY,
      crop,
      initialPlacement: placement,
      draftPlacement: placement,
      initialDisplayThickness:
        resolveAuraPlacementArcVisibleThickness(crop, placement, displaySize) ??
        crop.arc.thickness,
      maxDisplayThickness: Math.max(displaySize.width, displaySize.height),
      isReleased: false,
    });
  };

  const handleThicknessPointerMove = (event: PointerEvent<HTMLElement>) => {
    const currentResizeState = arcThicknessResizeStateRef.current;
    if (!currentResizeState || currentResizeState.isReleased) {
      return;
    }

    event.stopPropagation();
    const nextThickness = resizeArchedPlacementThickness(
      currentResizeState.crop,
      currentResizeState.initialDisplayThickness,
      currentResizeState.maxDisplayThickness,
      event.clientX - currentResizeState.startX,
      event.clientY - currentResizeState.startY,
    );
    arcThicknessResizeStateRef.current = {
      ...currentResizeState,
      draftPlacement: {
        ...currentResizeState.initialPlacement,
        arcVisibleThickness: nextThickness,
      },
    };
    publishInteractionSnapshot();
  };

  const handleThicknessPointerUp = (event: PointerEvent<HTMLElement>) => {
    const currentResizeState = arcThicknessResizeStateRef.current;
    if (!profile || !currentResizeState || currentResizeState.isReleased) {
      return;
    }

    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const draftPlacement = currentResizeState.draftPlacement;
    if (
      Math.round(
        draftPlacement.arcVisibleThickness ??
          currentResizeState.initialDisplayThickness,
      ) === Math.round(currentResizeState.initialDisplayThickness)
    ) {
      commitArcThicknessResizeState(null);
      return;
    }

    recordAuraHistory();
    const releasedResizeState = {
      ...currentResizeState,
      isReleased: true,
    };
    commitArcThicknessResizeState(releasedResizeState);
    void updateProfile({
      id: profile.id,
      overlayPlacements: profile.overlayPlacements.map((placement) =>
        placement.id === currentResizeState.placementId
          ? draftPlacement
          : placement,
      ),
    }).finally(() => {
      if (arcThicknessResizeStateRef.current === releasedResizeState) {
        commitArcThicknessResizeState(null);
      }
    });
  };

  const handleThicknessPointerCancel = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (arcThicknessResizeStateRef.current?.isReleased) {
      return;
    }

    commitArcThicknessResizeState(null);
  };

  return {
    handleThicknessPointerCancel,
    handleThicknessPointerDown,
    handleThicknessPointerMove,
    handleThicknessPointerUp,
  };
}

export { useAuraOverlayArcThicknessResize };
