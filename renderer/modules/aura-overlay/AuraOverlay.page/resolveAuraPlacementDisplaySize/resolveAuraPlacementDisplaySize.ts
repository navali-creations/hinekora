import {
  AuraPointPlacementSettings,
  type CropRegion,
  type OverlayPlacement,
} from "~/types";
import type {
  AuraPoint,
  AuraProjectedBox,
  AuraSize,
  AuraVideoSize,
} from "../AuraOverlay.page.utils.types";
import { projectAuraOverlayPlacement } from "../projectAuraOverlayPlacement/projectAuraOverlayPlacement";
import { resolveAuraPlacementBaseSize } from "../resolveAuraPlacementBaseSize/resolveAuraPlacementBaseSize";
import { resolveAuraPlacementScale } from "../resolveAuraPlacementScale/resolveAuraPlacementScale";
import { resolveAuraReferenceViewport } from "../resolveAuraReferenceViewport/resolveAuraReferenceViewport";
import { unprojectAuraPoint } from "../unprojectAuraPoint/unprojectAuraPoint";

const minimumAuraDisplayDimension = 10;

function resolveAuraPlacementDisplaySize(
  crop: CropRegion,
  placement: OverlayPlacement,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null = null,
): AuraSize {
  const baseSize = resolveAuraPlacementBaseSize(
    crop,
    placement,
    targetViewport,
    fallbackReferenceViewport,
  );
  const minimumDisplayDimension =
    crop.shape === "points"
      ? AuraPointPlacementSettings.minSampleSize
      : minimumAuraDisplayDimension;
  const scale = resolveAuraPlacementScale(placement);

  return {
    width: Math.max(minimumDisplayDimension, baseSize.width * scale),
    height: Math.max(minimumDisplayDimension, baseSize.height * scale),
  };
}

function isAuraPlacementQuarterTurn(placement: OverlayPlacement): boolean {
  return placement.rotationDegrees === 90 || placement.rotationDegrees === 270;
}

function resolveAuraPlacementVisualSize(
  placement: OverlayPlacement,
  contentSize: AuraSize,
): AuraSize {
  return isAuraPlacementQuarterTurn(placement)
    ? { height: contentSize.width, width: contentSize.height }
    : contentSize;
}

function resolveAuraPlacementVisualBounds(
  placement: OverlayPlacement,
  contentPosition: AuraPoint,
  contentSize: AuraSize,
): AuraProjectedBox {
  const visualSize = resolveAuraPlacementVisualSize(placement, contentSize);

  return {
    height: visualSize.height,
    width: visualSize.width,
    x: contentPosition.x + (contentSize.width - visualSize.width) / 2,
    y: contentPosition.y + (contentSize.height - visualSize.height) / 2,
  };
}

function resolveAuraPlacementContentPosition(
  placement: OverlayPlacement,
  visualPosition: AuraPoint,
  contentSize: AuraSize,
): AuraPoint {
  const visualSize = resolveAuraPlacementVisualSize(placement, contentSize);

  return {
    x: visualPosition.x - (contentSize.width - visualSize.width) / 2,
    y: visualPosition.y - (contentSize.height - visualSize.height) / 2,
  };
}

function resolveAuraPlacementGeometry(
  crop: CropRegion,
  placement: OverlayPlacement,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null = null,
): { contentSize: AuraSize; visualBounds: AuraProjectedBox } {
  const cropReferenceViewport = resolveAuraReferenceViewport(
    crop,
    fallbackReferenceViewport,
  );
  const contentPosition = projectAuraOverlayPlacement(
    placement,
    targetViewport,
    cropReferenceViewport,
  );
  const contentSize = resolveAuraPlacementDisplaySize(
    crop,
    placement,
    targetViewport,
    fallbackReferenceViewport,
  );

  return {
    contentSize,
    visualBounds: resolveAuraPlacementVisualBounds(
      placement,
      contentPosition,
      contentSize,
    ),
  };
}

function resolveAuraPlacementReferencePosition(
  crop: CropRegion,
  placement: OverlayPlacement,
  visualPosition: AuraPoint,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null = null,
): AuraPoint {
  const placementReferenceViewport = resolveAuraReferenceViewport(
    placement,
    resolveAuraReferenceViewport(crop, fallbackReferenceViewport),
  );
  const contentSize = resolveAuraPlacementDisplaySize(
    crop,
    placement,
    targetViewport,
    fallbackReferenceViewport,
  );
  const contentPosition = resolveAuraPlacementContentPosition(
    placement,
    visualPosition,
    contentSize,
  );

  return unprojectAuraPoint(
    contentPosition,
    placementReferenceViewport,
    targetViewport,
  );
}

function resolveAuraPlacementVisualPoint(
  placement: OverlayPlacement,
  point: AuraPoint,
): AuraPoint {
  const mirroredPoint = placement.mirrored
    ? { x: 100 - point.x, y: point.y }
    : point;

  if (placement.rotationDegrees === 90) {
    return { x: 100 - mirroredPoint.y, y: mirroredPoint.x };
  }
  if (placement.rotationDegrees === 180) {
    return { x: 100 - mirroredPoint.x, y: 100 - mirroredPoint.y };
  }
  if (placement.rotationDegrees === 270) {
    return { x: mirroredPoint.y, y: 100 - mirroredPoint.x };
  }

  return mirroredPoint;
}

function resolveAuraPlacementContentDelta(
  placement: OverlayPlacement,
  visualDelta: AuraPoint,
): AuraPoint {
  let contentDelta: AuraPoint;
  if (placement.rotationDegrees === 90) {
    contentDelta = { x: visualDelta.y, y: -visualDelta.x };
  } else if (placement.rotationDegrees === 180) {
    contentDelta = { x: -visualDelta.x, y: -visualDelta.y };
  } else if (placement.rotationDegrees === 270) {
    contentDelta = { x: -visualDelta.y, y: visualDelta.x };
  } else {
    contentDelta = visualDelta;
  }

  return placement.mirrored
    ? { x: -contentDelta.x, y: contentDelta.y }
    : contentDelta;
}

export {
  isAuraPlacementQuarterTurn,
  resolveAuraPlacementContentDelta,
  resolveAuraPlacementContentPosition,
  resolveAuraPlacementDisplaySize,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementReferencePosition,
  resolveAuraPlacementVisualBounds,
  resolveAuraPlacementVisualPoint,
  resolveAuraPlacementVisualSize,
};
