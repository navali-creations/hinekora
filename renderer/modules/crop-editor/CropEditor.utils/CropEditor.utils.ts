import { resolveActiveGameProfile } from "~/renderer/modules/profiles/Profiles.utils/Profiles.utils";

import {
  AuraPointPlacementSettings,
  type CropRegion,
  type CropRegionArc,
  type CropRegionPoint,
  createCoordinateReferenceDimensions,
  type GameId,
  type OverlayPlacement,
  type Profile,
} from "~/types";

export const cropNumberFields = ["x", "y", "width", "height"] as const;
export type CropNumberField = (typeof cropNumberFields)[number];

export const placementNumberFields = ["x", "y", "scale", "opacity"] as const;
export type PlacementNumberField = (typeof placementNumberFields)[number];

interface PlacementViewport {
  width: number;
  height: number;
}

interface SelectionPlacementViewport {
  viewportWidth?: number;
  viewportHeight?: number;
}

interface AuraSourceSelection extends SelectionPlacementViewport {
  shape?: "rect" | "arc" | "points";
  x: number;
  y: number;
  width: number;
  height: number;
  arc?: CropRegionArc;
  points?: CropRegionPoint[];
}

type AuraProfile = Pick<Profile, "id" | "cropRegions" | "overlayPlacements">;

interface AuraProfileUpdateFromSelection {
  crop: CropRegion;
  placement: OverlayPlacement;
  profileUpdate: {
    id: string;
    cropRegions: CropRegion[];
    overlayPlacements: OverlayPlacement[];
  };
}

export function isCropNumberField(
  value: string | undefined,
): value is CropNumberField {
  return cropNumberFields.includes(value as CropNumberField);
}

export function isPlacementNumberField(
  value: string | undefined,
): value is PlacementNumberField {
  return placementNumberFields.includes(value as PlacementNumberField);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createPlacementForCrop(
  crop: CropRegion,
  placementIndex: number,
  viewport?: PlacementViewport,
): OverlayPlacement {
  const cascadeOffset = placementIndex * 18;
  const fallbackOffset = 24 + cascadeOffset;
  const x =
    viewport && viewport.width > 0
      ? clamp(
          Math.round((viewport.width - crop.width) / 2 + cascadeOffset),
          0,
          Math.max(0, viewport.width - crop.width),
        )
      : fallbackOffset;
  const y =
    viewport && viewport.height > 0
      ? clamp(
          Math.round((viewport.height - crop.height) / 2 + cascadeOffset),
          0,
          Math.max(0, viewport.height - crop.height),
        )
      : fallbackOffset;

  return {
    id: crypto.randomUUID(),
    cropRegionId: crop.id,
    x,
    y,
    scale: 1,
    opacity: 1,
    ...(crop.shape === "points"
      ? {
          pointGap: AuraPointPlacementSettings.defaultGap,
          pointSampleSize: AuraPointPlacementSettings.defaultSampleSize,
        }
      : {}),
    ...(viewport ? createCoordinateReferenceDimensions(viewport) : {}),
  };
}

export function createAuraProfileUpdateFromSelection(
  profile: AuraProfile,
  selection: AuraSourceSelection,
): AuraProfileUpdateFromSelection {
  const placementViewport = resolveSelectionPlacementViewport(selection);
  const crop: CropRegion = {
    id: crypto.randomUUID(),
    label:
      selection.shape === "arc"
        ? `Arched aura ${profile.cropRegions.length + 1}`
        : selection.shape === "points"
          ? `Pointer aura ${profile.cropRegions.length + 1}`
          : `Aura ${profile.cropRegions.length + 1}`,
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
    ...(selection.shape === "arc" && selection.arc
      ? { shape: "arc" as const, arc: selection.arc }
      : {}),
    ...(selection.shape === "points" && selection.points
      ? { shape: "points" as const, points: selection.points }
      : {}),
    ...(placementViewport
      ? createCoordinateReferenceDimensions(placementViewport)
      : {}),
  };
  const placement = createPlacementForCrop(
    crop,
    profile.overlayPlacements.length,
    placementViewport,
  );

  return {
    crop,
    placement,
    profileUpdate: {
      id: profile.id,
      cropRegions: [...profile.cropRegions, crop],
      overlayPlacements: [...profile.overlayPlacements, placement],
    },
  };
}

export function resolveSelectionPlacementViewport(
  selection: SelectionPlacementViewport,
): PlacementViewport | undefined {
  if (
    typeof selection.viewportWidth !== "number" ||
    typeof selection.viewportHeight !== "number" ||
    !Number.isFinite(selection.viewportWidth) ||
    !Number.isFinite(selection.viewportHeight) ||
    selection.viewportWidth <= 0 ||
    selection.viewportHeight <= 0
  ) {
    return undefined;
  }

  return {
    width: selection.viewportWidth,
    height: selection.viewportHeight,
  };
}

export function getSelectedProfile(
  profiles: Profile[],
  selectedProfileId: string | null,
  activeGame: GameId,
): Profile | null {
  return resolveActiveGameProfile(profiles, selectedProfileId, activeGame);
}

export function resolveActiveAuraCropRegionId(
  profile: Profile | null,
  selectedAuraCropRegionId: string | null,
): string | null {
  if (!profile || profile.cropRegions.length === 0) {
    return null;
  }

  return profile.cropRegions.some(
    (region) => region.id === selectedAuraCropRegionId,
  )
    ? selectedAuraCropRegionId
    : (profile.cropRegions[0]?.id ?? null);
}
