import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CropRegionSelection } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import {
  type CropSelectorPoint,
  createCropSelection,
  isUsableCropSelection,
} from "~/renderer/modules/crop-selector-overlay/CropSelectorOverlay.utils/CropSelectorOverlay.utils";

import styles from "./CropSelectorOverlayPage.module.css";

const cropSelectorRouteClassName = "is-crop-selector-route";

function CropSelectorOverlayPage() {
  const [selection, setSelection] = useState<CropRegionSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startPointRef = useRef<CropSelectorPoint | null>(null);

  const handleCancel = useCallback(() => {
    void window.electron.overlayWindows.cancelCropRegionSelection();
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    startPointRef.current = point;
    setSelection(createCropSelection(point, point));
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!isDragging || !startPointRef.current) {
      return;
    }

    setSelection(
      createCropSelection(startPointRef.current, {
        x: event.clientX,
        y: event.clientY,
      }),
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
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
      return;
    }

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
      {selection && (
        <>
          <div
            className={styles.selectionBox}
            style={{
              left: `${selection.x}px`,
              top: `${selection.y}px`,
              width: `${selection.width}px`,
              height: `${selection.height}px`,
            }}
          />
          <span className={styles.selectionSize} style={selectionSizeStyle}>
            {selection.width} x {selection.height}
          </span>
        </>
      )}
    </main>
  );
}

export { CropSelectorOverlayPage };
