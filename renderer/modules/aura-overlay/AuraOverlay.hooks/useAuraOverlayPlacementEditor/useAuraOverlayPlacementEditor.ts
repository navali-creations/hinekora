import type { MouseEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ProfilesSlice } from "~/renderer/store/store.types";

import { createCoordinateReferenceDimensions, type Profile } from "~/types";
import type {
  AuraOverlayDragState,
  AuraOverlayResizeState,
} from "../../AuraOverlay.components/AuraOverlayPlacement/AuraOverlayPlacement";
import {
  type AuraVideoSize,
  isAuraResizeCorner,
  projectAuraOverlayPlacement,
  resizeAuraPlacementFromCorner,
  resolveAuraReferenceViewport,
  unprojectAuraPoint,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

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
  const [dragState, setDragState] = useState<AuraOverlayDragState | null>(null);
  const [resizeState, setResizeState] = useState<AuraOverlayResizeState | null>(
    null,
  );
  const dragStateRef = useRef<AuraOverlayDragState | null>(null);
  const resizeStateRef = useRef<AuraOverlayResizeState | null>(null);
  const interactionFrameRef = useRef<number | null>(null);

  const cancelInteractionFrame = useCallback(() => {
    if (interactionFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(interactionFrameRef.current);
    interactionFrameRef.current = null;
  }, []);

  const publishInteractionSnapshot = useCallback(() => {
    if (interactionFrameRef.current !== null) {
      return;
    }

    interactionFrameRef.current = window.requestAnimationFrame(() => {
      interactionFrameRef.current = null;
      setDragState(dragStateRef.current);
      setResizeState(resizeStateRef.current);
    });
  }, []);

  const commitDragState = useCallback(
    (nextDragState: AuraOverlayDragState | null) => {
      cancelInteractionFrame();
      dragStateRef.current = nextDragState;
      setDragState(nextDragState);
    },
    [cancelInteractionFrame],
  );

  const commitResizeState = useCallback(
    (nextResizeState: AuraOverlayResizeState | null) => {
      cancelInteractionFrame();
      resizeStateRef.current = nextResizeState;
      setResizeState(nextResizeState);
    },
    [cancelInteractionFrame],
  );

  useEffect(() => cancelInteractionFrame, [cancelInteractionFrame]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      !profile ||
      dragStateRef.current ||
      resizeStateRef.current ||
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
    if (!profile || !currentDragState) {
      return;
    }
    if (currentDragState.isReleased) {
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

  const handleResizePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      !profile ||
      dragStateRef.current ||
      resizeStateRef.current ||
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
    if (!profile || !currentResizeState) {
      return;
    }
    if (currentResizeState.isReleased) {
      return;
    }

    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const placementId = currentResizeState.placementId;
    const draftPlacement = currentResizeState.draftPlacement;
    const crop = profile.cropRegions.find(
      (region) =>
        region.id === currentResizeState.initialPlacement.cropRegionId,
    );
    const referenceDimensions = createCoordinateReferenceDimensions(
      resolveAuraReferenceViewport(
        draftPlacement,
        resolveAuraReferenceViewport(crop, referenceViewport),
      ),
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

  const handleAuraClick = (event: MouseEvent<HTMLElement>) => {
    const placementId = event.currentTarget.dataset.placementId;
    if (placementId) {
      selectPlacement(placementId);
    }
  };

  return {
    dragState,
    handleAuraClick,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleResizePointerCancel,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
    resizeState,
  };
}

export { useAuraOverlayPlacementEditor };
