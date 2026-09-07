import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";

import { useAuraOverlayShallow, useBoundStore } from "~/renderer/store";

import type { Profile } from "~/types";
import type { AuraOverlayAreaSelectionDraftHandle } from "../../AuraOverlay.components/AuraOverlayAreaSelectionDraft/AuraOverlayAreaSelectionDraft";
import type { AuraVideoSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import {
  type AuraOverlayAreaSelectionBounds,
  type AuraOverlayAreaSelectionPoint,
  createAuraOverlayAreaSelectionBounds,
  findAuraPlacementsInArea,
  isUsableAuraAreaSelection,
} from "./useAuraOverlayAreaSelection.utils";

interface UseAuraOverlayAreaSelectionInput {
  canEditAuras: boolean;
  profile: Profile | null;
  referenceViewport: AuraVideoSize | null;
  targetViewport: AuraVideoSize;
}

interface ActiveAreaSelection {
  pointerId: number;
  start: AuraOverlayAreaSelectionPoint;
}

function useAuraOverlayAreaSelection({
  canEditAuras,
  profile,
  referenceViewport,
  targetViewport,
}: UseAuraOverlayAreaSelectionInput) {
  const {
    clearAreaSelection: clearCompletedAreaSelection,
    clearPlacementSelection,
    setAreaSelection,
  } = useAuraOverlayShallow((auraOverlay) => ({
    clearAreaSelection: auraOverlay.clearAreaSelection,
    clearPlacementSelection: auraOverlay.clearPlacementSelection,
    setAreaSelection: auraOverlay.setAreaSelection,
  }));
  const activeSelectionRef = useRef<ActiveAreaSelection | null>(null);
  const draftBoundsRef = useRef<AuraOverlayAreaSelectionBounds | null>(null);
  const draftSelectionRef = useRef<AuraOverlayAreaSelectionDraftHandle | null>(
    null,
  );
  const animationFrameRef = useRef<number | null>(null);
  const selectionScope = canEditAuras ? profile?.id : null;
  const selectionScopeRef = useRef(selectionScope);

  const cancelAnimationFrame = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const publishDraftBounds = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const bounds = draftBoundsRef.current;
      if (bounds) {
        draftSelectionRef.current?.update(bounds);
      }
    });
  }, []);

  const clearAreaSelection = useCallback(() => {
    cancelAnimationFrame();
    activeSelectionRef.current = null;
    draftBoundsRef.current = null;
    draftSelectionRef.current?.clear();
    clearCompletedAreaSelection();
  }, [cancelAnimationFrame, clearCompletedAreaSelection]);

  const handleAreaPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!canEditAuras || !profile || event.button !== 0) {
      return;
    }

    if (event.target !== event.currentTarget) {
      const target = event.target;
      if (
        useBoundStore.getState().auraOverlay.areaSelection &&
        (!(target instanceof Element) ||
          !target.closest("[data-aura-area-selection]"))
      ) {
        clearAreaSelection();
      }
      return;
    }

    const start = { x: event.clientX, y: event.clientY };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearPlacementSelection();
    clearAreaSelection();
    activeSelectionRef.current = { pointerId: event.pointerId, start };
    draftBoundsRef.current = createAuraOverlayAreaSelectionBounds(start, start);
    draftSelectionRef.current?.update(draftBoundsRef.current);
  };

  const handleAreaPointerMove = (event: PointerEvent<HTMLElement>) => {
    const activeSelection = activeSelectionRef.current;
    if (!activeSelection || activeSelection.pointerId !== event.pointerId) {
      return;
    }

    draftBoundsRef.current = createAuraOverlayAreaSelectionBounds(
      activeSelection.start,
      { x: event.clientX, y: event.clientY },
    );
    publishDraftBounds();
  };

  const handleAreaPointerUp = (event: PointerEvent<HTMLElement>) => {
    const activeSelection = activeSelectionRef.current;
    if (!activeSelection || activeSelection.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cancelAnimationFrame();
    const bounds = createAuraOverlayAreaSelectionBounds(activeSelection.start, {
      x: event.clientX,
      y: event.clientY,
    });
    activeSelectionRef.current = null;
    draftBoundsRef.current = null;
    draftSelectionRef.current?.clear();

    if (!profile || !isUsableAuraAreaSelection(bounds)) {
      clearCompletedAreaSelection();
      return;
    }

    const placementIds = findAuraPlacementsInArea({
      bounds,
      profile,
      referenceViewport,
      targetViewport,
    });
    setAreaSelection(
      placementIds.length > 0 ? { ...bounds, placementIds } : null,
    );
  };

  const handleAreaPointerCancel = (event: PointerEvent<HTMLElement>) => {
    const activeSelection = activeSelectionRef.current;
    if (!activeSelection || activeSelection.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearAreaSelection();
  };

  const handleAreaContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (
      !useBoundStore.getState().auraOverlay.areaSelection &&
      !activeSelectionRef.current
    ) {
      return;
    }

    event.preventDefault();
    const pointerId = activeSelectionRef.current?.pointerId;
    if (
      pointerId !== undefined &&
      event.currentTarget.hasPointerCapture(pointerId)
    ) {
      event.currentTarget.releasePointerCapture(pointerId);
    }
    clearAreaSelection();
  };

  useEffect(() => clearAreaSelection, [clearAreaSelection]);
  useEffect(() => {
    if (selectionScopeRef.current === selectionScope) {
      return;
    }

    selectionScopeRef.current = selectionScope;
    clearAreaSelection();
  });

  return {
    clearAreaSelection,
    draftSelectionRef,
    handleAreaContextMenu,
    handleAreaPointerCancel,
    handleAreaPointerDown,
    handleAreaPointerMove,
    handleAreaPointerUp,
  };
}

export { useAuraOverlayAreaSelection };
