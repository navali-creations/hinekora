import {
  AuraPlacementContentZoomSettings,
  AuraPlacementEffectSettings,
  AuraPlacementScaleSettings,
  AuraPointPlacementSettings,
} from "~/types";
import { clamp } from "../clamp/clamp";

type AuraPlacementNumberField =
  | "arcVisibleThickness"
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

function normalizeAuraPlacementNumberValue(
  field: AuraPlacementNumberField,
  value: string,
): number | null {
  if (value.trim() === "") {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (field === "scale") {
    return clamp(
      Math.round(numericValue * 100) / 100,
      AuraPlacementScaleSettings.minScale,
      AuraPlacementScaleSettings.maxScale,
    );
  }

  if (field === "opacity") {
    return clamp(Math.round(numericValue * 100) / 100, 0, 1);
  }

  if (field === "contentZoomPercent") {
    return Math.round(
      clamp(
        numericValue,
        AuraPlacementContentZoomSettings.minPercent,
        AuraPlacementContentZoomSettings.maxPercent,
      ),
    );
  }

  if (field === "pointGap") {
    return Math.round(
      clamp(
        numericValue,
        AuraPointPlacementSettings.minGap,
        AuraPointPlacementSettings.maxGap,
      ),
    );
  }

  if (field === "pointSampleSize") {
    return Math.round(
      clamp(
        numericValue,
        AuraPointPlacementSettings.minSampleSize,
        AuraPointPlacementSettings.maxSampleSize,
      ),
    );
  }

  if (field === "height" || field === "width") {
    return Math.round(Math.max(10, numericValue));
  }

  if (field === "outlineThickness") {
    return Math.round(
      clamp(
        numericValue,
        AuraPlacementEffectSettings.minOutlineThickness,
        AuraPlacementEffectSettings.maxOutlineThickness,
      ),
    );
  }

  if (field === "cornerRadius") {
    return Math.round(
      clamp(
        numericValue,
        AuraPlacementEffectSettings.minCornerRadius,
        AuraPlacementEffectSettings.maxCornerRadius,
      ),
    );
  }

  if (field === "shadowSpread") {
    return Math.round(
      clamp(
        numericValue,
        AuraPlacementEffectSettings.minShadowSpread,
        AuraPlacementEffectSettings.maxShadowSpread,
      ),
    );
  }

  const minimum =
    field === "arcVisibleThickness" || field === "thickness" ? 1 : -100_000;

  return clamp(Math.round(numericValue), minimum, 100_000);
}

export { normalizeAuraPlacementNumberValue };
