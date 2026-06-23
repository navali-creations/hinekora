import clsx from "clsx";
import type {
  MouseEventHandler,
  PointerEventHandler,
  SyntheticEvent,
} from "react";

import type { CropRegion, OverlayPlacement } from "~/types";
import {
  type AuraResizeCorner,
  type AuraVideoSize,
  auraResizeCorners,
  createAuraVideoStyle,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "./AuraOverlayPlacement.module.css";

interface AuraOverlayDragState {
  placementId: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  deltaX: number;
  deltaY: number;
}

interface AuraOverlayResizeState {
  placementId: string;
  corner: AuraResizeCorner;
  startX: number;
  startY: number;
  initialPlacement: OverlayPlacement;
  draftPlacement: OverlayPlacement;
}

interface AuraOverlayPlacementProps {
  auraOverlayLocked: boolean;
  bindAuraVideo: (element: HTMLVideoElement | null) => void;
  canEditAuras: boolean;
  crop: CropRegion;
  dragState: AuraOverlayDragState | null;
  effectiveVideoSize: AuraVideoSize;
  placement: OverlayPlacement;
  resizeState: AuraOverlayResizeState | null;
  selectedPlacementId: string | null;
  stream: MediaStream | null;
  onAuraClick: MouseEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onResizePointerCancel: PointerEventHandler<HTMLElement>;
  onResizePointerDown: PointerEventHandler<HTMLElement>;
  onResizePointerMove: PointerEventHandler<HTMLElement>;
  onResizePointerUp: PointerEventHandler<HTMLElement>;
  onVideoSizeChange: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

const auraResizeCornerClassNames: Record<AuraResizeCorner, string> = {
  nw: styles.resizeHandleNw ?? "",
  ne: styles.resizeHandleNe ?? "",
  sw: styles.resizeHandleSw ?? "",
  se: styles.resizeHandleSe ?? "",
};

function AuraOverlayPlacement({
  auraOverlayLocked,
  bindAuraVideo,
  canEditAuras,
  crop,
  dragState,
  effectiveVideoSize,
  placement,
  resizeState,
  selectedPlacementId,
  stream,
  onAuraClick,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizePointerCancel,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onVideoSizeChange,
}: AuraOverlayPlacementProps) {
  const effectivePlacement =
    resizeState?.placementId === placement.id
      ? resizeState.draftPlacement
      : placement;
  const isDragging = dragState?.placementId === placement.id;
  const x = isDragging
    ? dragState.initialX + dragState.deltaX
    : effectivePlacement.x;
  const y = isDragging
    ? dragState.initialY + dragState.deltaY
    : effectivePlacement.y;
  const isResizing = resizeState?.placementId === placement.id;
  const isSelected = selectedPlacementId === placement.id;
  const width = Math.round(crop.width * effectivePlacement.scale);
  const height = Math.round(crop.height * effectivePlacement.scale);
  const left = Math.round(x);
  const top = Math.round(y);

  return (
    <div
      className={styles.boxFrame}
      data-placement-id={placement.id}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${crop.width * effectivePlacement.scale}px`,
        height: `${crop.height * effectivePlacement.scale}px`,
      }}
    >
      <button
        className={clsx(
          styles.box,
          auraOverlayLocked && styles.boxLocked,
          canEditAuras && isSelected && styles.boxSelected,
        )}
        data-placement-id={placement.id}
        style={{
          opacity: effectivePlacement.opacity,
        }}
        type="button"
        onPointerCancel={canEditAuras ? onPointerCancel : undefined}
        onPointerDown={canEditAuras ? onPointerDown : undefined}
        onPointerMove={canEditAuras ? onPointerMove : undefined}
        onPointerUp={canEditAuras ? onPointerUp : undefined}
        onClick={canEditAuras ? onAuraClick : undefined}
      >
        {stream && (
          <video
            aria-label={crop.label}
            className={styles.video}
            muted
            playsInline
            ref={bindAuraVideo}
            style={createAuraVideoStyle(
              crop,
              effectivePlacement,
              effectiveVideoSize,
            )}
            onLoadedMetadata={onVideoSizeChange}
            onResize={onVideoSizeChange}
          />
        )}
        {canEditAuras &&
          auraResizeCorners.map((corner) => (
            <span
              aria-hidden="true"
              className={clsx(
                styles.resizeHandle,
                auraResizeCornerClassNames[corner],
              )}
              data-corner={corner}
              data-placement-id={placement.id}
              key={corner}
              onPointerCancel={onResizePointerCancel}
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
            />
          ))}
      </button>
      {!auraOverlayLocked && <span className={styles.label}>{crop.label}</span>}
      {!auraOverlayLocked && isResizing && (
        <span className={styles.resizeReadout}>
          x: {left} y: {top}
          <br />
          {width} x {height}
        </span>
      )}
    </div>
  );
}

export type { AuraOverlayDragState, AuraOverlayResizeState };
export { AuraOverlayPlacement };
