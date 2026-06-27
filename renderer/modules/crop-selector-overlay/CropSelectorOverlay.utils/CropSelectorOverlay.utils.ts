import type { CropRegionSelection } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import { createArcCurvePoints } from "~/renderer/modules/aura-overlay/AuraOverlay.utils/AuraOverlay.utils";

export interface CropSelectorPoint {
  x: number;
  y: number;
}

const arcSelectionThickness = 20;
const arcSampleCount = 24;
const minCropSelectionSize = 8;

export function createCropSelection(
  start: CropSelectorPoint,
  end: CropSelectorPoint,
): CropRegionSelection {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function createArcCropSelection(
  start: CropSelectorPoint,
  end: CropSelectorPoint,
  control: CropSelectorPoint,
): CropRegionSelection {
  const radius = arcSelectionThickness / 2;
  const points = [
    ...createCircularArcCurvePoints(start, end, control),
    control,
  ];
  const minX = Math.min(...points.map((point) => point.x)) - radius;
  const minY = Math.min(...points.map((point) => point.y)) - radius;
  const maxX = Math.max(...points.map((point) => point.x)) + radius;
  const maxY = Math.max(...points.map((point) => point.y)) + radius;
  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const width = Math.ceil(maxX) - x;
  const height = Math.ceil(maxY) - y;

  return {
    shape: "arc",
    x,
    y,
    width,
    height,
    arc: {
      startX: Math.round(start.x - x),
      startY: Math.round(start.y - y),
      endX: Math.round(end.x - x),
      endY: Math.round(end.y - y),
      controlX: Math.round(control.x - x),
      controlY: Math.round(control.y - y),
      thickness: arcSelectionThickness,
    },
  };
}

export function isUsableCropSelection(
  selection: CropRegionSelection | null,
): selection is CropRegionSelection {
  return (
    selection !== null &&
    selection.width >= minCropSelectionSize &&
    selection.height >= minCropSelectionSize
  );
}

export function isUsableArcEndpointSelection(
  start: CropSelectorPoint,
  end: CropSelectorPoint,
): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= minCropSelectionSize;
}

export function createCircularArcCurvePoints(
  start: CropSelectorPoint,
  end: CropSelectorPoint,
  control: CropSelectorPoint,
  sampleCount = arcSampleCount,
): CropSelectorPoint[] {
  return createArcCurvePoints(start, end, control, sampleCount);
}
