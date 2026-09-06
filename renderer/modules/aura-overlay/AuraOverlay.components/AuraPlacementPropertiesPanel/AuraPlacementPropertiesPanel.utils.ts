import {
  AuraPlacementScaleSettings,
  AuraPointPlacementSettings,
  type OverlayPlacement,
} from "~/types";
import {
  type AuraRotationDegrees,
  type AuraSize,
  auraRotationDegrees,
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
  displayHeight?: number;
  displayWidth?: number;
  label?: string;
  mirrored?: boolean;
  opacity?: number;
  pointGap?: number;
  pointSampleSize?: number;
  recordHistory?: boolean;
  rotationDegrees?: AuraRotationDegrees;
  scale?: number;
}

type NumberFieldName =
  | "height"
  | "opacity"
  | "pointGap"
  | "pointSampleSize"
  | "scale"
  | "thickness"
  | "width";

type AuraPlacementPropertiesDraft = Record<NumberFieldName, string>;

const auraPlacementBaseNumberFields = [
  { label: "Width", min: "10", name: "width" },
  { label: "Height", min: "10", name: "height" },
  {
    label: "Scale",
    max: String(AuraPlacementScaleSettings.maxScale),
    min: String(AuraPlacementScaleSettings.minScale),
    name: "scale",
    step: "0.1",
  },
  { label: "Opacity", max: "1", min: "0", name: "opacity", step: "0.05" },
] as const;

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
  displayWidth: number,
  displayHeight: number,
  placement: OverlayPlacement,
  thickness: number | null,
): AuraPlacementPropertiesDraft {
  return {
    height: String(Math.round(displayHeight)),
    opacity: String(Number(placement.opacity.toFixed(2))),
    pointGap: String(
      placement.pointGap ?? AuraPointPlacementSettings.defaultGap,
    ),
    pointSampleSize: String(resolvePointSampleSize(placement)),
    scale: String(Number(resolvePlacementScale(placement).toFixed(2))),
    thickness: thickness !== null ? String(thickness) : "",
    width: String(Math.round(displayWidth)),
  };
}

function createCurrentNumericValues(
  displayWidth: number,
  displayHeight: number,
  placement: OverlayPlacement,
  thickness: number | null,
): Record<NumberFieldName, number | null> {
  return {
    height: Math.round(displayHeight),
    opacity: Number(placement.opacity.toFixed(2)),
    pointGap: placement.pointGap ?? AuraPointPlacementSettings.defaultGap,
    pointSampleSize: resolvePointSampleSize(placement),
    scale: Number(resolvePlacementScale(placement).toFixed(2)),
    thickness,
    width: Math.round(displayWidth),
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
  if (fieldName === "width") {
    return { displayWidth: value, recordHistory };
  }

  if (fieldName === "height") {
    return { displayHeight: value, recordHistory };
  }

  if (fieldName === "scale") {
    return { recordHistory, scale: value };
  }

  if (fieldName === "opacity") {
    return { opacity: value, recordHistory };
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
    value === "height" ||
    value === "opacity" ||
    value === "pointGap" ||
    value === "pointSampleSize" ||
    value === "scale" ||
    value === "thickness" ||
    value === "width"
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
  AuraPlacementPropertiesDraft,
  AuraPlacementPropertiesPanelBounds,
  AuraPlacementPropertiesPatch,
  NumberFieldName,
};
export {
  auraPlacementBaseNumberFields,
  createCurrentNumericValues,
  createNumberFieldPatch,
  createPropertiesDraft,
  normalizeNumberInputValue,
  readNumberFieldName,
  resolveAuraPlacementPropertiesPanelLayout,
  resolveNextRotationDegrees,
};
