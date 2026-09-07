import type { CropRegion, OverlayPlacement } from "~/types";
import type { AuraPlacementPropertiesPatch } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import {
  type AuraVideoSize,
  clamp,
  createAuraViewportProjection,
  isAuraPlacementQuarterTurn,
  resolveAuraPlacementDisplaySize,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementReferencePosition,
  resolveAuraPlacementVisualSize,
  resolveAuraReferenceViewport,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { isArchedCropRegion } from "../useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor.utils";
import {
  applyAppearancePlacementPatch,
  applyGeneralPlacementPatch,
  createDefaultPlacementProperties,
  resolveUpdatedCrop,
} from "./useAuraOverlayPlacementProperties.patch";

interface AuraPlacementPropertiesUpdate {
  crop: CropRegion;
  placement: OverlayPlacement;
}

const minimumDisplayDimension = 10;

function applyDisplaySizePatch(
  nextPlacement: OverlayPlacement,
  crop: CropRegion,
  patch: AuraPlacementPropertiesPatch,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null,
  initialVisualBounds:
    | ReturnType<typeof resolveAuraPlacementGeometry>["visualBounds"]
    | null,
): void {
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
}

function applyVisualPositionPatch(
  nextPlacement: OverlayPlacement,
  crop: CropRegion,
  patch: AuraPlacementPropertiesPatch,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null,
  initialVisualBounds: ReturnType<
    typeof resolveAuraPlacementGeometry
  >["visualBounds"],
  shouldPreserveVisualTopLeft: boolean,
): void {
  let nextVisualPosition = {
    x: initialVisualBounds.x,
    y: initialVisualBounds.y,
  };
  const shouldResolveNextVisualSize =
    !shouldPreserveVisualTopLeft ||
    patch.centerOffsetX !== undefined ||
    patch.centerOffsetY !== undefined;
  const nextVisualSize = shouldResolveNextVisualSize
    ? resolveAuraPlacementVisualSize(
        nextPlacement,
        resolveAuraPlacementDisplaySize(
          crop,
          nextPlacement,
          targetViewport,
          fallbackReferenceViewport,
        ),
      )
    : null;
  if (!shouldPreserveVisualTopLeft && nextVisualSize) {
    nextVisualPosition = {
      x:
        initialVisualBounds.x +
        (initialVisualBounds.width - nextVisualSize.width) / 2,
      y:
        initialVisualBounds.y +
        (initialVisualBounds.height - nextVisualSize.height) / 2,
    };
  }
  if (patch.centerOffsetX !== undefined) {
    const centerOffsetX = clamp(
      Math.round(patch.centerOffsetX),
      -100_000,
      100_000,
    );
    nextVisualPosition.x =
      targetViewport.width / 2 +
      centerOffsetX -
      (nextVisualSize?.width ?? initialVisualBounds.width) / 2;
  }
  if (patch.centerOffsetY !== undefined) {
    const centerOffsetY = clamp(
      Math.round(patch.centerOffsetY),
      -100_000,
      100_000,
    );
    nextVisualPosition.y =
      targetViewport.height / 2 -
      centerOffsetY -
      (nextVisualSize?.height ?? initialVisualBounds.height) / 2;
  }
  const referencePosition = resolveAuraPlacementReferencePosition(
    crop,
    nextPlacement,
    nextVisualPosition,
    targetViewport,
    fallbackReferenceViewport,
  );
  nextPlacement.x = Math.round(referencePosition.x);
  nextPlacement.y = Math.round(referencePosition.y);
}

function applyArcThicknessPatch(
  nextPlacement: OverlayPlacement,
  crop: CropRegion,
  patch: AuraPlacementPropertiesPatch,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null,
): void {
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
}

function createPlacementPropertiesUpdate(
  placement: OverlayPlacement,
  crop: CropRegion,
  patch: AuraPlacementPropertiesPatch,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null,
): AuraPlacementPropertiesUpdate {
  const nextPlacement = patch.resetToDefaults
    ? createDefaultPlacementProperties(placement, crop)
    : { ...placement };
  const shouldPreserveVisualPosition =
    patch.resetToDefaults === true ||
    patch.scale !== undefined ||
    patch.displayWidth !== undefined ||
    patch.displayHeight !== undefined ||
    patch.centerOffsetX !== undefined ||
    patch.centerOffsetY !== undefined ||
    patch.pointSampleSize !== undefined ||
    patch.pointGap !== undefined;
  const shouldPreserveVisualTopLeft =
    patch.displayWidth !== undefined || patch.displayHeight !== undefined;
  const initialVisualBounds = shouldPreserveVisualPosition
    ? resolveAuraPlacementGeometry(
        crop,
        placement,
        targetViewport,
        fallbackReferenceViewport,
      ).visualBounds
    : null;

  applyGeneralPlacementPatch(nextPlacement, crop, patch);
  applyAppearancePlacementPatch(nextPlacement, patch);
  applyDisplaySizePatch(
    nextPlacement,
    crop,
    patch,
    targetViewport,
    fallbackReferenceViewport,
    initialVisualBounds,
  );
  if (initialVisualBounds) {
    applyVisualPositionPatch(
      nextPlacement,
      crop,
      patch,
      targetViewport,
      fallbackReferenceViewport,
      initialVisualBounds,
      shouldPreserveVisualTopLeft,
    );
  }
  applyArcThicknessPatch(
    nextPlacement,
    crop,
    patch,
    targetViewport,
    fallbackReferenceViewport,
  );

  return {
    crop: resolveUpdatedCrop(crop, patch.label),
    placement: nextPlacement,
  };
}

export { createPlacementPropertiesUpdate };
