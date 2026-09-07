import type { MouseEvent, PointerEvent } from "react";
import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  type CropSelectorPoint,
  createArcCropSelection,
  createCropSelection,
  createPointCropSelection,
  isUsableArcEndpointSelection,
  isUsableCropSelection,
  isUsablePointSelection,
  maxPointSelectionPoints,
  readCropSelectorShape,
} from "~/renderer/modules/crop-selector-overlay/CropSelectorOverlay.utils/CropSelectorOverlay.utils";

import {
  createCropSelectorSelectionState,
  cropSelectorSelectionReducer,
} from "./useCropSelectorSelection.utils";

function useCropSelectorSelection() {
  const [state, dispatch] = useReducer(
    cropSelectorSelectionReducer,
    readCropSelectorShape(),
    createCropSelectorSelectionState,
  );
  const startPointRef = useRef<CropSelectorPoint | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const {
    arcEnd,
    arcStart,
    hoverPoint,
    isDragging,
    pointSelectionPoints,
    selection,
    shape,
  } = state;

  const handleCancel = useCallback(() => {
    void window.electron.overlayWindows.cancelCropRegionSelection();
  }, []);

  const resetArcSelection = useCallback(() => {
    dispatch({ type: "reset-arc-selection" });
  }, []);

  const completePointSelection = useCallback((points: CropSelectorPoint[]) => {
    if (!isUsablePointSelection(points)) {
      return;
    }

    void window.electron.overlayWindows.completeCropRegionSelection(
      createPointCropSelection(points),
    );
  }, []);

  const handlePointSelectionPoint = useCallback(
    (point: CropSelectorPoint) => {
      const nextPoints = [...pointSelectionPoints, point].slice(
        0,
        maxPointSelectionPoints,
      );
      dispatch({
        points: nextPoints,
        selection: createPointCropSelection(nextPoints),
        type: "set-point-selection",
      });
      if (nextPoints.length === maxPointSelectionPoints) {
        completePointSelection(nextPoints);
      }
    },
    [completePointSelection, pointSelectionPoints],
  );

  const handleCompletePointSelection = useCallback(() => {
    completePointSelection(pointSelectionPoints);
  }, [completePointSelection, pointSelectionPoints]);

  const handleArcPoint = useCallback(
    (point: CropSelectorPoint) => {
      if (!arcStart) {
        dispatch({ point, type: "start-arc-selection" });
        return;
      }

      if (!arcEnd) {
        if (!isUsableArcEndpointSelection(arcStart, point)) {
          resetArcSelection();
          return;
        }

        dispatch({
          hoverPoint: {
            x: (arcStart.x + point.x) / 2,
            y: (arcStart.y + point.y) / 2,
          },
          point,
          type: "set-arc-end",
        });
        return;
      }

      const nextSelection = createArcCropSelection(arcStart, arcEnd, point);
      if (!isUsableCropSelection(nextSelection)) {
        resetArcSelection();
        return;
      }

      void window.electron.overlayWindows.completeCropRegionSelection(
        nextSelection,
      );
    },
    [arcEnd, arcStart, resetArcSelection],
  );

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    const point = { x: event.clientX, y: event.clientY };
    if (shape === "arc") {
      handleArcPoint(point);
      return;
    }

    if (shape === "points") {
      handlePointSelectionPoint(point);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    startPointRef.current = point;
    dispatch({
      point,
      selection: createCropSelection(point, point),
      type: "start-drag",
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const point = { x: event.clientX, y: event.clientY };
    if (shape === "arc") {
      if (!arcStart) {
        return;
      }

      dispatch({ point, type: "set-hover-point" });
      if (arcEnd) {
        dispatch({
          hoverPoint: point,
          selection: createArcCropSelection(arcStart, arcEnd, point),
          type: "preview-selection",
        });
      }
      return;
    }

    if (shape === "points") {
      if (pointSelectionPoints.length > 0) {
        dispatch({ point, type: "set-hover-point" });
      }
      return;
    }

    if (!isDragging || !startPointRef.current) {
      return;
    }

    dispatch({
      hoverPoint: point,
      selection: createCropSelection(startPointRef.current, point),
      type: "preview-selection",
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (shape === "arc" || shape === "points") {
      return;
    }

    if (!isDragging || !startPointRef.current) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    activePointerIdRef.current = null;
    const nextSelection = createCropSelection(startPointRef.current, {
      x: event.clientX,
      y: event.clientY,
    });
    startPointRef.current = null;
    dispatch({ type: "finish-drag" });

    if (!isUsableCropSelection(nextSelection)) {
      dispatch({ type: "clear-selection" });
      return;
    }

    void window.electron.overlayWindows.completeCropRegionSelection(
      nextSelection,
    );
  };

  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const activePointerId = activePointerIdRef.current;
    if (
      activePointerId !== null &&
      event.currentTarget.hasPointerCapture(activePointerId)
    ) {
      event.currentTarget.releasePointerCapture(activePointerId);
    }

    activePointerIdRef.current = null;
    startPointRef.current = null;
    dispatch({ type: "reset-selection" });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (shape === "points" && pointSelectionPoints.length > 0) {
          handleCompletePointSelection();
          return;
        }

        handleCancel();
        return;
      }

      if (event.key === "Enter" && shape === "points") {
        handleCompletePointSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, handleCompletePointSelection, pointSelectionPoints, shape]);

  return {
    arcEnd,
    arcStart,
    handleContextMenu,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    hoverPoint,
    pointSelectionPoints,
    selection,
    shape,
  };
}

export { useCropSelectorSelection };
