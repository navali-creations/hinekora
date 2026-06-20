import type { CropRegionSelection } from "~/main/modules/overlay-windows/OverlayWindows.dto";

export interface CropSelectorPoint {
  x: number;
  y: number;
}

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

export function isUsableCropSelection(
  selection: CropRegionSelection | null,
): selection is CropRegionSelection {
  return selection !== null && selection.width >= 8 && selection.height >= 8;
}
