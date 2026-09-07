import clsx from "clsx";

import { useAuraOverlayShallow } from "~/renderer/store";

import {
  createAuraArcBoundaryPaths,
  resolveAuraPlacementArcVisibleThickness,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementVisualPoint,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { AuraArcThicknessHandle } from "../AuraArcThicknessHandle/AuraArcThicknessHandle";
import { AuraOverlayPlacementDetails } from "../AuraOverlayPlacementDetails/AuraOverlayPlacementDetails";
import { AuraOverlayPlacementGuides } from "../AuraOverlayPlacementGuides/AuraOverlayPlacementGuides";
import { AuraOverlayPlacementVideo } from "../AuraOverlayPlacementVideo/AuraOverlayPlacementVideo";
import { AuraOverlayResizeHandles } from "../AuraOverlayResizeHandles/AuraOverlayResizeHandles";
import { AuraPlacementEffects } from "../AuraPlacementEffects/AuraPlacementEffects";
import styles from "./AuraOverlayPlacement.module.css";
import {
  type AuraOverlayPlacementProps,
  createPlacementContentStyle,
  resolveAuraPlacementClipPath,
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
  const { isAreaSelected, isSelected } = useAuraOverlayShallow(
    (auraOverlay) => ({
      isAreaSelected:
        auraOverlay.areaSelection?.placementIds.includes(placement.id) ?? false,
      isSelected: auraOverlay.selectedPlacementId === placement.id,
    }),
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
    dragState?.placementId === placement.id ||
    dragState?.placementIds?.includes(placement.id)
      ? dragState
      : null;
  const initialDragPosition = currentDragState
    ? (currentDragState.initialDisplayPositions?.[placement.id] ?? {
        x: currentDragState.initialDisplayX,
        y: currentDragState.initialDisplayY,
      })
    : null;
  const x = initialDragPosition
    ? initialDragPosition.x + (currentDragState?.deltaX ?? 0)
    : visualBounds.x;
  const y = initialDragPosition
    ? initialDragPosition.y + (currentDragState?.deltaY ?? 0)
    : visualBounds.y;
  const isResizing = currentResizeState !== null;
  const displayWidth = Math.round(visualBounds.width);
  const displayHeight = Math.round(visualBounds.height);
  const width = displayWidth;
  const height = displayHeight;
  const left = Math.round(x);
  const top = Math.round(y);
  const centerOffsetX =
    x + visualBounds.width / 2 - effectiveVideoSize.width / 2;
  const centerOffsetY =
    effectiveVideoSize.height / 2 - (y + visualBounds.height / 2);
  const visibleArcThickness = resolveAuraPlacementArcVisibleThickness(
    crop,
    effectivePlacement,
    placementSize,
  );
  const contentStyle = createPlacementContentStyle(
    effectivePlacement,
    placementSize,
  );
  const supportsClipShapes = crop.shape === undefined || crop.shape === "rect";
  const placementClipPath = supportsClipShapes
    ? resolveAuraPlacementClipPath(effectivePlacement.clipShape)
    : undefined;
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
      <AuraPlacementEffects
        contentStyle={contentStyle}
        crop={crop}
        displaySize={placementSize}
        isStraightenedArc={isStraightenedArc}
        placement={effectivePlacement}
        {...(visibleArcThickness !== undefined
          ? { visibleThickness: visibleArcThickness }
          : {})}
      />
      <button
        className={clsx(
          styles.box,
          crop.shape === "arc" && styles.boxArc,
          placementClipPath && styles.boxCustomShape,
          auraOverlayLocked && styles.boxLocked,
          canEditAuras && (isSelected || isAreaSelected) && styles.boxSelected,
        )}
        data-placement-id={placement.id}
        style={{
          ...(effectivePlacement.cornerRadius !== undefined
            ? { borderRadius: `${effectivePlacement.cornerRadius}px` }
            : {}),
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
        <AuraOverlayPlacementGuides
          arcBoundaryPaths={arcBoundaryPaths}
          clipShape={effectivePlacement.clipShape}
          contentStyle={contentStyle}
          displaySize={placementSize}
          showShapeFocus={canEditAuras && isSelected && !!placementClipPath}
        />
        {canEditAuras &&
          !isAreaSelected &&
          !effectivePlacement.hideResizeControls && (
            <AuraOverlayResizeHandles
              compact={crop.shape === "points"}
              placementId={placement.id}
              onPointerCancel={onResizePointerCancel}
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
            />
          )}
        {canEditAuras &&
          !isAreaSelected &&
          !effectivePlacement.hideResizeControls &&
          arcControlPoint && (
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
      <AuraOverlayPlacementDetails
        auraOverlayLocked={auraOverlayLocked}
        canEditAuras={canEditAuras}
        centerOffsetX={centerOffsetX}
        centerOffsetY={centerOffsetY}
        crop={crop}
        displayHeight={height}
        displayWidth={width}
        isResizing={isResizing}
        isSelected={isSelected}
        isThicknessResizing={currentThicknessResizeState !== null}
        left={left}
        placement={effectivePlacement}
        showClipShapeControls={supportsClipShapes}
        top={top}
        visibleThickness={visibleArcThickness}
        onChange={onPlacementPropertiesChange}
      />
    </div>
  );
}

export { AuraOverlayPlacement };
