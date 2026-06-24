import type { CSSProperties } from "react";

import {
  type CropRegion,
  createCoordinateReferenceDimensions,
  type OverlayPlacement,
  type Profile,
  type ProfileUpdateInput,
} from "~/types";

type AuraResizeCorner = "nw" | "ne" | "sw" | "se";

interface AuraVideoSize {
  width: number;
  height: number;
}

interface AuraReferenceDimensions {
  referenceWidth?: number | null | undefined;
  referenceHeight?: number | null | undefined;
}

interface AuraProjectedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AuraPoint {
  x: number;
  y: number;
}

interface AuraViewportProjection {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface AuraHistorySnapshot {
  cropRegions: CropRegion[];
  overlayPlacements: OverlayPlacement[];
}

const legacyAuraReferenceViewport: AuraVideoSize = {
  width: 1920,
  height: 1080,
};

export const auraResizeCorners: AuraResizeCorner[] = ["nw", "ne", "sw", "se"];

export function readAuraRouteParams(
  hash = window.location.hash,
): URLSearchParams {
  return new URLSearchParams(hash.split("?")[1] ?? "");
}

export function isAuraResizeCorner(
  value: string | undefined,
): value is AuraResizeCorner {
  return auraResizeCorners.includes(value as AuraResizeCorner);
}

export function createAuraPreviewConstraints(
  sourceId: string,
): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: 7680,
        maxHeight: 4320,
        maxFrameRate: 10,
      },
    } as unknown as MediaTrackConstraints,
  };
}

export function createAuraVideoStyle(
  crop: CropRegion,
  placement: OverlayPlacement,
  videoSize: AuraVideoSize,
  referenceViewport: AuraVideoSize | null = null,
): CSSProperties {
  const projectedCrop = projectAuraCropRegion(
    crop,
    videoSize,
    referenceViewport,
  );
  const width = Math.max(
    videoSize.width,
    projectedCrop.x + projectedCrop.width,
  );
  const height = Math.max(
    videoSize.height,
    projectedCrop.y + projectedCrop.height,
  );

  return {
    left: `${-projectedCrop.x * placement.scale}px`,
    top: `${-projectedCrop.y * placement.scale}px`,
    width: `${width * placement.scale}px`,
    height: `${height * placement.scale}px`,
  };
}

export function resolveAuraReferenceViewport(
  dimensions: AuraReferenceDimensions | null | undefined,
  fallbackViewport: AuraVideoSize | null = null,
): AuraVideoSize {
  const referenceWidth = dimensions?.referenceWidth;
  const referenceHeight = dimensions?.referenceHeight;

  if (
    isUsableViewportDimension(referenceWidth) &&
    isUsableViewportDimension(referenceHeight)
  ) {
    return {
      width: Math.round(referenceWidth),
      height: Math.round(referenceHeight),
    };
  }

  if (isUsableAuraViewport(fallbackViewport)) {
    return fallbackViewport;
  }

  return legacyAuraReferenceViewport;
}

export function createAuraViewportProjection(
  referenceViewport: AuraVideoSize,
  targetViewport: AuraVideoSize,
): AuraViewportProjection {
  const reference = isUsableAuraViewport(referenceViewport)
    ? referenceViewport
    : legacyAuraReferenceViewport;
  const target = isUsableAuraViewport(targetViewport)
    ? targetViewport
    : reference;
  const scale = Math.min(
    target.width / reference.width,
    target.height / reference.height,
  );

  return {
    offsetX: (target.width - reference.width * scale) / 2,
    offsetY: (target.height - reference.height * scale) / 2,
    scale,
  };
}

export function projectAuraPoint(
  point: AuraPoint,
  referenceViewport: AuraVideoSize,
  targetViewport: AuraVideoSize,
): AuraPoint {
  const projection = createAuraViewportProjection(
    referenceViewport,
    targetViewport,
  );

  return {
    x: projection.offsetX + point.x * projection.scale,
    y: projection.offsetY + point.y * projection.scale,
  };
}

export function unprojectAuraPoint(
  point: AuraPoint,
  referenceViewport: AuraVideoSize,
  targetViewport: AuraVideoSize,
): AuraPoint {
  const projection = createAuraViewportProjection(
    referenceViewport,
    targetViewport,
  );

  return {
    x: (point.x - projection.offsetX) / projection.scale,
    y: (point.y - projection.offsetY) / projection.scale,
  };
}

export function projectAuraBox(
  box: AuraProjectedBox,
  referenceViewport: AuraVideoSize,
  targetViewport: AuraVideoSize,
): AuraProjectedBox {
  const projection = createAuraViewportProjection(
    referenceViewport,
    targetViewport,
  );

  return {
    x: projection.offsetX + box.x * projection.scale,
    y: projection.offsetY + box.y * projection.scale,
    width: box.width * projection.scale,
    height: box.height * projection.scale,
  };
}

export function projectAuraCropRegion(
  crop: CropRegion,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null = null,
): AuraProjectedBox {
  return projectAuraBox(
    crop,
    resolveAuraReferenceViewport(crop, fallbackReferenceViewport),
    targetViewport,
  );
}

export function projectAuraOverlayPlacement(
  placement: OverlayPlacement,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null = null,
): AuraPoint {
  return projectAuraPoint(
    placement,
    resolveAuraReferenceViewport(placement, fallbackReferenceViewport),
    targetViewport,
  );
}

export function readAuraVideoSize(
  video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight">,
): AuraVideoSize | null {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  return {
    width: video.videoWidth,
    height: video.videoHeight,
  };
}

export function resizeAuraPlacementFromCorner(
  crop: CropRegion,
  placement: OverlayPlacement,
  corner: AuraResizeCorner,
  deltaX: number,
  deltaY: number,
  targetViewport?: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null = null,
): OverlayPlacement {
  if (targetViewport) {
    return resizeProjectedAuraPlacementFromCorner(
      crop,
      placement,
      corner,
      deltaX,
      deltaY,
      targetViewport,
      fallbackReferenceViewport,
    );
  }

  const width = crop.width * placement.scale;
  const height = crop.height * placement.scale;
  const nextWidth = corner.includes("w") ? width - deltaX : width + deltaX;
  const nextHeight = corner.includes("n") ? height - deltaY : height + deltaY;
  const nextScaleX = nextWidth / crop.width;
  const nextScaleY = nextHeight / crop.height;
  const nextScale =
    Math.abs(nextScaleX - placement.scale) >
    Math.abs(nextScaleY - placement.scale)
      ? nextScaleX
      : nextScaleY;
  const scale = clamp(Math.round(nextScale * 1_000) / 1_000, 0.1, 8);
  const scaledWidth = crop.width * scale;
  const scaledHeight = crop.height * scale;

  return {
    ...placement,
    scale,
    x: corner.includes("w")
      ? Math.max(0, Math.round(placement.x + width - scaledWidth))
      : placement.x,
    y: corner.includes("n")
      ? Math.max(0, Math.round(placement.y + height - scaledHeight))
      : placement.y,
  };
}

function resizeProjectedAuraPlacementFromCorner(
  crop: CropRegion,
  placement: OverlayPlacement,
  corner: AuraResizeCorner,
  deltaX: number,
  deltaY: number,
  targetViewport: AuraVideoSize,
  fallbackReferenceViewport: AuraVideoSize | null,
): OverlayPlacement {
  const cropReferenceViewport = resolveAuraReferenceViewport(
    crop,
    fallbackReferenceViewport,
  );
  const placementReferenceViewport = resolveAuraReferenceViewport(
    placement,
    cropReferenceViewport,
  );
  const projectedCrop = projectAuraBox(
    crop,
    cropReferenceViewport,
    targetViewport,
  );
  const projectedPlacement = projectAuraPoint(
    placement,
    placementReferenceViewport,
    targetViewport,
  );
  const width = projectedCrop.width * placement.scale;
  const height = projectedCrop.height * placement.scale;
  const nextWidth = corner.includes("w") ? width - deltaX : width + deltaX;
  const nextHeight = corner.includes("n") ? height - deltaY : height + deltaY;
  const nextScaleX = nextWidth / projectedCrop.width;
  const nextScaleY = nextHeight / projectedCrop.height;
  const nextScale =
    Math.abs(nextScaleX - placement.scale) >
    Math.abs(nextScaleY - placement.scale)
      ? nextScaleX
      : nextScaleY;
  const scale = clamp(Math.round(nextScale * 1_000) / 1_000, 0.1, 8);
  const scaledWidth = projectedCrop.width * scale;
  const scaledHeight = projectedCrop.height * scale;
  const x = corner.includes("w")
    ? projectedPlacement.x + width - scaledWidth
    : projectedPlacement.x;
  const y = corner.includes("n")
    ? projectedPlacement.y + height - scaledHeight
    : projectedPlacement.y;
  const referencePoint = unprojectAuraPoint(
    {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
    },
    placementReferenceViewport,
    targetViewport,
  );

  return {
    ...placement,
    ...createCoordinateReferenceDimensions(placementReferenceViewport),
    scale,
    x: corner.includes("w")
      ? Math.max(0, Math.round(referencePoint.x))
      : placement.x,
    y: corner.includes("n")
      ? Math.max(0, Math.round(referencePoint.y))
      : placement.y,
  };
}

export function createAuraHistorySnapshot(
  profile: Pick<Profile, "cropRegions" | "overlayPlacements">,
): AuraHistorySnapshot {
  return {
    cropRegions: profile.cropRegions.map((region) => ({ ...region })),
    overlayPlacements: profile.overlayPlacements.map((placement) => ({
      ...placement,
    })),
  };
}

export function createAuraProfileUpdateFromSnapshot(
  profileId: string,
  snapshot: AuraHistorySnapshot,
): ProfileUpdateInput {
  return {
    id: profileId,
    cropRegions: snapshot.cropRegions.map((region) => ({ ...region })),
    overlayPlacements: snapshot.overlayPlacements.map((placement) => ({
      ...placement,
    })),
  };
}

export function createAuraProfileUpdateDeletingPlacement(
  profile: Pick<Profile, "id" | "cropRegions" | "overlayPlacements">,
  placementId: string,
): ProfileUpdateInput | null {
  const placement = profile.overlayPlacements.find(
    (item) => item.id === placementId,
  );
  if (!placement) {
    return null;
  }

  return {
    id: profile.id,
    cropRegions: profile.cropRegions.filter(
      (region) => region.id !== placement.cropRegionId,
    ),
    overlayPlacements: profile.overlayPlacements.filter(
      (item) => item.cropRegionId !== placement.cropRegionId,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isUsableAuraViewport(
  viewport: AuraVideoSize | null | undefined,
): viewport is AuraVideoSize {
  return (
    isUsableViewportDimension(viewport?.width) &&
    isUsableViewportDimension(viewport?.height)
  );
}

function isUsableViewportDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export type { AuraHistorySnapshot, AuraResizeCorner, AuraVideoSize };
