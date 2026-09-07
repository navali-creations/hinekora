import type { CropRegion, OverlayPlacement } from "~/types";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import {
  AuraPlacementPropertiesPanel,
  type AuraPlacementPropertiesPatch,
} from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";

interface AuraOverlayPlacementDetailsProps {
  auraOverlayLocked: boolean;
  canEditAuras: boolean;
  centerOffsetX: number;
  centerOffsetY: number;
  crop: CropRegion;
  displayHeight: number;
  displayWidth: number;
  isResizing: boolean;
  isSelected: boolean;
  isThicknessResizing: boolean;
  left: number;
  placement: OverlayPlacement;
  showClipShapeControls: boolean;
  top: number;
  visibleThickness: number | undefined;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
}

function AuraOverlayPlacementDetails({
  auraOverlayLocked,
  canEditAuras,
  centerOffsetX,
  centerOffsetY,
  crop,
  displayHeight,
  displayWidth,
  isResizing,
  isSelected,
  isThicknessResizing,
  left,
  placement,
  showClipShapeControls,
  top,
  visibleThickness,
  onChange,
}: AuraOverlayPlacementDetailsProps) {
  return (
    <>
      {!auraOverlayLocked && (
        <span className={styles.label} data-aura-label>
          {crop.label}
        </span>
      )}
      {!auraOverlayLocked && isResizing && (
        <span className={styles.resizeReadout}>
          x: {left} y: {top}
          <br />
          {displayWidth} x {displayHeight}
        </span>
      )}
      {!auraOverlayLocked &&
        isThicknessResizing &&
        visibleThickness !== undefined && (
          <span className={styles.resizeReadout}>
            thickness: {Math.round(visibleThickness)}px
          </span>
        )}
      {!auraOverlayLocked && canEditAuras && isSelected && (
        <AuraPlacementPropertiesPanel
          anchorBounds={{
            height: displayHeight,
            left,
            top,
            width: displayWidth,
          }}
          centerOffsetX={centerOffsetX}
          centerOffsetY={centerOffsetY}
          displayHeight={displayHeight}
          displayWidth={displayWidth}
          label={crop.label}
          placement={placement}
          pointControls={crop.shape === "points"}
          showClipShapeControls={showClipShapeControls}
          {...(visibleThickness !== undefined ? { visibleThickness } : {})}
          onChange={onChange}
        />
      )}
    </>
  );
}

export { AuraOverlayPlacementDetails };
