import {
  AuraLabelSettings,
  AuraPlacementClipShapeSchema,
  AuraPlacementContentZoomSettings,
  AuraPlacementEffectColorSchema,
  AuraPlacementEffectSettings,
  AuraPlacementScaleSettings,
  AuraPointPlacementSettings,
  type CropRegion,
  type OverlayPlacement,
} from "~/types";
import type { AuraPlacementPropertiesPatch } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";
import { clamp } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import { isArchedCropRegion } from "../useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor.utils";

function createDefaultPlacementProperties(
  placement: OverlayPlacement,
  crop: CropRegion,
): OverlayPlacement {
  return {
    cropRegionId: placement.cropRegionId,
    id: placement.id,
    opacity: 1,
    scale: 1,
    x: placement.x,
    y: placement.y,
    ...(placement.referenceWidth !== undefined &&
    placement.referenceHeight !== undefined
      ? {
          referenceHeight: placement.referenceHeight,
          referenceWidth: placement.referenceWidth,
        }
      : {}),
    ...(crop.shape === "points"
      ? {
          pointGap: AuraPointPlacementSettings.defaultGap,
          pointSampleSize: AuraPointPlacementSettings.defaultSampleSize,
        }
      : {}),
  };
}

function resolveUpdatedCrop(
  crop: CropRegion,
  labelPatch: string | undefined,
): CropRegion {
  if (labelPatch === undefined) {
    return crop;
  }

  const label = labelPatch.trim().slice(0, AuraLabelSettings.maxLength);
  return label.length > 0 ? { ...crop, label } : crop;
}

function applyGeneralPlacementPatch(
  nextPlacement: OverlayPlacement,
  crop: CropRegion,
  patch: AuraPlacementPropertiesPatch,
): void {
  if (crop.shape !== "arc") {
    delete nextPlacement.arcStraightened;
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

  if (patch.contentZoomPercent !== undefined) {
    const contentZoomPercent = clamp(
      Math.round(patch.contentZoomPercent),
      AuraPlacementContentZoomSettings.minPercent,
      AuraPlacementContentZoomSettings.maxPercent,
    );
    if (
      contentZoomPercent === AuraPlacementContentZoomSettings.defaultPercent
    ) {
      delete nextPlacement.contentZoomPercent;
    } else {
      nextPlacement.contentZoomPercent = contentZoomPercent;
    }
  }

  if (patch.hideResizeControls !== undefined) {
    nextPlacement.hideResizeControls = patch.hideResizeControls;
  }

  if (patch.iconOffsetX !== undefined) {
    const iconOffsetX = clamp(Math.round(patch.iconOffsetX), -100_000, 100_000);
    if (iconOffsetX === 0) {
      delete nextPlacement.iconOffsetX;
    } else {
      nextPlacement.iconOffsetX = iconOffsetX;
    }
  }

  if (patch.iconOffsetY !== undefined) {
    const iconOffsetY = clamp(Math.round(patch.iconOffsetY), -100_000, 100_000);
    if (iconOffsetY === 0) {
      delete nextPlacement.iconOffsetY;
    } else {
      nextPlacement.iconOffsetY = iconOffsetY;
    }
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
}

function applyAppearancePlacementPatch(
  nextPlacement: OverlayPlacement,
  patch: AuraPlacementPropertiesPatch,
): void {
  if (patch.cornerRadius !== undefined) {
    if (patch.cornerRadius === null) {
      delete nextPlacement.cornerRadius;
    } else {
      nextPlacement.cornerRadius = clamp(
        Math.round(patch.cornerRadius),
        AuraPlacementEffectSettings.minCornerRadius,
        AuraPlacementEffectSettings.maxCornerRadius,
      );
    }
  }

  if (patch.clipShape !== undefined) {
    if (patch.clipShape === null) {
      delete nextPlacement.clipShape;
    } else {
      const clipShape = AuraPlacementClipShapeSchema.safeParse(patch.clipShape);
      if (clipShape.success) {
        nextPlacement.clipShape = clipShape.data;
      }
    }
  }

  if (patch.outlineColor !== undefined) {
    if (patch.outlineColor === null) {
      delete nextPlacement.outlineColor;
    } else {
      const outlineColor = AuraPlacementEffectColorSchema.safeParse(
        patch.outlineColor,
      );
      if (outlineColor.success) {
        nextPlacement.outlineColor = outlineColor.data;
      }
    }
  }

  if (patch.outlineThickness !== undefined) {
    if (patch.outlineThickness === null) {
      delete nextPlacement.outlineColor;
      delete nextPlacement.outlineThickness;
    } else {
      nextPlacement.outlineThickness = clamp(
        Math.round(patch.outlineThickness),
        AuraPlacementEffectSettings.minOutlineThickness,
        AuraPlacementEffectSettings.maxOutlineThickness,
      );
    }
  }

  if (patch.shadowColor !== undefined) {
    if (patch.shadowColor === null) {
      delete nextPlacement.shadowColor;
    } else {
      const shadowColor = AuraPlacementEffectColorSchema.safeParse(
        patch.shadowColor,
      );
      if (shadowColor.success) {
        nextPlacement.shadowColor = shadowColor.data;
      }
    }
  }

  if (patch.shadowSpread !== undefined) {
    if (patch.shadowSpread === null) {
      delete nextPlacement.shadowColor;
      delete nextPlacement.shadowSpread;
    } else {
      nextPlacement.shadowSpread = clamp(
        Math.round(patch.shadowSpread),
        AuraPlacementEffectSettings.minShadowSpread,
        AuraPlacementEffectSettings.maxShadowSpread,
      );
    }
  }
}

export {
  applyAppearancePlacementPatch,
  applyGeneralPlacementPatch,
  createDefaultPlacementProperties,
  resolveUpdatedCrop,
};
