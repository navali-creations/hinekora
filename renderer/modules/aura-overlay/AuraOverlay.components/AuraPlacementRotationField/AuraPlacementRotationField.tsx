import type { OverlayPlacement } from "~/types";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import {
  type AuraPlacementPropertiesPatch,
  resolveNextRotationDegrees,
} from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";

interface AuraPlacementRotationFieldProps {
  placement: OverlayPlacement;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
}

function AuraPlacementRotationField({
  placement,
  onChange,
}: AuraPlacementRotationFieldProps) {
  const handleRotateClick = () => {
    onChange(placement.id, {
      rotationDegrees: resolveNextRotationDegrees(placement.rotationDegrees),
    });
  };

  return (
    <label className={styles.propertiesField}>
      Rotate
      <button
        aria-label="Rotate aura"
        className={styles.propertiesRotationButton}
        type="button"
        onClick={handleRotateClick}
      >
        {placement.rotationDegrees ?? 0} deg
      </button>
    </label>
  );
}

export { AuraPlacementRotationField };
