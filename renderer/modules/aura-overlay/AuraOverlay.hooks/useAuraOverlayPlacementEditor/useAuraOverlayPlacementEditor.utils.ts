import {
  type CropRegion,
  createCoordinateReferenceDimensions,
  type OverlayPlacement,
} from "~/types";
import type { AuraPlacementPropertiesPatch } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import {
  type AuraVideoSize,
  createAuraViewportProjection,
  resolveAuraPlacementDisplaySize,
  resolveAuraReferenceViewport,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createArcControlNormal } from "../../AuraOverlay.utils/AuraOverlay.utils";

interface AuraPlacementPropertiesUpdate {
  crop: CropRegion;
  placement: OverlayPlacement;
}

function createPlacementPropertiesUpdate(
  placement: OverlayPlacement,
  crop: CropRegion,
  patch: AuraPlacementPropertiesPatch,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null,
): AuraPlacementPropertiesUpdate {
  const nextPlacement: OverlayPlacement = { ...placement };
  const nextCrop = crop;
  if (patch.scale !== undefined) {
    nextPlacement.scale = clamp(Math.round(patch.scale * 100) / 100, 0.1, 8);
  }

  if (patch.mirrored !== undefined) {
    nextPlacement.mirrored = patch.mirrored;
  }

  if (patch.rotationDegrees !== undefined) {
    nextPlacement.rotationDegrees = patch.rotationDegrees;
  }

  if (patch.arcStraightened !== undefined) {
    nextPlacement.arcStraightened = patch.arcStraightened;
  }

  if (patch.displayWidth !== undefined || patch.displayHeight !== undefined) {
    const displaySize = resolveAuraPlacementDisplaySize(
      crop,
      nextPlacement,
      targetViewport,
      fallbackReferenceViewport,
    );
    const referenceViewport = resolveAuraReferenceViewport(
      nextPlacement,
      resolveAuraReferenceViewport(crop, fallbackReferenceViewport),
    );
    const projection = createAuraViewportProjection(
      referenceViewport,
      targetViewport,
    );
    const scale = nextPlacement.scale || 1;

    nextPlacement.width = clamp(
      Math.round(
        (patch.displayWidth ?? displaySize.width) / scale / projection.scale,
      ),
      1,
      100_000,
    );
    nextPlacement.height = clamp(
      Math.round(
        (patch.displayHeight ?? displaySize.height) / scale / projection.scale,
      ),
      1,
      100_000,
    );
  }

  if (isArchedCropRegion(crop) && patch.arcVisibleThickness !== undefined) {
    const placementDisplaySize = resolveAuraPlacementDisplaySize(
      crop,
      nextPlacement,
      targetViewport,
      fallbackReferenceViewport,
    );

    nextPlacement.arcVisibleThickness = clamp(
      Math.round(patch.arcVisibleThickness),
      1,
      Math.max(placementDisplaySize.width, placementDisplaySize.height),
    );
  }

  return { crop: nextCrop, placement: nextPlacement };
}

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
  initialDisplayThickness: number,
  maxDisplayThickness: number,
  deltaX: number,
  deltaY: number,
): number {
  if (!isArchedCropRegion(crop)) {
    return initialDisplayThickness;
  }

  const delta = getArchedCropThicknessDelta(crop, deltaX, deltaY);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export {
  createPlacementPropertiesUpdate,
  createReferenceDimensionsForPlacement,
  isArchedCropRegion,
  resizeArchedPlacementThickness,
};
