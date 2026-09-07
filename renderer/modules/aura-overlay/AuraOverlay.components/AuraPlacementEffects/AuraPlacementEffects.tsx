import { type CSSProperties, useId } from "react";

import {
  AuraPlacementEffectSettings,
  type CropRegion,
  type OverlayPlacement,
} from "~/types";
import type { AuraSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import {
  auraShadowBlurStandardDeviation,
  createAuraPlacementEffectGeometry,
  resolveAuraPlacementEffectPadding,
} from "./AuraPlacementEffects.utils";

interface AuraPlacementEffectsProps {
  contentStyle: CSSProperties;
  crop: CropRegion;
  displaySize: AuraSize;
  isStraightenedArc: boolean;
  placement: OverlayPlacement;
  visibleThickness?: number;
}

function AuraPlacementEffects({
  contentStyle,
  crop,
  displaySize,
  isStraightenedArc,
  placement,
  visibleThickness,
}: AuraPlacementEffectsProps) {
  const generatedId = useId();
  const filterId = `aura-effects-${generatedId.replaceAll(":", "")}`;
  const outlineThickness = placement.outlineThickness;
  const shadowSpread = placement.shadowSpread;
  if (outlineThickness === undefined && shadowSpread === undefined) {
    return null;
  }

  const geometry = createAuraPlacementEffectGeometry(
    crop,
    displaySize,
    isStraightenedArc,
    visibleThickness,
    placement.clipShape,
  );
  const padding = resolveAuraPlacementEffectPadding(placement);

  return (
    <svg
      aria-hidden="true"
      className={styles.placementEffects}
      data-aura-effects
      data-effect-shape={geometry.shape}
      style={contentStyle}
      viewBox={`0 0 ${displaySize.width} ${displaySize.height}`}
    >
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          height={displaySize.height + padding * 2}
          id={filterId}
          width={displaySize.width + padding * 2}
          x={-padding}
          y={-padding}
        >
          {shadowSpread !== undefined && (
            <>
              <feGaussianBlur
                in="SourceAlpha"
                result="shadow-blur"
                stdDeviation={auraShadowBlurStandardDeviation}
              />
              <feMorphology
                in="shadow-blur"
                operator="dilate"
                radius={shadowSpread}
                result="shadow-shape"
              />
              <feFlood
                data-effect="shadow"
                floodColor={
                  placement.shadowColor ??
                  AuraPlacementEffectSettings.defaultShadowColor
                }
                floodOpacity="0.72"
                result="shadow-color"
              />
              <feComposite
                in="shadow-color"
                in2="shadow-shape"
                operator="in"
                result="shadow"
              />
            </>
          )}
          {outlineThickness !== undefined && (
            <>
              <feMorphology
                in="SourceAlpha"
                operator="dilate"
                radius={outlineThickness}
                result="outline-expanded"
              />
              <feComposite
                in="outline-expanded"
                in2="SourceAlpha"
                operator="out"
                result="outline-ring"
              />
              <feFlood
                data-effect="outline"
                floodColor={
                  placement.outlineColor ??
                  AuraPlacementEffectSettings.defaultOutlineColor
                }
                result="outline-color"
              />
              <feComposite
                in="outline-color"
                in2="outline-ring"
                operator="in"
                result="outline"
              />
            </>
          )}
          <feMerge>
            {shadowSpread !== undefined && <feMergeNode in="shadow" />}
            {outlineThickness !== undefined && <feMergeNode in="outline" />}
          </feMerge>
        </filter>
      </defs>
      {geometry.shape === "circle" ? (
        <ellipse
          cx={displaySize.width / 2}
          cy={displaySize.height / 2}
          fill="white"
          filter={`url(#${filterId})`}
          rx={displaySize.width / 2}
          ry={displaySize.height / 2}
        />
      ) : geometry.polygonPoints ? (
        <polygon
          fill="white"
          filter={`url(#${filterId})`}
          points={geometry.polygonPoints}
        />
      ) : (
        <rect
          fill="white"
          filter={`url(#${filterId})`}
          height={displaySize.height}
          rx={placement.cornerRadius ?? 0}
          width={displaySize.width}
        />
      )}
    </svg>
  );
}

export { AuraPlacementEffects };
