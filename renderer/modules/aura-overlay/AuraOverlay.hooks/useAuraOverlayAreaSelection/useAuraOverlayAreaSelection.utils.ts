import type { Profile } from "~/types";
import {
  type AuraVideoSize,
  resolveAuraPlacementGeometry,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

interface AuraOverlayAreaSelectionBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface AuraOverlayAreaSelectionPoint {
  x: number;
  y: number;
}

interface FindAuraPlacementsInAreaInput {
  bounds: AuraOverlayAreaSelectionBounds;
  profile: Profile;
  referenceViewport: AuraVideoSize | null;
  targetViewport: AuraVideoSize;
}

const minimumAuraAreaSelectionSize = 4;

function createAuraOverlayAreaSelectionBounds(
  start: AuraOverlayAreaSelectionPoint,
  end: AuraOverlayAreaSelectionPoint,
): AuraOverlayAreaSelectionBounds {
  return {
    height: Math.abs(end.y - start.y),
    width: Math.abs(end.x - start.x),
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
  };
}

function findAuraPlacementsInArea({
  bounds,
  profile,
  referenceViewport,
  targetViewport,
}: FindAuraPlacementsInAreaInput): string[] {
  const cropRegionsById = new Map(
    profile.cropRegions.map((crop) => [crop.id, crop] as const),
  );

  return profile.overlayPlacements.flatMap((placement) => {
    const crop = cropRegionsById.get(placement.cropRegionId);
    if (!crop) {
      return [];
    }

    const { visualBounds } = resolveAuraPlacementGeometry(
      crop,
      placement,
      targetViewport,
      referenceViewport,
    );

    return rectanglesIntersect(bounds, visualBounds) ? [placement.id] : [];
  });
}

function isUsableAuraAreaSelection(
  bounds: AuraOverlayAreaSelectionBounds,
): boolean {
  return (
    bounds.width >= minimumAuraAreaSelectionSize &&
    bounds.height >= minimumAuraAreaSelectionSize
  );
}

function rectanglesIntersect(
  first: AuraOverlayAreaSelectionBounds,
  second: AuraOverlayAreaSelectionBounds,
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export type { AuraOverlayAreaSelectionBounds, AuraOverlayAreaSelectionPoint };
export {
  createAuraOverlayAreaSelectionBounds,
  findAuraPlacementsInArea,
  isUsableAuraAreaSelection,
};
