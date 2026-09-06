import type { CropRegion, OverlayPlacement, Profile } from "~/types";
import {
  type AuraOverlayScaleSnapContext,
  type AuraResizeCorner,
  type AuraVideoSize,
  resizeAuraPlacementFromCorner,
  resolveAuraPlacementBaseSize,
  resolveAuraPlacementScale,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

interface CreateAuraOverlayScaleSnapContextInput {
  crop: CropRegion;
  placement: OverlayPlacement;
  profile: Profile;
  referenceViewport: AuraVideoSize | null;
  targetViewport: AuraVideoSize;
}

interface ResizeAuraPlacementWithPeerScaleSnapInput {
  corner: AuraResizeCorner;
  crop: CropRegion;
  deltaX: number;
  deltaY: number;
  placement: OverlayPlacement;
  referenceViewport: AuraVideoSize | null;
  scaleSnapContext: AuraOverlayScaleSnapContext;
  targetViewport: AuraVideoSize;
}

const auraOverlayScaleSnapThresholdPixels = 5;

function createAuraOverlayScaleSnapContext({
  crop,
  placement,
  profile,
  referenceViewport,
  targetViewport,
}: CreateAuraOverlayScaleSnapContextInput): AuraOverlayScaleSnapContext {
  const cropIds = new Set(profile.cropRegions.map((item) => item.id));
  const baseSize = resolveAuraPlacementBaseSize(
    crop,
    placement,
    targetViewport,
    referenceViewport,
  );

  return {
    baseHeight: baseSize.height,
    baseWidth: baseSize.width,
    peerScales: profile.overlayPlacements.flatMap((peerPlacement) =>
      peerPlacement.id !== placement.id &&
      cropIds.has(peerPlacement.cropRegionId)
        ? [resolveAuraPlacementScale(peerPlacement)]
        : [],
    ),
  };
}

function resizeAuraPlacementWithPeerScaleSnap({
  corner,
  crop,
  deltaX,
  deltaY,
  placement,
  referenceViewport,
  scaleSnapContext,
  targetViewport,
}: ResizeAuraPlacementWithPeerScaleSnapInput): OverlayPlacement {
  const draftPlacement = resizeAuraPlacementFromCorner(
    crop,
    placement,
    corner,
    deltaX,
    deltaY,
    targetViewport,
    referenceViewport,
  );
  const draftScale = resolveAuraPlacementScale(draftPlacement);
  const peerScale = findClosestAuraOverlayPeerScale(
    scaleSnapContext.peerScales,
    draftScale,
    Math.max(scaleSnapContext.baseWidth, scaleSnapContext.baseHeight),
  );
  if (peerScale === null || peerScale === draftScale) {
    return draftPlacement;
  }

  const initialScale = resolveAuraPlacementScale(placement);
  const widthDelta = (peerScale - initialScale) * scaleSnapContext.baseWidth;
  const heightDelta = (peerScale - initialScale) * scaleSnapContext.baseHeight;

  return resizeAuraPlacementFromCorner(
    crop,
    placement,
    corner,
    corner.includes("w") ? -widthDelta : widthDelta,
    corner.includes("n") ? -heightDelta : heightDelta,
    targetViewport,
    referenceViewport,
  );
}

function findClosestAuraOverlayPeerScale(
  peerScales: number[],
  draftScale: number,
  largestBaseDimension: number,
): number | null {
  let closestScale: number | null = null;
  let closestDistance = auraOverlayScaleSnapThresholdPixels + 1;

  for (const scale of peerScales) {
    const distance = Math.abs(scale - draftScale) * largestBaseDimension;
    if (
      distance <= auraOverlayScaleSnapThresholdPixels &&
      distance < closestDistance
    ) {
      closestScale = scale;
      closestDistance = distance;
    }
  }

  return closestScale;
}

export {
  createAuraOverlayScaleSnapContext,
  resizeAuraPlacementWithPeerScaleSnap,
};
