import {
  AuraPlacementScaleSettings,
  type CropRegion,
  createCoordinateReferenceDimensions,
  type OverlayPlacement,
} from "~/types";
import type {
  AuraResizeCorner,
  AuraSize,
  AuraVideoSize,
} from "../AuraOverlay.page.utils.types";
import { clamp } from "../clamp/clamp";
import { projectAuraPoint } from "../projectAuraPoint/projectAuraPoint";
import { resolveAuraPlacementBaseSize } from "../resolveAuraPlacementBaseSize/resolveAuraPlacementBaseSize";
import {
  resolveAuraPlacementContentPosition,
  resolveAuraPlacementVisualBounds,
  resolveAuraPlacementVisualSize,
} from "../resolveAuraPlacementDisplaySize/resolveAuraPlacementDisplaySize";
import { resolveAuraPlacementScale } from "../resolveAuraPlacementScale/resolveAuraPlacementScale";
import { resolveAuraReferenceViewport } from "../resolveAuraReferenceViewport/resolveAuraReferenceViewport";
import { unprojectAuraPoint } from "../unprojectAuraPoint/unprojectAuraPoint";

function resizeAuraPlacementFromCorner(
  crop: CropRegion,
  placement: OverlayPlacement,
  corner: AuraResizeCorner,
  deltaX: number,
  deltaY: number,
  targetViewport?: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null = null,
): OverlayPlacement {
  if (targetViewport) {
    return resizeProjectedAuraPlacementFromCorner(
      crop,
      placement,
      corner,
      deltaX,
      deltaY,
      targetViewport,
      fallbackReferenceViewport,
    );
  }

  const baseContentSize = {
    height:
      placement.width && placement.height ? placement.height : crop.height,
    width: placement.width && placement.height ? placement.width : crop.width,
  };
  const placementScale = resolveAuraPlacementScale(placement);
  const contentSize = scaleAuraSize(baseContentSize, placementScale);
  const visualBounds = resolveAuraPlacementVisualBounds(
    placement,
    placement,
    contentSize,
  );
  const scale = resolveResizedScale(
    placement,
    corner,
    deltaX,
    deltaY,
    baseContentSize,
    visualBounds,
  );
  const contentPosition = resolveResizedContentPosition(
    placement,
    corner,
    visualBounds,
    scaleAuraSize(baseContentSize, scale),
    { x: 0, y: 0 },
  );

  return {
    ...placement,
    scale,
    x: Math.round(contentPosition.x),
    y: Math.round(contentPosition.y),
  };
}

function resizeProjectedAuraPlacementFromCorner(
  crop: CropRegion,
  placement: OverlayPlacement,
  corner: AuraResizeCorner,
  deltaX: number,
  deltaY: number,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null,
): OverlayPlacement {
  const cropReferenceViewport = resolveAuraReferenceViewport(
    crop,
    fallbackReferenceViewport,
  );
  const placementReferenceViewport = resolveAuraReferenceViewport(
    placement,
    cropReferenceViewport,
  );
  const baseSize = resolveAuraPlacementBaseSize(
    crop,
    placement,
    targetViewport,
    fallbackReferenceViewport,
  );
  const projectedPlacement = projectAuraPoint(
    placement,
    placementReferenceViewport,
    targetViewport,
  );
  const placementScale = resolveAuraPlacementScale(placement);
  const contentSize = scaleAuraSize(baseSize, placementScale);
  const visualBounds = resolveAuraPlacementVisualBounds(
    placement,
    projectedPlacement,
    contentSize,
  );
  const scale = resolveResizedScale(
    placement,
    corner,
    deltaX,
    deltaY,
    baseSize,
    visualBounds,
  );
  const contentPosition = resolveResizedContentPosition(
    placement,
    corner,
    visualBounds,
    scaleAuraSize(baseSize, scale),
    projectAuraPoint(
      { x: 0, y: 0 },
      placementReferenceViewport,
      targetViewport,
    ),
  );
  const referencePoint = unprojectAuraPoint(
    contentPosition,
    placementReferenceViewport,
    targetViewport,
  );

  return {
    ...placement,
    ...createCoordinateReferenceDimensions(placementReferenceViewport),
    scale,
    x: Math.round(referencePoint.x),
    y: Math.round(referencePoint.y),
  };
}

function resolveResizedScale(
  placement: OverlayPlacement,
  corner: AuraResizeCorner,
  deltaX: number,
  deltaY: number,
  baseContentSize: AuraSize,
  visualBounds: AuraSize,
): number {
  const baseVisualSize = resolveAuraPlacementVisualSize(
    placement,
    baseContentSize,
  );
  const nextWidth = corner.includes("w")
    ? visualBounds.width - deltaX
    : visualBounds.width + deltaX;
  const nextHeight = corner.includes("n")
    ? visualBounds.height - deltaY
    : visualBounds.height + deltaY;
  const currentScale = resolveAuraPlacementScale(placement);
  const nextScaleX = nextWidth / baseVisualSize.width;
  const nextScaleY = nextHeight / baseVisualSize.height;
  const nextScale =
    Math.abs(nextScaleX - currentScale) > Math.abs(nextScaleY - currentScale)
      ? nextScaleX
      : nextScaleY;

  return clamp(
    Math.round(nextScale * 1_000) / 1_000,
    AuraPlacementScaleSettings.minScale,
    AuraPlacementScaleSettings.maxScale,
  );
}

function resolveResizedContentPosition(
  placement: OverlayPlacement,
  corner: AuraResizeCorner,
  visualBounds: { height: number; width: number; x: number; y: number },
  scaledContentSize: AuraSize,
  minimumVisualPosition: { x: number; y: number },
): { x: number; y: number } {
  const scaledVisualSize = resolveAuraPlacementVisualSize(
    placement,
    scaledContentSize,
  );
  const visualPosition = {
    x: Math.max(
      minimumVisualPosition.x,
      corner.includes("w")
        ? visualBounds.x + visualBounds.width - scaledVisualSize.width
        : visualBounds.x,
    ),
    y: Math.max(
      minimumVisualPosition.y,
      corner.includes("n")
        ? visualBounds.y + visualBounds.height - scaledVisualSize.height
        : visualBounds.y,
    ),
  };

  return resolveAuraPlacementContentPosition(
    placement,
    visualPosition,
    scaledContentSize,
  );
}

function scaleAuraSize(size: AuraSize, scale: number): AuraSize {
  return { height: size.height * scale, width: size.width * scale };
}

export { resizeAuraPlacementFromCorner };
