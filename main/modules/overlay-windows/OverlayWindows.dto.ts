export interface CropRegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface ShowAuraOverlayOptions {
  startAddingAura?: boolean;
}

export type RecorderOverlayMode = "expanded" | "minimized";
