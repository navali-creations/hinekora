import type {
  CSSProperties,
  MouseEventHandler,
  PointerEventHandler,
  SyntheticEvent,
} from "react";

import type {
  AuraPlacementClipShape,
  CropRegion,
  OverlayPlacement,
} from "~/types";
import type {
  AuraOverlayScaleSnapContext,
  AuraOverlaySnapContext,
  AuraOverlaySnapGuide,
  AuraResizeCorner,
  AuraSize,
  AuraVideoSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import type { AuraPlacementPropertiesPatch } from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";

interface AuraOverlayDragState {
  areaSelectionDrag?: boolean;
  initialDisplayPositions?: Readonly<Record<string, { x: number; y: number }>>;
  placementId: string;
  placementIds?: readonly string[];
  startX: number;
  startY: number;
  initialDisplayX: number;
  initialDisplayY: number;
  deltaX: number;
  deltaY: number;
  isReleased: boolean;
  snapContext: AuraOverlaySnapContext | null;
  snapGuideX: AuraOverlaySnapGuide | null;
  snapGuideY: AuraOverlaySnapGuide | null;
}

interface AuraOverlayResizeState {
  placementId: string;
  corner: AuraResizeCorner;
  startX: number;
  startY: number;
  initialPlacement: OverlayPlacement;
  draftPlacement: OverlayPlacement;
  isReleased: boolean;
  scaleSnapContext: AuraOverlayScaleSnapContext | null;
}

interface AuraArcThicknessResizeState {
  placementId: string;
  startX: number;
  startY: number;
  crop: CropRegion;
  initialPlacement: OverlayPlacement;
  draftPlacement: OverlayPlacement;
  initialDisplayThickness: number;
  maxDisplayThickness: number;
  isReleased: boolean;
}

const auraPlacementClipShapePoints: Record<
  Exclude<AuraPlacementClipShape, "circle">,
  readonly { x: number; y: number }[]
> = {
  octagon: [
    { x: 30, y: 0 },
    { x: 70, y: 0 },
    { x: 100, y: 30 },
    { x: 100, y: 70 },
    { x: 70, y: 100 },
    { x: 30, y: 100 },
    { x: 0, y: 70 },
    { x: 0, y: 30 },
  ],
  shield: [
    { x: 50, y: 0 },
    { x: 92, y: 12 },
    { x: 88, y: 58 },
    { x: 72, y: 82 },
    { x: 50, y: 100 },
    { x: 28, y: 82 },
    { x: 12, y: 58 },
    { x: 8, y: 12 },
  ],
};

interface AuraOverlayPlacementProps {
  arcThicknessResizeState: AuraArcThicknessResizeState | null;
  auraOverlayLocked: boolean;
  bindAuraVideo: (element: HTMLVideoElement | null) => void;
  canEditAuras: boolean;
  crop: CropRegion;
  dragState: AuraOverlayDragState | null;
  effectiveVideoSize: AuraVideoSize;
  placement: OverlayPlacement;
  referenceViewport: AuraVideoSize | null;
  resizeState: AuraOverlayResizeState | null;
  stream: MediaStream | null;
  onAuraClick: MouseEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onResizePointerCancel: PointerEventHandler<HTMLElement>;
  onResizePointerDown: PointerEventHandler<HTMLElement>;
  onResizePointerMove: PointerEventHandler<HTMLElement>;
  onResizePointerUp: PointerEventHandler<HTMLElement>;
  onPlacementPropertiesChange: (
    placementId: string,
    patch: AuraPlacementPropertiesPatch,
  ) => void;
  onThicknessPointerCancel: PointerEventHandler<HTMLElement>;
  onThicknessPointerDown: PointerEventHandler<HTMLElement>;
  onThicknessPointerMove: PointerEventHandler<HTMLElement>;
  onThicknessPointerUp: PointerEventHandler<HTMLElement>;
  onVideoSizeChange: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

function createPlacementContentTransform(placement: OverlayPlacement): string {
  const transforms: string[] = [];
  if (placement.rotationDegrees) {
    transforms.push(`rotate(${placement.rotationDegrees}deg)`);
  }

  if (placement.mirrored) {
    transforms.push("scaleX(-1)");
  }

  return transforms.join(" ");
}

function createPlacementContentStyle(
  placement: OverlayPlacement,
  contentSize: AuraSize,
): CSSProperties {
  const contentTransform = createPlacementContentTransform(placement);

  return {
    ...(placement.cornerRadius !== undefined
      ? { borderRadius: `${placement.cornerRadius}px` }
      : {}),
    height: `${contentSize.height}px`,
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%)${
      contentTransform ? ` ${contentTransform}` : ""
    }`,
    width: `${contentSize.width}px`,
  };
}

function resolveAuraPlacementClipPath(
  clipShape: AuraPlacementClipShape | undefined,
): string | undefined {
  if (clipShape === "circle") {
    return "ellipse(50% 50% at 50% 50%)";
  }
  if (!clipShape) {
    return undefined;
  }

  return `polygon(${auraPlacementClipShapePoints[clipShape]
    .map((point) => `${point.x}% ${point.y}%`)
    .join(", ")})`;
}

function createAuraPlacementClipShapePolygonPoints(
  clipShape: AuraPlacementClipShape,
  displaySize: AuraSize,
): string | null {
  if (clipShape === "circle") {
    return null;
  }

  return auraPlacementClipShapePoints[clipShape]
    .map(
      (point) =>
        `${roundAuraCoordinate(
          (point.x / 100) * displaySize.width,
        )},${roundAuraCoordinate((point.y / 100) * displaySize.height)}`,
    )
    .join(" ");
}

function roundAuraCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}

export type {
  AuraArcThicknessResizeState,
  AuraOverlayDragState,
  AuraOverlayPlacementProps,
  AuraOverlayResizeState,
};
export {
  createAuraPlacementClipShapePolygonPoints,
  createPlacementContentStyle,
  resolveAuraPlacementClipPath,
  roundAuraCoordinate,
};
