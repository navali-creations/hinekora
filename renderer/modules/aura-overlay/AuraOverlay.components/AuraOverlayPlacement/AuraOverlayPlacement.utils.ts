import type {
  CSSProperties,
  MouseEventHandler,
  PointerEventHandler,
  SyntheticEvent,
} from "react";

import type { CropRegion, OverlayPlacement } from "~/types";
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
  placementId: string;
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
    height: `${contentSize.height}px`,
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%)${contentTransform ? ` ${contentTransform}` : ""}`,
    width: `${contentSize.width}px`,
  };
}

export type {
  AuraArcThicknessResizeState,
  AuraOverlayDragState,
  AuraOverlayPlacementProps,
  AuraOverlayResizeState,
};
export { createPlacementContentStyle };
