import {
  type AuraPlacementClipShape,
  AuraPlacementContentZoomSettings,
  AuraPlacementEffectSettings,
  AuraPlacementScaleSettings,
  AuraPointPlacementSettings,
  type OverlayPlacement,
} from "~/types";
import {
  type AuraRotationDegrees,
  type AuraSize,
  auraRotationDegrees,
  clamp,
  normalizeAuraPlacementNumberValue,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

interface AuraPlacementPropertiesPanelBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface AuraPlacementPropertiesPanelLayout {
  left: number;
  maxHeight: number;
  top: number;
}

interface AuraPlacementPropertiesPatch {
  arcStraightened?: boolean;
  arcVisibleThickness?: number;
  clipShape?: AuraPlacementClipShape | null;
  contentZoomPercent?: number;
  cornerRadius?: number | null;
  centerOffsetX?: number;
  centerOffsetY?: number;
  displayHeight?: number;
  displayWidth?: number;
  hideResizeControls?: boolean;
  iconOffsetX?: number;
  iconOffsetY?: number;
  label?: string;
  mirrored?: boolean;
  opacity?: number;
  outlineColor?: string | null;
  outlineThickness?: number | null;
  pointGap?: number;
  pointSampleSize?: number;
  recordHistory?: boolean;
  resetToDefaults?: boolean;
  rotationDegrees?: AuraRotationDegrees;
  scale?: number;
  shadowColor?: string | null;
  shadowSpread?: number | null;
}

interface AuraPlacementPropertiesPanelProps {
  anchorBounds: AuraPlacementPropertiesPanelBounds;
  centerOffsetX: number;
  centerOffsetY: number;
  displayHeight: number;
  displayWidth: number;
  label: string;
  placement: OverlayPlacement;
  pointControls?: boolean;
  showClipShapeControls?: boolean;
  visibleThickness?: number;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
}

type NumberFieldName =
  | "contentZoomPercent"
  | "cornerRadius"
  | "height"
  | "iconOffsetX"
  | "iconOffsetY"
  | "opacity"
  | "outlineThickness"
  | "pointGap"
  | "pointSampleSize"
  | "scale"
  | "shadowSpread"
  | "thickness"
  | "width"
  | "x"
  | "y";

type AuraPlacementNumberValueChange = (
  fieldName: NumberFieldName,
  value: string,
) => void;

type AuraPlacementPropertiesDraft = Record<NumberFieldName, string>;

const auraPlacementSizeNumberFields = [
  { label: "Width", min: "10", name: "width" },
  { label: "Height", min: "10", name: "height" },
] as const;

const auraPlacementScaleNumberField = {
  label: "Scale",
  max: String(AuraPlacementScaleSettings.maxScale),
  min: String(AuraPlacementScaleSettings.minScale),
  name: "scale",
  step: "0.1",
} as const;

function resolvePointSampleSize(placement: OverlayPlacement): number {
  return clamp(
    Math.round(
      placement.pointSampleSize ?? AuraPointPlacementSettings.defaultSampleSize,
    ),
    AuraPointPlacementSettings.minSampleSize,
    AuraPointPlacementSettings.maxSampleSize,
  );
}

function createPropertiesDraft(
  centerOffsetX: number,
  centerOffsetY: number,
  displayWidth: number,
  displayHeight: number,
  placement: OverlayPlacement,
  thickness: number | null,
): AuraPlacementPropertiesDraft {
  return {
    contentZoomPercent: String(
      placement.contentZoomPercent ??
        AuraPlacementContentZoomSettings.defaultPercent,
    ),
    cornerRadius: String(
      placement.cornerRadius ?? AuraPlacementEffectSettings.defaultCornerRadius,
    ),
    height: String(Math.round(displayHeight)),
    iconOffsetX: String(placement.iconOffsetX ?? 0),
    iconOffsetY: String(placement.iconOffsetY ?? 0),
    opacity: String(Number(placement.opacity.toFixed(2))),
    outlineThickness: String(
      placement.outlineThickness ??
        AuraPlacementEffectSettings.defaultOutlineThickness,
    ),
    pointGap: String(
      placement.pointGap ?? AuraPointPlacementSettings.defaultGap,
    ),
    pointSampleSize: String(resolvePointSampleSize(placement)),
    scale: String(Number(resolvePlacementScale(placement).toFixed(2))),
    shadowSpread: String(
      placement.shadowSpread ?? AuraPlacementEffectSettings.defaultShadowSpread,
    ),
    thickness: thickness !== null ? String(thickness) : "",
    width: String(Math.round(displayWidth)),
    x: String(Math.round(centerOffsetX)),
    y: String(Math.round(centerOffsetY)),
  };
}

function createCurrentNumericValues(
  centerOffsetX: number,
  centerOffsetY: number,
  displayWidth: number,
  displayHeight: number,
  placement: OverlayPlacement,
  thickness: number | null,
): Record<NumberFieldName, number | null> {
  return {
    contentZoomPercent:
      placement.contentZoomPercent ??
      AuraPlacementContentZoomSettings.defaultPercent,
    cornerRadius: placement.cornerRadius ?? null,
    height: Math.round(displayHeight),
    iconOffsetX: placement.iconOffsetX ?? 0,
    iconOffsetY: placement.iconOffsetY ?? 0,
    opacity: Number(placement.opacity.toFixed(2)),
    outlineThickness: placement.outlineThickness ?? null,
    pointGap: placement.pointGap ?? AuraPointPlacementSettings.defaultGap,
    pointSampleSize: resolvePointSampleSize(placement),
    scale: Number(resolvePlacementScale(placement).toFixed(2)),
    shadowSpread: placement.shadowSpread ?? null,
    thickness,
    width: Math.round(displayWidth),
    x: Math.round(centerOffsetX),
    y: Math.round(centerOffsetY),
  };
}

function normalizeNumberInputValue(
  fieldName: NumberFieldName,
  value: string,
): number | null {
  return normalizeAuraPlacementNumberValue(fieldName, value);
}

function createNumberFieldPatch(
  fieldName: NumberFieldName,
  value: number,
  recordHistory: boolean,
): AuraPlacementPropertiesPatch {
  if (fieldName === "contentZoomPercent") {
    return { contentZoomPercent: value, recordHistory };
  }

  if (fieldName === "width") {
    return { displayWidth: value, recordHistory };
  }

  if (fieldName === "height") {
    return { displayHeight: value, recordHistory };
  }

  if (fieldName === "x") {
    return { centerOffsetX: value, recordHistory };
  }

  if (fieldName === "y") {
    return { centerOffsetY: value, recordHistory };
  }

  if (fieldName === "iconOffsetX") {
    return { iconOffsetX: value, recordHistory };
  }

  if (fieldName === "iconOffsetY") {
    return { iconOffsetY: value, recordHistory };
  }

  if (fieldName === "scale") {
    return { recordHistory, scale: value };
  }

  if (fieldName === "opacity") {
    return { opacity: value, recordHistory };
  }

  if (fieldName === "outlineThickness") {
    return { outlineThickness: value, recordHistory };
  }

  if (fieldName === "cornerRadius") {
    return { cornerRadius: value, recordHistory };
  }

  if (fieldName === "shadowSpread") {
    return { recordHistory, shadowSpread: value };
  }

  if (fieldName === "pointSampleSize") {
    return { pointSampleSize: value, recordHistory };
  }

  if (fieldName === "pointGap") {
    return { pointGap: value, recordHistory };
  }

  return { arcVisibleThickness: value, recordHistory };
}

function readNumberFieldName(value: string): NumberFieldName | null {
  if (
    value === "contentZoomPercent" ||
    value === "cornerRadius" ||
    value === "height" ||
    value === "iconOffsetX" ||
    value === "iconOffsetY" ||
    value === "opacity" ||
    value === "outlineThickness" ||
    value === "pointGap" ||
    value === "pointSampleSize" ||
    value === "scale" ||
    value === "shadowSpread" ||
    value === "thickness" ||
    value === "width" ||
    value === "x" ||
    value === "y"
  ) {
    return value;
  }

  return null;
}

function resolveNextRotationDegrees(
  rotation: AuraRotationDegrees = 0,
): AuraRotationDegrees {
  const rotationIndex = auraRotationDegrees.indexOf(rotation);

  return (
    auraRotationDegrees[(rotationIndex + 1) % auraRotationDegrees.length] ?? 0
  );
}

function resolvePlacementScale(placement: OverlayPlacement): number {
  return clamp(
    placement.scale,
    AuraPlacementScaleSettings.minScale,
    AuraPlacementScaleSettings.maxScale,
  );
}

function resolveAuraPlacementPropertiesPanelLayout(
  anchor: AuraPlacementPropertiesPanelBounds,
  panel: AuraSize,
  viewport: AuraSize,
): AuraPlacementPropertiesPanelLayout {
  const gap = 8;
  const margin = 8;
  const maxHeight = Math.max(0, viewport.height - margin * 2);
  const panelHeight = Math.min(panel.height, maxHeight);
  const candidates = [
    { left: anchor.left + anchor.width + gap, top: anchor.top },
    { left: anchor.left - panel.width - gap, top: anchor.top },
    { left: anchor.left, top: anchor.top + anchor.height + gap },
    { left: anchor.left, top: anchor.top - panelHeight - gap },
  ];
  const fitsViewport = (candidate: { left: number; top: number }) =>
    candidate.left >= margin &&
    candidate.top >= margin &&
    candidate.left + panel.width <= viewport.width - margin &&
    candidate.top + panelHeight <= viewport.height - margin;
  const overflow = (candidate: { left: number; top: number }) =>
    Math.max(0, margin - candidate.left) +
    Math.max(0, margin - candidate.top) +
    Math.max(0, candidate.left + panel.width - viewport.width + margin) +
    Math.max(0, candidate.top + panelHeight - viewport.height + margin);
  const preferredCandidate =
    candidates.find(fitsViewport) ??
    candidates.reduce((best, candidate) =>
      overflow(candidate) < overflow(best) ? candidate : best,
    );
  const maxLeft = Math.max(margin, viewport.width - panel.width - margin);
  const maxTop = Math.max(margin, viewport.height - panelHeight - margin);

  return {
    left: Math.round(
      clamp(preferredCandidate.left, margin, maxLeft) - anchor.left,
    ),
    maxHeight,
    top: Math.round(clamp(preferredCandidate.top, margin, maxTop) - anchor.top),
  };
}

export type {
  AuraPlacementNumberValueChange,
  AuraPlacementPropertiesDraft,
  AuraPlacementPropertiesPanelBounds,
  AuraPlacementPropertiesPanelProps,
  AuraPlacementPropertiesPatch,
  NumberFieldName,
};
export {
  auraPlacementScaleNumberField,
  auraPlacementSizeNumberFields,
  createCurrentNumericValues,
  createNumberFieldPatch,
  createPropertiesDraft,
  normalizeNumberInputValue,
  readNumberFieldName,
  resolveAuraPlacementPropertiesPanelLayout,
  resolveNextRotationDegrees,
};
