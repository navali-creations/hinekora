import type { Profile } from "~/types";
import {
  type AuraOverlaySnapContext,
  type AuraOverlaySnapGuide,
  type AuraSize,
  type AuraVideoSize,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementVisualSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

interface CreateAuraOverlaySnapContextInput {
  fallbackReferenceViewport: AuraVideoSize | null;
  gridCellSize: AuraSize;
  guideViewport: AuraVideoSize;
  placementId: string;
  profile: Profile;
  targetViewport: AuraVideoSize;
}

interface CreateAuraOverlayDragInitialPositionsInput {
  fallbackReferenceViewport: AuraVideoSize | null;
  placementIds: readonly string[];
  profile: Profile;
  targetViewport: AuraVideoSize;
}

interface ResolveAuraOverlayDragSnapInput {
  rawX: number;
  rawY: number;
  snapContext: AuraOverlaySnapContext;
}

interface AuraOverlayDragSnapResult {
  guideX: AuraOverlaySnapGuide | null;
  guideY: AuraOverlaySnapGuide | null;
  x: number;
  y: number;
}

const auraOverlayGuideSnapThreshold = 5;

function createAuraOverlayDragInitialPositions({
  fallbackReferenceViewport,
  placementIds,
  profile,
  targetViewport,
}: CreateAuraOverlayDragInitialPositionsInput): Record<
  string,
  { x: number; y: number }
> {
  const selectedIds = new Set(placementIds);
  const crops = new Map(profile.cropRegions.map((crop) => [crop.id, crop]));
  const positions: Record<string, { x: number; y: number }> = {};

  for (const placement of profile.overlayPlacements) {
    const crop = crops.get(placement.cropRegionId);
    if (!selectedIds.has(placement.id) || !crop) {
      continue;
    }

    const { visualBounds } = resolveAuraPlacementGeometry(
      crop,
      placement,
      targetViewport,
      fallbackReferenceViewport,
    );
    positions[placement.id] = { x: visualBounds.x, y: visualBounds.y };
  }

  return positions;
}

function createAuraOverlaySnapContext({
  fallbackReferenceViewport,
  gridCellSize,
  guideViewport,
  placementId,
  profile,
  targetViewport,
}: CreateAuraOverlaySnapContextInput): AuraOverlaySnapContext | null {
  const cropRegionsById = new Map(
    profile.cropRegions.map((crop) => [crop.id, crop] as const),
  );
  const selectedPlacement = profile.overlayPlacements.find(
    (placement) => placement.id === placementId,
  );
  const selectedCrop = selectedPlacement
    ? cropRegionsById.get(selectedPlacement.cropRegionId)
    : undefined;
  if (!selectedPlacement || !selectedCrop) {
    return null;
  }

  const { contentSize: selectedDisplaySize } = resolveAuraPlacementGeometry(
    selectedCrop,
    selectedPlacement,
    targetViewport,
    fallbackReferenceViewport,
  );
  const selectedVisualSize = resolveAuraPlacementVisualSize(
    selectedPlacement,
    selectedDisplaySize,
  );
  const xGuides: AuraOverlaySnapGuide[] = [
    {
      anchor: "center",
      kind: "viewport-center",
      position: guideViewport.width / 2,
    },
  ];
  const yGuides: AuraOverlaySnapGuide[] = [
    {
      anchor: "center",
      kind: "viewport-center",
      position: guideViewport.height / 2,
    },
  ];

  for (const placement of profile.overlayPlacements) {
    if (placement.id === placementId) {
      continue;
    }

    const crop = cropRegionsById.get(placement.cropRegionId);
    if (!crop) {
      continue;
    }

    const { visualBounds } = resolveAuraPlacementGeometry(
      crop,
      placement,
      targetViewport,
      fallbackReferenceViewport,
    );
    xGuides.push(
      {
        anchor: "start",
        kind: "placement",
        position: visualBounds.x,
      },
      {
        anchor: "center",
        kind: "placement",
        position: visualBounds.x + visualBounds.width / 2,
      },
      {
        anchor: "end",
        kind: "placement",
        position: visualBounds.x + visualBounds.width,
      },
    );
    yGuides.push(
      {
        anchor: "start",
        kind: "placement",
        position: visualBounds.y,
      },
      {
        anchor: "center",
        kind: "placement",
        position: visualBounds.y + visualBounds.height / 2,
      },
      {
        anchor: "end",
        kind: "placement",
        position: visualBounds.y + visualBounds.height,
      },
    );
  }

  return {
    displayHeight: selectedVisualSize.height,
    displayWidth: selectedVisualSize.width,
    gridCellHeight: gridCellSize.height,
    gridCellWidth: gridCellSize.width,
    xGuides,
    yGuides,
  };
}

function resolveAuraOverlayDragSnap({
  rawX,
  rawY,
  snapContext,
}: ResolveAuraOverlayDragSnapInput): AuraOverlayDragSnapResult {
  const guideX = findClosestAuraOverlayGuide(
    snapContext.xGuides,
    rawX,
    snapContext.displayWidth,
  );
  const guideY = findClosestAuraOverlayGuide(
    snapContext.yGuides,
    rawY,
    snapContext.displayHeight,
  );

  return {
    guideX,
    guideY,
    x: guideX
      ? guideX.position -
        resolveAuraOverlaySnapAnchorOffset(guideX, snapContext.displayWidth)
      : snapAuraOverlayCoordinateToGrid(rawX, snapContext.gridCellWidth),
    y: guideY
      ? guideY.position -
        resolveAuraOverlaySnapAnchorOffset(guideY, snapContext.displayHeight)
      : snapAuraOverlayCoordinateToGrid(rawY, snapContext.gridCellHeight),
  };
}

function findClosestAuraOverlayGuide(
  guides: AuraOverlaySnapGuide[],
  start: number,
  size: number,
): AuraOverlaySnapGuide | null {
  let closestGuide: AuraOverlaySnapGuide | null = null;
  let closestDistance = auraOverlayGuideSnapThreshold + 1;

  for (const guide of guides) {
    const anchorPosition =
      start + resolveAuraOverlaySnapAnchorOffset(guide, size);
    const distance = Math.abs(guide.position - anchorPosition);
    if (
      distance <= auraOverlayGuideSnapThreshold &&
      distance < closestDistance
    ) {
      closestGuide = guide;
      closestDistance = distance;
    }
  }

  return closestGuide;
}

function resolveAuraOverlaySnapAnchorOffset(
  guide: AuraOverlaySnapGuide,
  size: number,
): number {
  if (guide.anchor === "center") {
    return size / 2;
  }

  return guide.anchor === "end" ? size : 0;
}

function snapAuraOverlayCoordinateToGrid(
  coordinate: number,
  gridCellSize: number,
): number {
  return Math.round(coordinate / gridCellSize) * gridCellSize;
}

export {
  createAuraOverlayDragInitialPositions,
  createAuraOverlaySnapContext,
  resolveAuraOverlayDragSnap,
};
