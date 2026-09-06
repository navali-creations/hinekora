import type { CropRegionSelectionShape } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import { auraSelectionShapes } from "~/renderer/modules/aura-selection/AuraSelection.utils/AuraSelection.utils";

import {
  createCoordinateReferenceDimensions,
  type OverlayPlacement,
  type Profile,
  type ProfileUpdateInput,
} from "~/types";
import {
  type AuraVideoSize,
  isAuraPlacementQuarterTurn,
  resolveAuraPlacementArcVisibleThickness,
  resolveAuraPlacementDisplaySize,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementReferencePosition,
  resolveAuraPlacementScale,
  resolveAuraPlacementVisualSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

const auraScaleCategories = auraSelectionShapes;
type AuraScaleCategory = CropRegionSelectionShape;

interface AuraScaleAnchorOption {
  category: AuraScaleCategory;
  label: string;
  value: string;
}

interface AuraScaleCategoryCounts extends Record<AuraScaleCategory, number> {
  all: number;
}

function createAuraScaleAnchorOptions(
  profile: Profile | null,
): AuraScaleAnchorOption[] {
  if (!profile) {
    return [];
  }

  const cropLabels = new Map(
    profile.cropRegions.map((crop) => [crop.id, crop.label] as const),
  );
  const cropCategories = createAuraCropCategories(profile);
  const baseLabels = profile.overlayPlacements.map(
    (placement, index) =>
      cropLabels.get(placement.cropRegionId) ?? `Aura ${index + 1}`,
  );
  const labelCounts = new Map<string, number>();
  const labelIndexes = new Map<string, number>();

  for (const label of baseLabels) {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  return profile.overlayPlacements.map((placement, index) => {
    const baseLabel = baseLabels[index] ?? `Aura ${index + 1}`;
    const labelIndex = (labelIndexes.get(baseLabel) ?? 0) + 1;
    labelIndexes.set(baseLabel, labelIndex);

    return {
      category: resolveAuraScaleCategory(placement, cropCategories),
      label:
        (labelCounts.get(baseLabel) ?? 0) > 1
          ? `${baseLabel} (${labelIndex})`
          : baseLabel,
      value: placement.id,
    };
  });
}

function createAuraScaleCategoryCounts(
  profile: Profile | null,
): AuraScaleCategoryCounts {
  const counts: AuraScaleCategoryCounts = {
    all: 0,
    arc: 0,
    points: 0,
    rect: 0,
  };
  if (!profile) {
    return counts;
  }

  const cropCategories = createAuraCropCategories(profile);
  for (const placement of profile.overlayPlacements) {
    const category = resolveAuraScaleCategory(placement, cropCategories);
    counts[category] += 1;
    counts.all += 1;
  }

  return counts;
}

function createAuraProfileUpdateMatchingAnchorSize(
  profile: Profile,
  anchorPlacementId: string,
  categories: readonly AuraScaleCategory[],
  fallbackViewport: AuraVideoSize,
): Omit<ProfileUpdateInput, "id"> | null {
  const cropsById = new Map(profile.cropRegions.map((crop) => [crop.id, crop]));
  const anchorPlacement = profile.overlayPlacements.find(
    (placement) => placement.id === anchorPlacementId,
  );
  if (!anchorPlacement) {
    return null;
  }

  const anchorCrop = cropsById.get(anchorPlacement.cropRegionId);
  if (!anchorCrop) {
    return null;
  }

  const profileViewport = resolveProfileViewport(profile);
  const referenceViewport = profileViewport ?? fallbackViewport;
  const anchorDisplaySize = resolveAuraPlacementDisplaySize(
    anchorCrop,
    anchorPlacement,
    referenceViewport,
    profileViewport,
  );
  const anchorVisualSize = resolveAuraPlacementVisualSize(
    anchorPlacement,
    anchorDisplaySize,
  );
  const anchorArcVisibleThickness = resolveAuraPlacementArcVisibleThickness(
    anchorCrop,
    anchorPlacement,
    anchorDisplaySize,
  );
  const matchedWidth = Math.max(1, Math.round(anchorVisualSize.width));
  const matchedHeight = Math.max(1, Math.round(anchorVisualSize.height));
  const referenceDimensions =
    createCoordinateReferenceDimensions(referenceViewport);
  const selectedCategories = new Set(categories);
  const cropCategories = createAuraCropCategories(profile);
  let hasChanges = false;
  const overlayPlacements = profile.overlayPlacements.map((placement) => {
    const category = resolveAuraScaleCategory(placement, cropCategories);
    const isAnchor = placement.id === anchorPlacementId;
    const crop = cropsById.get(placement.cropRegionId);
    const width = isAuraPlacementQuarterTurn(placement)
      ? matchedHeight
      : matchedWidth;
    const height = isAuraPlacementQuarterTurn(placement)
      ? matchedWidth
      : matchedHeight;
    const shouldMatchArcThickness =
      anchorArcVisibleThickness !== undefined &&
      crop?.shape === "arc" &&
      crop.arc !== undefined;
    const matchesArcThickness =
      !shouldMatchArcThickness ||
      resolveAuraPlacementArcVisibleThickness(
        crop,
        placement,
        resolveAuraPlacementDisplaySize(
          crop,
          placement,
          referenceViewport,
          profileViewport,
        ),
      ) === anchorArcVisibleThickness;
    if (
      (!selectedCategories.has(category) && !isAnchor) ||
      !crop ||
      (isAnchor && anchorCrop.shape !== "points") ||
      (placement.width === width &&
        placement.height === height &&
        resolveAuraPlacementScale(placement) === 1 &&
        placement.referenceWidth === referenceDimensions.referenceWidth &&
        placement.referenceHeight === referenceDimensions.referenceHeight &&
        matchesArcThickness)
    ) {
      return placement;
    }

    hasChanges = true;
    const { visualBounds } = resolveAuraPlacementGeometry(
      crop,
      placement,
      referenceViewport,
      profileViewport,
    );
    const nextPlacement: OverlayPlacement = {
      ...placement,
      ...referenceDimensions,
      height,
      scale: 1,
      width,
    };
    if (shouldMatchArcThickness) {
      nextPlacement.arcVisibleThickness = anchorArcVisibleThickness;
    }
    const referencePosition = resolveAuraPlacementReferencePosition(
      crop,
      nextPlacement,
      { x: visualBounds.x, y: visualBounds.y },
      referenceViewport,
      profileViewport,
    );

    return {
      ...nextPlacement,
      x: Math.round(referencePosition.x),
      y: Math.round(referencePosition.y),
    };
  });

  return hasChanges ? { overlayPlacements } : null;
}

function resolveProfileViewport(profile: Profile): AuraVideoSize | null {
  const width = profile.captureTarget?.width;
  const height = profile.captureTarget?.height;

  return width && height ? { height, width } : null;
}

function createAuraCropCategories(
  profile: Profile,
): Map<string, AuraScaleCategory> {
  return new Map(
    profile.cropRegions.map((crop) => [
      crop.id,
      crop.shape === "arc"
        ? "arc"
        : crop.shape === "points"
          ? "points"
          : "rect",
    ]),
  );
}

function resolveAuraScaleCategory(
  placement: OverlayPlacement,
  cropCategories: ReadonlyMap<string, AuraScaleCategory>,
): AuraScaleCategory {
  return cropCategories.get(placement.cropRegionId) ?? "rect";
}

function isAuraScaleCategory(value: string): value is AuraScaleCategory {
  return auraScaleCategories.includes(value as AuraScaleCategory);
}

export type { AuraScaleCategory, AuraScaleCategoryCounts };
export {
  auraScaleCategories,
  createAuraProfileUpdateMatchingAnchorSize,
  createAuraScaleAnchorOptions,
  createAuraScaleCategoryCounts,
  isAuraScaleCategory,
};
