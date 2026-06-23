import type { CSSProperties } from "react";

import type {
  CropRegion,
  OverlayPlacement,
  Profile,
  ProfileUpdateInput,
} from "~/types";

type AuraResizeCorner = "nw" | "ne" | "sw" | "se";

interface AuraVideoSize {
  width: number;
  height: number;
}

interface AuraHistorySnapshot {
  cropRegions: CropRegion[];
  overlayPlacements: OverlayPlacement[];
}

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
): CSSProperties {
  const width = Math.max(videoSize.width, crop.x + crop.width);
  const height = Math.max(videoSize.height, crop.y + crop.height);

  return {
    left: `${-crop.x * placement.scale}px`,
    top: `${-crop.y * placement.scale}px`,
    width: `${width * placement.scale}px`,
    height: `${height * placement.scale}px`,
  };
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
): OverlayPlacement {
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

export type { AuraHistorySnapshot, AuraResizeCorner, AuraVideoSize };
