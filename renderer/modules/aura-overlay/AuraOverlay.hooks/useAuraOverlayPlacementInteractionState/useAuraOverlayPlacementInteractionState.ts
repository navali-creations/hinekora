import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  AuraArcThicknessResizeState,
  AuraOverlayDragState,
  AuraOverlayResizeState,
} from "../../AuraOverlay.components/AuraOverlayPlacement/AuraOverlayPlacement.utils";

interface UseAuraOverlayPlacementInteractionStateResult {
  arcThicknessResizeState: AuraArcThicknessResizeState | null;
  arcThicknessResizeStateRef: RefObject<AuraArcThicknessResizeState | null>;
  commitArcThicknessResizeState: (
    nextResizeState: AuraArcThicknessResizeState | null,
  ) => void;
  commitDragState: (nextDragState: AuraOverlayDragState | null) => void;
  commitResizeState: (nextResizeState: AuraOverlayResizeState | null) => void;
  dragState: AuraOverlayDragState | null;
  dragStateRef: RefObject<AuraOverlayDragState | null>;
  publishInteractionSnapshot: () => void;
  resizeState: AuraOverlayResizeState | null;
  resizeStateRef: RefObject<AuraOverlayResizeState | null>;
}

function useAuraOverlayPlacementInteractionState(): UseAuraOverlayPlacementInteractionStateResult {
  const [dragState, setDragState] = useState<AuraOverlayDragState | null>(null);
  const [resizeState, setResizeState] = useState<AuraOverlayResizeState | null>(
    null,
  );
  const [arcThicknessResizeState, setArcThicknessResizeState] =
    useState<AuraArcThicknessResizeState | null>(null);
  const dragStateRef = useRef<AuraOverlayDragState | null>(null);
  const resizeStateRef = useRef<AuraOverlayResizeState | null>(null);
  const arcThicknessResizeStateRef = useRef<AuraArcThicknessResizeState | null>(
    null,
  );
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
      setArcThicknessResizeState(arcThicknessResizeStateRef.current);
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

  const commitArcThicknessResizeState = useCallback(
    (nextResizeState: AuraArcThicknessResizeState | null) => {
      cancelInteractionFrame();
      arcThicknessResizeStateRef.current = nextResizeState;
      setArcThicknessResizeState(nextResizeState);
    },
    [cancelInteractionFrame],
  );

  useEffect(() => cancelInteractionFrame, [cancelInteractionFrame]);

  return {
    arcThicknessResizeState,
    arcThicknessResizeStateRef,
    commitArcThicknessResizeState,
    commitDragState,
    commitResizeState,
    dragState,
    dragStateRef,
    publishInteractionSnapshot,
    resizeState,
    resizeStateRef,
  };
}

export type { UseAuraOverlayPlacementInteractionStateResult };
export { useAuraOverlayPlacementInteractionState };
