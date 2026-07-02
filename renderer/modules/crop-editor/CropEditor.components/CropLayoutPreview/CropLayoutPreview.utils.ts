import type { CSSProperties } from "react";

import { findCapturePreviewSourceForTarget } from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import { resolveActiveGameProfile } from "~/renderer/modules/profiles/Profiles.utils/Profiles.utils";

import type {
  CapturePreviewSource,
  CropRegion,
  GameId,
  Profile,
} from "~/types";

export type CropResizeCorner = "nw" | "ne" | "sw" | "se";

export interface CropPreviewBounds {
  width: number;
  height: number;
}

export interface CropPreviewBox {
  id: string;
  cropRegionId?: string;
  label: string;
  kind: "source" | "aura";
  x: number;
  y: number;
  width: number;
  height: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  opacity: number;
  toneIndex: number;
}

export interface CropLayoutPreviewModel {
  bounds: CropPreviewBounds;
  boxes: CropPreviewBox[];
}

type CropPreviewBoxStyle = CSSProperties & {
  "--crop-preview-accent": string;
};

const layoutFallbackBounds: CropPreviewBounds = { width: 1920, height: 1080 };
const auraAccentColors = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-info)",
  "var(--color-accent)",
] as const;
export const cropResizeCorners: CropResizeCorner[] = ["nw", "ne", "sw", "se"];

export function getSelectedCropLayoutProfile(
  profiles: Profile[],
  selectedProfileId: string | null,
  activeGame: GameId,
): Profile | null {
  return resolveActiveGameProfile(profiles, selectedProfileId, activeGame);
}

export function createCropLayoutPreview(
  profile: Profile,
  sourceBounds: CropPreviewBounds | null = null,
  visibleCropRegionId: string | null = null,
): CropLayoutPreviewModel {
  const sourceBoxes = profile.cropRegions.map((crop, index) => ({
    ...crop,
    cropRegionId: crop.id,
    kind: "source" as const,
    sourceX: crop.x,
    sourceY: crop.y,
    sourceWidth: crop.width,
    sourceHeight: crop.height,
    opacity: 1,
    toneIndex: index,
  }));
  const auraBoxes = createAuraBoxes(profile);
  const boxes = [...sourceBoxes, ...auraBoxes].filter(
    (box) =>
      visibleCropRegionId === null || box.cropRegionId === visibleCropRegionId,
  );

  return {
    bounds: getLayoutBounds(boxes, sourceBounds ?? layoutFallbackBounds),
    boxes,
  };
}

export function resolveCropPreviewSourceBounds(
  profile: Profile,
  sources: CapturePreviewSource[],
  selectedSourceId: string | null,
): CropPreviewBounds | null {
  const source =
    findCapturePreviewSourceForTarget(profile.captureTarget, sources) ??
    sources.find((item) => item.id === selectedSourceId) ??
    null;

  if (!source?.width || !source.height) {
    return null;
  }

  return { width: source.width, height: source.height };
}

export function createCropPreviewBoxStyle(
  box: CropPreviewBox,
  bounds: CropPreviewBounds,
): CropPreviewBoxStyle {
  return {
    "--crop-preview-accent": getCropPreviewAccentColor(box),
    left: `${(box.x / bounds.width) * 100}%`,
    top: `${(box.y / bounds.height) * 100}%`,
    width: `${Math.max((box.width / bounds.width) * 100, 0.8)}%`,
    height: `${Math.max((box.height / bounds.height) * 100, 0.8)}%`,
    opacity: box.opacity,
  };
}

export function createCropPreviewBoxLabelStyle(
  box: CropPreviewBox,
  bounds: CropPreviewBounds,
): CropPreviewBoxStyle {
  const left = (box.x / bounds.width) * 100;
  const right = ((box.x + box.width) / bounds.width) * 100;
  const top = (box.y / bounds.height) * 100;
  const bottom = ((box.y + box.height) / bounds.height) * 100;
  const alignRight = left > 60;
  const placeBelow = top < 5;

  return {
    "--crop-preview-accent": getCropPreviewAccentColor(box),
    left: `${alignRight ? Math.min(100, right) : left}%`,
    top: `${placeBelow ? bottom : top}%`,
    transform: [
      alignRight ? "translateX(-100%)" : "",
      placeBelow ? "translateY(4px)" : "translateY(calc(-100% - 4px))",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function formatCropPreviewBoxLabel(box: CropPreviewBox): string {
  return `${box.label} (${box.kind})`;
}

export function createCropPreviewStageStyle(
  bounds: CropPreviewBounds,
): CSSProperties {
  return {
    aspectRatio: `${bounds.width} / ${bounds.height}`,
  };
}

export function createCropPreviewSurfaceStyle(
  box: CropPreviewBox,
  bounds: CropPreviewBounds,
): CSSProperties {
  return {
    left: `${-(box.sourceX / box.sourceWidth) * 100}%`,
    top: `${-(box.sourceY / box.sourceHeight) * 100}%`,
    width: `${(bounds.width / box.sourceWidth) * 100}%`,
    height: `${(bounds.height / box.sourceHeight) * 100}%`,
  };
}

export function resizeCropRegionFromCorner(
  region: CropRegion,
  corner: CropResizeCorner,
  deltaX: number,
  deltaY: number,
): CropRegion {
  const roundedDeltaX = Math.round(deltaX);
  const roundedDeltaY = Math.round(deltaY);
  const right = region.x + region.width;
  const bottom = region.y + region.height;
  let x = region.x;
  let y = region.y;
  let width = region.width;
  let height = region.height;

  if (corner.includes("w")) {
    x = clamp(Math.round(region.x + roundedDeltaX), 0, right - 1);
    width = right - x;
  }

  if (corner.includes("e")) {
    width = clamp(Math.round(region.width + roundedDeltaX), 1, 100_000 - x);
  }

  if (corner.includes("n")) {
    y = clamp(Math.round(region.y + roundedDeltaY), 0, bottom - 1);
    height = bottom - y;
  }

  if (corner.includes("s")) {
    height = clamp(Math.round(region.height + roundedDeltaY), 1, 100_000 - y);
  }

  return { ...region, x, y, width, height };
}

function getCropPreviewAccentColor(box: CropPreviewBox): string {
  return box.kind === "aura"
    ? getAuraAccentColor(box)
    : "var(--crop-preview-source-color)";
}

function getAuraAccentColor(box: CropPreviewBox): string {
  return (
    auraAccentColors[box.toneIndex % auraAccentColors.length] ??
    auraAccentColors[0]
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createAuraBoxes(profile: Profile): CropPreviewBox[] {
  const cropsById = new Map(
    profile.cropRegions.map((crop) => [crop.id, crop] as const),
  );

  return profile.overlayPlacements.flatMap((placement, index) => {
    const crop = cropsById.get(placement.cropRegionId);
    if (!crop) {
      return [];
    }

    return [
      {
        id: placement.id,
        cropRegionId: placement.cropRegionId,
        label: crop.label,
        kind: "aura" as const,
        x: placement.x,
        y: placement.y,
        width: crop.width * placement.scale,
        height: crop.height * placement.scale,
        sourceX: crop.x,
        sourceY: crop.y,
        sourceWidth: crop.width,
        sourceHeight: crop.height,
        opacity: placement.opacity,
        toneIndex: index,
      },
    ];
  });
}

function getLayoutBounds(
  boxes: CropPreviewBox[],
  fallbackBounds: CropPreviewBounds,
): CropPreviewBounds {
  return boxes.reduce(
    (bounds, box) => ({
      width: Math.max(bounds.width, box.x + box.width),
      height: Math.max(bounds.height, box.y + box.height),
    }),
    fallbackBounds,
  );
}
