import {
  createCoordinateReferenceDimensions,
  type Profile,
  type ProfileUpdateInput,
} from "~/types";
import {
  type AuraVideoSize,
  projectAuraPoint,
  resolveAuraPlacementGeometry,
  resolveAuraPlacementReferencePosition,
  resolveAuraReferenceViewport,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

interface CreateAuraOverlayPlacementMoveInput {
  deltaX: number;
  deltaY: number;
  placementIds: readonly string[];
  primaryPlacementId: string;
  profile: Profile;
  referenceViewport: AuraVideoSize | null;
  targetViewport: AuraVideoSize;
}

interface AuraOverlayPlacementMoveResult {
  deltaX: number;
  deltaY: number;
  update: Omit<ProfileUpdateInput, "id">;
}

function createAuraOverlayPlacementMove({
  deltaX,
  deltaY,
  placementIds,
  primaryPlacementId,
  profile,
  referenceViewport,
  targetViewport,
}: CreateAuraOverlayPlacementMoveInput): AuraOverlayPlacementMoveResult | null {
  const selectedIds = new Set(placementIds);
  const cropRegionsById = new Map(
    profile.cropRegions.map((crop) => [crop.id, crop] as const),
  );
  const selectedGeometry = profile.overlayPlacements.flatMap((placement) => {
    if (!selectedIds.has(placement.id)) {
      return [];
    }

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
    const placementReferenceViewport = resolveAuraReferenceViewport(
      placement,
      resolveAuraReferenceViewport(crop, referenceViewport),
    );
    const minimumVisualPosition = projectAuraPoint(
      { x: 0, y: 0 },
      placementReferenceViewport,
      targetViewport,
    );

    return [
      {
        crop,
        minimumVisualPosition,
        placement,
        placementReferenceViewport,
        visualBounds,
      },
    ];
  });
  const primaryGeometry = selectedGeometry.find(
    ({ placement }) => placement.id === primaryPlacementId,
  );
  if (!primaryGeometry) {
    return null;
  }

  const requestedDeltaX =
    Math.round(primaryGeometry.visualBounds.x + deltaX) -
    primaryGeometry.visualBounds.x;
  const requestedDeltaY =
    Math.round(primaryGeometry.visualBounds.y + deltaY) -
    primaryGeometry.visualBounds.y;
  const minimumDeltaX = Math.max(
    ...selectedGeometry.map(
      ({ minimumVisualPosition, visualBounds }) =>
        minimumVisualPosition.x - visualBounds.x,
    ),
  );
  const minimumDeltaY = Math.max(
    ...selectedGeometry.map(
      ({ minimumVisualPosition, visualBounds }) =>
        minimumVisualPosition.y - visualBounds.y,
    ),
  );
  const appliedDeltaX = Math.max(minimumDeltaX, requestedDeltaX);
  const appliedDeltaY = Math.max(minimumDeltaY, requestedDeltaY);
  const movedPlacements = new Map<
    string,
    Profile["overlayPlacements"][number]
  >();
  const cropReferenceDimensions = new Map<
    string,
    ReturnType<typeof createCoordinateReferenceDimensions>
  >();

  for (const geometry of selectedGeometry) {
    const { crop, placement, placementReferenceViewport, visualBounds } =
      geometry;
    const referencePoint = resolveAuraPlacementReferencePosition(
      crop,
      placement,
      {
        x: Math.round(visualBounds.x + appliedDeltaX),
        y: Math.round(visualBounds.y + appliedDeltaY),
      },
      targetViewport,
      referenceViewport,
    );
    const referenceDimensions = createCoordinateReferenceDimensions(
      placementReferenceViewport,
    );
    movedPlacements.set(placement.id, {
      ...placement,
      ...referenceDimensions,
      x: Math.round(referencePoint.x),
      y: Math.round(referencePoint.y),
    });
    cropReferenceDimensions.set(crop.id, referenceDimensions);
  }

  const overlayPlacements = profile.overlayPlacements.map(
    (placement) => movedPlacements.get(placement.id) ?? placement,
  );
  const hasMoved = overlayPlacements.some((placement, index) => {
    const previous = profile.overlayPlacements[index];
    return placement.x !== previous?.x || placement.y !== previous.y;
  });
  if (!hasMoved) {
    return null;
  }

  return {
    deltaX: appliedDeltaX,
    deltaY: appliedDeltaY,
    update: {
      cropRegions: profile.cropRegions.map((crop) => ({
        ...crop,
        ...cropReferenceDimensions.get(crop.id),
      })),
      overlayPlacements,
    },
  };
}

export { createAuraOverlayPlacementMove };
