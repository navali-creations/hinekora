export type CropRegionSelectionShape = "rect" | "arc";

export interface CropRegionArcSelection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  controlX: number;
  controlY: number;
  thickness: number;
}

export interface CropRegionSelection {
  shape?: CropRegionSelectionShape;
  x: number;
  y: number;
  width: number;
  height: number;
  arc?: CropRegionArcSelection;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface SelectCropRegionOptions {
  shape?: CropRegionSelectionShape;
}

export interface ShowAuraOverlayOptions {
  startAddingAura?: boolean;
  addAuraShape?: CropRegionSelectionShape;
}

export interface AuraAddRequest {
  requestId: string;
  shape?: CropRegionSelectionShape;
}

export type RecorderOverlayMode = "expanded" | "minimized";
