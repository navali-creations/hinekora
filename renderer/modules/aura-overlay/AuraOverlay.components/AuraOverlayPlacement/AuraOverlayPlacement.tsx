import clsx from "clsx";

import {
  projectAuraOverlayPlacement,
  resolveAuraPlacementArcVisibleThickness,
  resolveAuraPlacementDisplaySize,
  resolveAuraReferenceViewport,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { AuraArcThicknessHandle } from "../AuraArcThicknessHandle/AuraArcThicknessHandle";
import { AuraOverlayPlacementVideo } from "../AuraOverlayPlacementVideo/AuraOverlayPlacementVideo";
import { AuraOverlayResizeHandles } from "../AuraOverlayResizeHandles/AuraOverlayResizeHandles";
import { AuraPlacementPropertiesPanel } from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import styles from "./AuraOverlayPlacement.module.css";
import {
  type AuraOverlayPlacementProps,
  createPlacementContentTransform,
  resolvePropertiesPanelSide,
} from "./AuraOverlayPlacement.utils";

function AuraOverlayPlacement({
  arcThicknessResizeState,
  auraOverlayLocked,
  bindAuraVideo,
  canEditAuras,
  crop,
  dragState,
  effectiveVideoSize,
  placement,
  referenceViewport,
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
  onPlacementPropertiesChange,
  onThicknessPointerCancel,
  onThicknessPointerDown,
  onThicknessPointerMove,
  onThicknessPointerUp,
  onVideoSizeChange,
}: AuraOverlayPlacementProps) {
  const currentResizeState =
    resizeState?.placementId === placement.id ? resizeState : null;
  const currentThicknessResizeState =
    arcThicknessResizeState?.placementId === placement.id
      ? arcThicknessResizeState
      : null;
  const effectivePlacement =
    currentResizeState?.draftPlacement ??
    currentThicknessResizeState?.draftPlacement ??
    placement;
  const cropReferenceViewport = resolveAuraReferenceViewport(
    crop,
    referenceViewport,
  );
  const projectedPlacement = projectAuraOverlayPlacement(
    effectivePlacement,
    effectiveVideoSize,
    cropReferenceViewport,
  );
  const currentDragState =
    dragState?.placementId === placement.id ? dragState : null;
  const x = currentDragState
    ? currentDragState.initialDisplayX + currentDragState.deltaX
    : projectedPlacement.x;
  const y = currentDragState
    ? currentDragState.initialDisplayY + currentDragState.deltaY
    : projectedPlacement.y;
  const isResizing = currentResizeState !== null;
  const isSelected = selectedPlacementId === placement.id;
  const placementSize = resolveAuraPlacementDisplaySize(
    crop,
    effectivePlacement,
    effectiveVideoSize,
    referenceViewport,
  );
  const displayWidth = Math.round(placementSize.width);
  const displayHeight = Math.round(placementSize.height);
  const width = displayWidth;
  const height = displayHeight;
  const left = Math.round(x);
  const top = Math.round(y);
  const visibleArcThickness = resolveAuraPlacementArcVisibleThickness(
    crop,
    effectivePlacement,
    placementSize,
  );
  const effectiveVisibleArcThickness = visibleArcThickness;
  const contentTransform = createPlacementContentTransform(effectivePlacement);
  const isStraightenedArc =
    effectivePlacement.arcStraightened === true &&
    crop.shape === "arc" &&
    !!crop.arc &&
    effectiveVisibleArcThickness !== undefined;
  const arcControlPoint = crop.arc
    ? {
        x: (crop.arc.controlX / crop.width) * 100,
        y: (crop.arc.controlY / crop.height) * 100,
      }
    : null;

  return (
    <div
      className={styles.boxFrame}
      data-placement-id={placement.id}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${placementSize.width}px`,
        height: `${placementSize.height}px`,
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
          <AuraOverlayPlacementVideo
            bindAuraVideo={bindAuraVideo}
            contentTransform={contentTransform}
            crop={crop}
            displaySize={placementSize}
            isStraightenedArc={isStraightenedArc}
            placement={effectivePlacement}
            referenceViewport={referenceViewport}
            videoSize={effectiveVideoSize}
            visibleThickness={effectiveVisibleArcThickness}
            onVideoSizeChange={onVideoSizeChange}
          />
        )}
        {canEditAuras && (
          <AuraOverlayResizeHandles
            placementId={placement.id}
            onPointerCancel={onResizePointerCancel}
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
          />
        )}
        {canEditAuras && arcControlPoint && (
          <AuraArcThicknessHandle
            controlXPercent={arcControlPoint.x}
            controlYPercent={arcControlPoint.y}
            placementId={placement.id}
            onPointerCancel={onThicknessPointerCancel}
            onPointerDown={onThicknessPointerDown}
            onPointerMove={onThicknessPointerMove}
            onPointerUp={onThicknessPointerUp}
          />
        )}
      </button>
      {!auraOverlayLocked && <span className={styles.label}>{crop.label}</span>}
      {!auraOverlayLocked && isResizing && (
        <span className={styles.resizeReadout}>
          x: {left} y: {top}
          <br />
          {width} x {height}
        </span>
      )}
      {!auraOverlayLocked &&
        currentThicknessResizeState &&
        effectiveVisibleArcThickness !== undefined && (
          <span className={styles.resizeReadout}>
            thickness: {Math.round(effectiveVisibleArcThickness)}px
          </span>
        )}
      {!auraOverlayLocked && canEditAuras && isSelected && (
        <AuraPlacementPropertiesPanel
          displayHeight={displayHeight}
          displayWidth={displayWidth}
          placement={effectivePlacement}
          side={resolvePropertiesPanelSide(
            left,
            top,
            displayWidth,
            displayHeight,
          )}
          {...(effectiveVisibleArcThickness !== undefined
            ? { visibleThickness: effectiveVisibleArcThickness }
            : {})}
          onChange={onPlacementPropertiesChange}
        />
      )}
    </div>
  );
}

export { AuraOverlayPlacement };
