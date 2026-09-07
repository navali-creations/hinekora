import type {
  AuraPlacementClipShape,
  CropRegion,
  OverlayPlacement,
} from "~/types";
import {
  type AuraSize,
  createAuraArcBoundaryPoints,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import {
  createAuraPlacementClipShapePolygonPoints,
  roundAuraCoordinate,
} from "../AuraOverlayPlacement/AuraOverlayPlacement.utils";

const auraShadowBlurStandardDeviation = 4;
const auraShadowBlurPadding = auraShadowBlurStandardDeviation * 3;

interface AuraPlacementEffectGeometry {
  polygonPoints: string | null;
  shape: "arc" | "circle" | "octagon" | "rect" | "shield";
}

function createAuraPlacementEffectGeometry(
  crop: CropRegion,
  displaySize: AuraSize,
  isStraightenedArc: boolean,
  visibleThickness?: number,
  clipShape?: AuraPlacementClipShape,
): AuraPlacementEffectGeometry {
  if (
    crop.shape === "arc" &&
    !isStraightenedArc &&
    visibleThickness !== undefined
  ) {
    const boundaries = createAuraArcBoundaryPoints(
      crop,
      visibleThickness,
      displaySize,
    );
    if (boundaries) {
      const points = [...boundaries.outer, ...boundaries.inner.toReversed()]
        .map(
          (point) =>
            `${roundAuraCoordinate(point.x)},${roundAuraCoordinate(point.y)}`,
        )
        .join(" ");

      return { polygonPoints: points, shape: "arc" };
    }
  }

  if ((crop.shape === undefined || crop.shape === "rect") && clipShape) {
    return {
      polygonPoints: createAuraPlacementClipShapePolygonPoints(
        clipShape,
        displaySize,
      ),
      shape: clipShape,
    };
  }

  return { polygonPoints: null, shape: "rect" };
}

function resolveAuraPlacementEffectPadding(
  placement: OverlayPlacement,
): number {
  return Math.max(
    placement.outlineThickness ?? 0,
    placement.shadowSpread !== undefined
      ? placement.shadowSpread + auraShadowBlurPadding
      : 0,
  );
}

export {
  auraShadowBlurStandardDeviation,
  createAuraPlacementEffectGeometry,
  resolveAuraPlacementEffectPadding,
};
