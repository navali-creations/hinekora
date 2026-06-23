import type { MouseEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { Profile } from "~/types";
import type {
  AuraOverlayDragState,
  AuraOverlayResizeState,
} from "../../AuraOverlay.components/AuraOverlayPlacement/AuraOverlayPlacement";
import {
  isAuraResizeCorner,
  resizeAuraPlacementFromCorner,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface UseAuraOverlayPlacementEditorInput {
  profile: Profile | null;
  recordAuraHistory: () => boolean;
  selectPlacement: (placementId: string) => void;
  updateProfile: UpdateProfile;
}

function useAuraOverlayPlacementEditor({
  profile,
  recordAuraHistory,
  selectPlacement,
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
    if (!profile || resizeStateRef.current || event.button !== 0) {
      return;
    }

    const placementId = event.currentTarget.dataset.placementId;
    const placement = profile.overlayPlacements.find(
      (item) => item.id === placementId,
    );

    if (!placement) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectPlacement(placement.id);
    commitDragState({
      placementId: placement.id,
      startX: event.clientX,
      startY: event.clientY,
      initialX: placement.x,
      initialY: placement.y,
      deltaX: 0,
      deltaY: 0,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const currentDragState = dragStateRef.current;
    if (!currentDragState) {
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

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const x = Math.max(
      0,
      Math.round(currentDragState.initialX + currentDragState.deltaX),
    );
    const y = Math.max(
      0,
      Math.round(currentDragState.initialY + currentDragState.deltaY),
    );
    const placementId = currentDragState.placementId;
    commitDragState(null);
    if (x === currentDragState.initialX && y === currentDragState.initialY) {
      return;
    }

    recordAuraHistory();
    void updateProfile({
      id: profile.id,
      overlayPlacements: profile.overlayPlacements.map((placement) =>
        placement.id === placementId ? { ...placement, x, y } : placement,
      ),
    });
  };

  const handlePointerCancel = () => {
    commitDragState(null);
  };

  const handleResizePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!profile || event.button !== 0) {
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
    });
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLElement>) => {
    const currentResizeState = resizeStateRef.current;
    if (!profile || !currentResizeState) {
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
    );

    resizeStateRef.current = { ...currentResizeState, draftPlacement };
    publishInteractionSnapshot();
  };

  const handleResizePointerUp = (event: PointerEvent<HTMLElement>) => {
    const currentResizeState = resizeStateRef.current;
    if (!profile || !currentResizeState) {
      return;
    }

    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const placementId = currentResizeState.placementId;
    const draftPlacement = currentResizeState.draftPlacement;
    commitResizeState(null);

    recordAuraHistory();
    void updateProfile({
      id: profile.id,
      overlayPlacements: profile.overlayPlacements.map((placement) =>
        placement.id === placementId ? draftPlacement : placement,
      ),
    });
  };

  const handleResizePointerCancel = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
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
