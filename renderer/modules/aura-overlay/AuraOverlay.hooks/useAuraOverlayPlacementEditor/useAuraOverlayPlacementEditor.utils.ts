import {
  AuraLabelSettings,
  AuraPlacementScaleSettings,
  AuraPointPlacementSettings,
  type CropRegion,
  createCoordinateReferenceDimensions,
  type OverlayPlacement,
} from "~/types";
import type { AuraPlacementPropertiesPatch } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import {
  type AuraVideoSize,
  createAuraViewportProjection,
  isAuraPlacementQuarterTurn,
  resolveAuraPlacementContentDelta,
  resolveAuraPlacementDisplaySize,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementReferencePosition,
  resolveAuraReferenceViewport,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { createArcControlNormal } from "../../AuraOverlay.utils/AuraOverlay.utils";

interface AuraPlacementPropertiesUpdate {
  crop: CropRegion;
  placement: OverlayPlacement;
}

const minimumDisplayDimension = 10;

function createPlacementPropertiesUpdate(
  placement: OverlayPlacement,
  crop: CropRegion,
  patch: AuraPlacementPropertiesPatch,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null,
): AuraPlacementPropertiesUpdate {
  const nextPlacement: OverlayPlacement = { ...placement };
  const shouldPreserveVisualPosition =
    patch.scale !== undefined ||
    patch.displayWidth !== undefined ||
    patch.displayHeight !== undefined ||
    patch.pointSampleSize !== undefined ||
    patch.pointGap !== undefined;
  const initialVisualBounds = shouldPreserveVisualPosition
    ? resolveAuraPlacementGeometry(
        crop,
        placement,
        targetViewport,
        fallbackReferenceViewport,
      ).visualBounds
    : null;
  let nextCrop = crop;
  if (crop.shape !== "arc") {
    delete nextPlacement.arcStraightened;
  }

  if (patch.label !== undefined) {
    const label = patch.label.trim().slice(0, AuraLabelSettings.maxLength);
    if (label.length > 0) {
      nextCrop = { ...nextCrop, label };
    }
  }

  if (patch.scale !== undefined) {
    nextPlacement.scale = clamp(
      Math.round(patch.scale * 100) / 100,
      AuraPlacementScaleSettings.minScale,
      AuraPlacementScaleSettings.maxScale,
    );
  }

  if (patch.opacity !== undefined) {
    nextPlacement.opacity = clamp(Math.round(patch.opacity * 100) / 100, 0, 1);
  }

  if (patch.mirrored !== undefined) {
    nextPlacement.mirrored = patch.mirrored;
  }

  if (patch.rotationDegrees !== undefined) {
    nextPlacement.rotationDegrees = patch.rotationDegrees;
  }

  if (isArchedCropRegion(crop) && patch.arcStraightened !== undefined) {
    nextPlacement.arcStraightened = patch.arcStraightened;
  }

  if (patch.pointSampleSize !== undefined) {
    nextPlacement.pointSampleSize = clamp(
      Math.round(patch.pointSampleSize),
      AuraPointPlacementSettings.minSampleSize,
      AuraPointPlacementSettings.maxSampleSize,
    );
  }

  if (patch.pointGap !== undefined) {
    nextPlacement.pointGap = clamp(
      Math.round(patch.pointGap),
      AuraPointPlacementSettings.minGap,
      AuraPointPlacementSettings.maxGap,
    );
  }

  if (patch.displayWidth !== undefined || patch.displayHeight !== undefined) {
    const referenceViewport = resolveAuraReferenceViewport(
      nextPlacement,
      resolveAuraReferenceViewport(crop, fallbackReferenceViewport),
    );
    const projection = createAuraViewportProjection(
      referenceViewport,
      targetViewport,
    );
    const scale = nextPlacement.scale || 1;
    const visualWidth =
      patch.displayWidth ??
      initialVisualBounds?.width ??
      minimumDisplayDimension;
    const visualHeight =
      patch.displayHeight ??
      initialVisualBounds?.height ??
      minimumDisplayDimension;
    const contentWidth = isAuraPlacementQuarterTurn(nextPlacement)
      ? visualHeight
      : visualWidth;
    const contentHeight = isAuraPlacementQuarterTurn(nextPlacement)
      ? visualWidth
      : visualHeight;

    nextPlacement.width = clamp(
      Math.round(contentWidth / scale / projection.scale),
      minimumDisplayDimension,
      100_000,
    );
    nextPlacement.height = clamp(
      Math.round(contentHeight / scale / projection.scale),
      minimumDisplayDimension,
      100_000,
    );
  }

  if (initialVisualBounds) {
    const referencePosition = resolveAuraPlacementReferencePosition(
      crop,
      nextPlacement,
      { x: initialVisualBounds.x, y: initialVisualBounds.y },
      targetViewport,
      fallbackReferenceViewport,
    );
    nextPlacement.x = Math.round(referencePosition.x);
    nextPlacement.y = Math.round(referencePosition.y);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export {
  createPlacementPropertiesUpdate,
  createReferenceDimensionsForPlacement,
  isArchedCropRegion,
  resizeArchedPlacementThickness,
};
