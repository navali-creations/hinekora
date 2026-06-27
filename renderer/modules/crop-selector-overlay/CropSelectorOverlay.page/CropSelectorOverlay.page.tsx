import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CropRegionSelection,
  CropRegionSelectionShape,
} from "~/main/modules/overlay-windows/OverlayWindows.dto";
import {
  type CropSelectorPoint,
  createArcCropSelection,
  createCropSelection,
  isUsableArcEndpointSelection,
  isUsableCropSelection,
} from "~/renderer/modules/crop-selector-overlay/CropSelectorOverlay.utils/CropSelectorOverlay.utils";
import { trackEvent } from "~/renderer/modules/umami";

import { ArcSelectionPreview } from "../CropSelectorOverlay.components/ArcSelectionPreview/ArcSelectionPreview";
import styles from "./CropSelectorOverlayPage.module.css";

const cropSelectorRouteClassName = "is-crop-selector-route";

function readCropSelectorShape(
  hash = window.location.hash,
): CropRegionSelectionShape {
  return new URLSearchParams(hash.split("?")[1] ?? "").get("shape") === "arc"
    ? "arc"
    : "rect";
}

function CropSelectorOverlayPage() {
  const [shape] = useState(readCropSelectorShape);
  const [selection, setSelection] = useState<CropRegionSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [arcStart, setArcStart] = useState<CropSelectorPoint | null>(null);
  const [arcEnd, setArcEnd] = useState<CropSelectorPoint | null>(null);
  const [hoverPoint, setHoverPoint] = useState<CropSelectorPoint | null>(null);
  const startPointRef = useRef<CropSelectorPoint | null>(null);

  const handleCancel = useCallback(() => {
    trackEvent("crop-selection-cancelled");
    void window.electron.overlayWindows.cancelCropRegionSelection();
  }, []);

  const resetArcSelection = () => {
    setArcStart(null);
    setArcEnd(null);
    setHoverPoint(null);
    setSelection(null);
  };

  const handleArcPoint = (point: CropSelectorPoint) => {
    if (!arcStart) {
      resetArcSelection();
      setArcStart(point);
      setHoverPoint(point);
      trackEvent("arc-selection-started");
      return;
    }

    if (!arcEnd) {
      if (!isUsableArcEndpointSelection(arcStart, point)) {
        resetArcSelection();
        trackEvent("crop-selection-discarded");
        return;
      }

      setArcEnd(point);
      setHoverPoint({
        x: (arcStart.x + point.x) / 2,
        y: (arcStart.y + point.y) / 2,
      });
      return;
    }

    const nextSelection = createArcCropSelection(arcStart, arcEnd, point);
    if (!isUsableCropSelection(nextSelection)) {
      resetArcSelection();
      trackEvent("crop-selection-discarded");
      return;
    }

    trackEvent("arc-selection-completed");
    void window.electron.overlayWindows.completeCropRegionSelection(
      nextSelection,
    );
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    const point = { x: event.clientX, y: event.clientY };
    if (shape === "arc") {
      handleArcPoint(point);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    startPointRef.current = point;
    setSelection(createCropSelection(point, point));
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const point = { x: event.clientX, y: event.clientY };
    if (shape === "arc") {
      if (!arcStart) {
        return;
      }

      setHoverPoint(point);
      if (arcEnd) {
        setSelection(createArcCropSelection(arcStart, arcEnd, point));
      }
      return;
    }

    if (!isDragging || !startPointRef.current) {
      return;
    }

    setSelection(createCropSelection(startPointRef.current, point));
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (shape === "arc") {
      return;
    }

    if (!isDragging || !startPointRef.current) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    const nextSelection = createCropSelection(startPointRef.current, {
      x: event.clientX,
      y: event.clientY,
    });
    startPointRef.current = null;
    setIsDragging(false);

    if (!isUsableCropSelection(nextSelection)) {
      setSelection(null);
      trackEvent("crop-selection-discarded");
      return;
    }

    trackEvent("crop-selection-completed");
    void window.electron.overlayWindows.completeCropRegionSelection(
      nextSelection,
    );
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    handleCancel();
  };
  const selectionSizeStyle: CSSProperties | undefined = selection
    ? {
        left: `min(${selection.x}px, calc(100vw - 5rem))`,
        top:
          selection.y >= 32
            ? `${selection.y}px`
            : `${selection.y + selection.height}px`,
        transform:
          selection.y >= 32
            ? "translateY(calc(-100% - 6px))"
            : "translateY(6px)",
      }
    : undefined;

  useEffect(() => {
    document.documentElement.classList.add(cropSelectorRouteClassName);
    document.body.classList.add(cropSelectorRouteClassName);

    return () => {
      document.documentElement.classList.remove(cropSelectorRouteClassName);
      document.body.classList.remove(cropSelectorRouteClassName);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel]);

  return (
    <main
      aria-label="Crop selector"
      className={styles.overlay}
      role="application"
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {shape === "arc" && (
        <ArcSelectionPreview
          arcEnd={arcEnd}
          arcStart={arcStart}
          hoverPoint={hoverPoint}
        />
      )}
      {selection && (
        <>
          <div
            className={
              selection.shape === "arc"
                ? styles.arcSelectionBox
                : styles.selectionBox
            }
            style={{
              left: `${selection.x}px`,
              top: `${selection.y}px`,
              width: `${selection.width}px`,
              height: `${selection.height}px`,
            }}
          />
          <span className={styles.selectionSize} style={selectionSizeStyle}>
            {selection.shape === "arc"
              ? `Arc ${selection.arc?.thickness ?? 0}px`
              : `${selection.width} x ${selection.height}`}
          </span>
        </>
      )}
    </main>
  );
}

export { CropSelectorOverlayPage };
