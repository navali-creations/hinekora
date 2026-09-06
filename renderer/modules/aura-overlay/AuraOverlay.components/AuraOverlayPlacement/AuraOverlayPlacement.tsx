import clsx from "clsx";

import { useAuraOverlayShallow } from "~/renderer/store";

import {
  createAuraArcBoundaryPaths,
  resolveAuraPlacementArcVisibleThickness,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementVisualPoint,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { AuraArcThicknessHandle } from "../AuraArcThicknessHandle/AuraArcThicknessHandle";
import { AuraOverlayPlacementVideo } from "../AuraOverlayPlacementVideo/AuraOverlayPlacementVideo";
import { AuraOverlayResizeHandles } from "../AuraOverlayResizeHandles/AuraOverlayResizeHandles";
import { AuraPlacementPropertiesPanel } from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import styles from "./AuraOverlayPlacement.module.css";
import {
  type AuraOverlayPlacementProps,
  createPlacementContentStyle,
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
  const selectedPlacementId = useAuraOverlayShallow(
    (auraOverlay) => auraOverlay.selectedPlacementId,
  );
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
  const { contentSize: placementSize, visualBounds } =
    resolveAuraPlacementGeometry(
      crop,
      effectivePlacement,
      effectiveVideoSize,
      referenceViewport,
    );
  const currentDragState =
    dragState?.placementId === placement.id ? dragState : null;
  const x = currentDragState
    ? currentDragState.initialDisplayX + currentDragState.deltaX
    : visualBounds.x;
  const y = currentDragState
    ? currentDragState.initialDisplayY + currentDragState.deltaY
    : visualBounds.y;
  const isResizing = currentResizeState !== null;
  const isSelected = selectedPlacementId === placement.id;
  const displayWidth = Math.round(visualBounds.width);
  const displayHeight = Math.round(visualBounds.height);
  const width = displayWidth;
  const height = displayHeight;
  const left = Math.round(x);
  const top = Math.round(y);
  const visibleArcThickness = resolveAuraPlacementArcVisibleThickness(
    crop,
    effectivePlacement,
    placementSize,
  );
  const contentStyle = createPlacementContentStyle(
    effectivePlacement,
    placementSize,
  );
  const isStraightenedArc =
    effectivePlacement.arcStraightened === true &&
    crop.shape === "arc" &&
    !!crop.arc &&
    visibleArcThickness !== undefined;
  const arcControlPoint = crop.arc
    ? resolveAuraPlacementVisualPoint(effectivePlacement, {
        x: (crop.arc.controlX / crop.width) * 100,
        y: (crop.arc.controlY / crop.height) * 100,
      })
    : null;
  const arcBoundaryPaths =
    canEditAuras &&
    crop.shape === "arc" &&
    !isStraightenedArc &&
    visibleArcThickness !== undefined
      ? createAuraArcBoundaryPaths(crop, visibleArcThickness, placementSize)
      : null;

  return (
    <div
      className={styles.boxFrame}
      data-placement-id={placement.id}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${visualBounds.width}px`,
        height: `${visualBounds.height}px`,
      }}
    >
      <button
        className={clsx(
          styles.box,
          crop.shape === "arc" && styles.boxArc,
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
            contentStyle={contentStyle}
            crop={crop}
            displaySize={placementSize}
            isStraightenedArc={isStraightenedArc}
            placement={effectivePlacement}
            referenceViewport={referenceViewport}
            videoSize={effectiveVideoSize}
            visibleThickness={visibleArcThickness}
            onVideoSizeChange={onVideoSizeChange}
          />
        )}
        {arcBoundaryPaths && (
          <svg
            aria-hidden="true"
            className={styles.arcBoundaryOverlay}
            style={contentStyle}
            viewBox={`0 0 ${placementSize.width} ${placementSize.height}`}
          >
            <path
              className={styles.arcBoundaryPath}
              d={arcBoundaryPaths.outer}
            />
            <path
              className={styles.arcBoundaryPath}
              d={arcBoundaryPaths.inner}
            />
          </svg>
        )}
        {canEditAuras && (
          <AuraOverlayResizeHandles
            compact={crop.shape === "points"}
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
      {!auraOverlayLocked && (
        <span className={styles.label} data-aura-label>
          {crop.label}
        </span>
      )}
      {!auraOverlayLocked && isResizing && (
        <span className={styles.resizeReadout}>
          x: {left} y: {top}
          <br />
          {width} x {height}
        </span>
      )}
      {!auraOverlayLocked &&
        currentThicknessResizeState &&
        visibleArcThickness !== undefined && (
          <span className={styles.resizeReadout}>
            thickness: {Math.round(visibleArcThickness)}px
          </span>
        )}
      {!auraOverlayLocked && canEditAuras && isSelected && (
        <AuraPlacementPropertiesPanel
          anchorBounds={{
            height: displayHeight,
            left,
            top,
            width: displayWidth,
          }}
          displayHeight={displayHeight}
          displayWidth={displayWidth}
          label={crop.label}
          placement={effectivePlacement}
          pointControls={crop.shape === "points"}
          {...(visibleArcThickness !== undefined
            ? { visibleThickness: visibleArcThickness }
            : {})}
          onChange={onPlacementPropertiesChange}
        />
      )}
    </div>
  );
}

export { AuraOverlayPlacement };
