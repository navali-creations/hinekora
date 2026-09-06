import {
  AuraPlacementScaleSettings,
  type CropRegion,
  createCoordinateReferenceDimensions,
  type OverlayPlacement,
} from "~/types";
import type {
  AuraResizeCorner,
  AuraVideoSize,
} from "../AuraOverlay.page.utils.types";
import { clamp } from "../clamp/clamp";
import { projectAuraPoint } from "../projectAuraPoint/projectAuraPoint";
import { resolveAuraPlacementBaseSize } from "../resolveAuraPlacementBaseSize/resolveAuraPlacementBaseSize";
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

  const placementScale = resolveAuraPlacementScale(placement);
  const baseWidth =
    placement.width && placement.height ? placement.width : crop.width;
  const baseHeight =
    placement.width && placement.height ? placement.height : crop.height;
  const width = baseWidth * placementScale;
  const height = baseHeight * placementScale;
  const nextWidth = corner.includes("w") ? width - deltaX : width + deltaX;
  const nextHeight = corner.includes("n") ? height - deltaY : height + deltaY;
  const nextScaleX = nextWidth / baseWidth;
  const nextScaleY = nextHeight / baseHeight;
  const nextScale =
    Math.abs(nextScaleX - placementScale) >
    Math.abs(nextScaleY - placementScale)
      ? nextScaleX
      : nextScaleY;
  const scale = clamp(
    Math.round(nextScale * 1_000) / 1_000,
    AuraPlacementScaleSettings.minScale,
    AuraPlacementScaleSettings.maxScale,
  );
  const scaledWidth = baseWidth * scale;
  const scaledHeight = baseHeight * scale;

  return {
    ...placement,
    scale,
    x: corner.includes("w")
      ? Math.max(0, Math.round(placement.x + width - scaledWidth))
      : placement.x,
    y: corner.includes("n")
      ? Math.max(0, Math.round(placement.y + height - scaledHeight))
      : placement.y,
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
  const width = baseSize.width * placementScale;
  const height = baseSize.height * placementScale;
  const nextWidth = corner.includes("w") ? width - deltaX : width + deltaX;
  const nextHeight = corner.includes("n") ? height - deltaY : height + deltaY;
  const nextScaleX = nextWidth / baseSize.width;
  const nextScaleY = nextHeight / baseSize.height;
  const nextScale =
    Math.abs(nextScaleX - placementScale) >
    Math.abs(nextScaleY - placementScale)
      ? nextScaleX
      : nextScaleY;
  const scale = clamp(
    Math.round(nextScale * 1_000) / 1_000,
    AuraPlacementScaleSettings.minScale,
    AuraPlacementScaleSettings.maxScale,
  );
  const scaledWidth = baseSize.width * scale;
  const scaledHeight = baseSize.height * scale;
  const x = corner.includes("w")
    ? projectedPlacement.x + width - scaledWidth
    : projectedPlacement.x;
  const y = corner.includes("n")
    ? projectedPlacement.y + height - scaledHeight
    : projectedPlacement.y;
  const referencePoint = unprojectAuraPoint(
    {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
    },
    placementReferenceViewport,
    targetViewport,
  );

  return {
    ...placement,
    ...createCoordinateReferenceDimensions(placementReferenceViewport),
    scale,
    x: corner.includes("w")
      ? Math.max(0, Math.round(referencePoint.x))
      : placement.x,
    y: corner.includes("n")
      ? Math.max(0, Math.round(referencePoint.y))
      : placement.y,
  };
}

export { resizeAuraPlacementFromCorner };
