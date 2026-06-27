import type { OverlayPlacement } from "~/types";

type AuraPlacementPropertiesPanelSide = "bottom" | "left" | "right" | "top";

interface AuraPlacementPropertiesPatch {
  arcStraightened?: boolean;
  arcVisibleThickness?: number;
  displayHeight?: number;
  displayWidth?: number;
  mirrored?: boolean;
  rotationDegrees?: RotationDegrees;
  scale?: number;
}

type NumberFieldName = "height" | "scale" | "thickness" | "width";

type RotationDegrees = 0 | 90 | 180 | 270;

type AuraPlacementPropertiesDraft = Record<NumberFieldName, string>;

const rotationSteps = [0, 90, 180, 270] as const;

function createPropertiesDraft(
  displayWidth: number,
  displayHeight: number,
  placement: OverlayPlacement,
  thickness: number | null,
): AuraPlacementPropertiesDraft {
  return {
    height: String(Math.round(displayHeight)),
    scale: String(Number(placement.scale.toFixed(2))),
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
    scale: Number(placement.scale.toFixed(2)),
    thickness,
    width: Math.round(displayWidth),
  };
}

function normalizeNumberInputValue(
  fieldName: NumberFieldName,
  value: string,
): number | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (fieldName === "scale") {
    return clamp(Math.round(numericValue * 100) / 100, 0.1, 8);
  }

  return Math.round(Math.max(1, numericValue));
}

function readNumberFieldName(value: string): NumberFieldName | null {
  if (
    value === "height" ||
    value === "scale" ||
    value === "thickness" ||
    value === "width"
  ) {
    return value;
  }

  return null;
}

function resolveNextRotationDegrees(
  rotation: RotationDegrees = 0,
): RotationDegrees {
  const rotationIndex = rotationSteps.indexOf(rotation);

  return rotationSteps[(rotationIndex + 1) % rotationSteps.length] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type {
  AuraPlacementPropertiesPanelSide,
  AuraPlacementPropertiesPatch,
  NumberFieldName,
  RotationDegrees,
};
export {
  createCurrentNumericValues,
  createPropertiesDraft,
  normalizeNumberInputValue,
  readNumberFieldName,
  resolveNextRotationDegrees,
};
