import type { Profile } from "~/types";
import {
  type AuraOverlaySnapContext,
  type AuraOverlaySnapGuide,
  type AuraSize,
  type AuraVideoSize,
  projectAuraOverlayPlacement,
  resolveAuraPlacementDisplaySize,
  resolveAuraReferenceViewport,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

interface CreateAuraOverlaySnapContextInput {
  fallbackReferenceViewport: AuraVideoSize | null;
  gridCellSize: AuraSize;
  guideViewport: AuraVideoSize;
  placementId: string;
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

function createAuraOverlaySnapContext({
  fallbackReferenceViewport,
  gridCellSize,
  guideViewport,
  placementId,
  profile,
  targetViewport,
}: CreateAuraOverlaySnapContextInput): AuraOverlaySnapContext | null {
  const selectedPlacement = profile.overlayPlacements.find(
    (placement) => placement.id === placementId,
  );
  const selectedCrop = profile.cropRegions.find(
    (crop) => crop.id === selectedPlacement?.cropRegionId,
  );
  if (!selectedPlacement || !selectedCrop) {
    return null;
  }

  const selectedDisplaySize = resolveAuraPlacementDisplaySize(
    selectedCrop,
    selectedPlacement,
    targetViewport,
    fallbackReferenceViewport,
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

    const crop = profile.cropRegions.find(
      (candidate) => candidate.id === placement.cropRegionId,
    );
    if (!crop) {
      continue;
    }

    const cropReferenceViewport = resolveAuraReferenceViewport(
      crop,
      fallbackReferenceViewport,
    );
    const projectedPlacement = projectAuraOverlayPlacement(
      placement,
      targetViewport,
      cropReferenceViewport,
    );
    const displaySize = resolveAuraPlacementDisplaySize(
      crop,
      placement,
      targetViewport,
      fallbackReferenceViewport,
    );
    xGuides.push(
      {
        anchor: "start",
        kind: "placement",
        position: projectedPlacement.x,
      },
      {
        anchor: "center",
        kind: "placement",
        position: projectedPlacement.x + displaySize.width / 2,
      },
      {
        anchor: "end",
        kind: "placement",
        position: projectedPlacement.x + displaySize.width,
      },
    );
    yGuides.push(
      {
        anchor: "start",
        kind: "placement",
        position: projectedPlacement.y,
      },
      {
        anchor: "center",
        kind: "placement",
        position: projectedPlacement.y + displaySize.height / 2,
      },
      {
        anchor: "end",
        kind: "placement",
        position: projectedPlacement.y + displaySize.height,
      },
    );
  }

  return {
    displayHeight: selectedDisplaySize.height,
    displayWidth: selectedDisplaySize.width,
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

export { createAuraOverlaySnapContext, resolveAuraOverlayDragSnap };
