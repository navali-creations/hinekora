import type {
  MouseEventHandler,
  PointerEventHandler,
  SyntheticEvent,
} from "react";

import type { CropRegion, OverlayPlacement } from "~/types";
import type {
  AuraResizeCorner,
  AuraVideoSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import type {
  AuraPlacementPropertiesPanelSide,
  AuraPlacementPropertiesPatch,
} from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";

interface AuraOverlayDragState {
  placementId: string;
  startX: number;
  startY: number;
  initialDisplayX: number;
  initialDisplayY: number;
  deltaX: number;
  deltaY: number;
  isReleased: boolean;
}

interface AuraOverlayResizeState {
  placementId: string;
  corner: AuraResizeCorner;
  startX: number;
  startY: number;
  initialPlacement: OverlayPlacement;
  draftPlacement: OverlayPlacement;
  isReleased: boolean;
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
  selectedPlacementId: string | null;
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

function resolvePropertiesPanelSide(
  left: number,
  top: number,
  width: number,
  height: number,
): AuraPlacementPropertiesPanelSide {
  const panelWidth = 180;
  const panelHeight = 126;
  const gap = 8;
  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;

  if (left + width + panelWidth + gap <= viewportWidth) {
    return "right";
  }

  if (left >= panelWidth + gap) {
    return "left";
  }

  if (top + height + panelHeight + gap <= viewportHeight) {
    return "bottom";
  }

  return "top";
}

export type {
  AuraArcThicknessResizeState,
  AuraOverlayDragState,
  AuraOverlayPlacementProps,
  AuraOverlayResizeState,
};
export { createPlacementContentTransform, resolvePropertiesPanelSide };
