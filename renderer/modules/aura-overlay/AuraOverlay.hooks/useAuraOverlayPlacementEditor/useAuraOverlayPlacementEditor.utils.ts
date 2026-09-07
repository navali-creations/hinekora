import {
  type CropRegion,
  createCoordinateReferenceDimensions,
  type OverlayPlacement,
} from "~/types";
import {
  type AuraVideoSize,
  clamp,
  resolveAuraPlacementContentDelta,
  resolveAuraReferenceViewport,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createArcControlNormal } from "../../AuraOverlay.utils/AuraOverlay.utils";

function createReferenceDimensionsForPlacement(
  crop: CropRegion | undefined,
  placement: OverlayPlacement,
  fallbackReferenceViewport: AuraVideoSize | null,
): Pick<CropRegion, "referenceHeight" | "referenceWidth"> {
  return createCoordinateReferenceDimensions(
    resolveAuraReferenceViewport(
      placement,
      resolveAuraReferenceViewport(crop, fallbackReferenceViewport),
    ),
  );
}

function isArchedCropRegion(
  crop: CropRegion | null | undefined,
): crop is CropRegion & { arc: NonNullable<CropRegion["arc"]> } {
  return crop?.shape === "arc" && !!crop.arc;
}

function resizeArchedPlacementThickness(
  crop: CropRegion,
  placement: OverlayPlacement,
  initialDisplayThickness: number,
  maxDisplayThickness: number,
  deltaX: number,
  deltaY: number,
): number {
  if (!isArchedCropRegion(crop)) {
    return initialDisplayThickness;
  }

  const contentDelta = resolveAuraPlacementContentDelta(placement, {
    x: deltaX,
    y: deltaY,
  });
  const delta = getArchedCropThicknessDelta(
    crop,
    contentDelta.x,
    contentDelta.y,
  );
  return clamp(
    Math.round(initialDisplayThickness + delta),
    1,
    maxDisplayThickness,
  );
}

function getArchedCropThicknessDelta(
  crop: CropRegion & { arc: NonNullable<CropRegion["arc"]> },
  deltaX: number,
  deltaY: number,
): number {
  const start = { x: crop.arc.startX, y: crop.arc.startY };
  const end = { x: crop.arc.endX, y: crop.arc.endY };
  const control = { x: crop.arc.controlX, y: crop.arc.controlY };
  const normal = createArcControlNormal(start, end, control);

  return deltaX * normal.x + deltaY * normal.y;
}

export {
  createReferenceDimensionsForPlacement,
  isArchedCropRegion,
  resizeArchedPlacementThickness,
};
