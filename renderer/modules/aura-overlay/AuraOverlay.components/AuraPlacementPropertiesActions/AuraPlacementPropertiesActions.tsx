import type { ChangeEvent } from "react";

import type { OverlayPlacement } from "~/types";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import type { AuraPlacementPropertiesPatch } from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";

interface AuraPlacementPropertiesActionsProps {
  canStraighten: boolean;
  placement: OverlayPlacement;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
}

function AuraPlacementPropertiesActions({
  canStraighten,
  placement,
  onChange,
}: AuraPlacementPropertiesActionsProps) {
  const handleMirrorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(placement.id, { mirrored: event.currentTarget.checked });
  };

  const handleStraightenChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(placement.id, { arcStraightened: event.currentTarget.checked });
  };

  return (
    <div className={styles.propertiesActions}>
      <label className={styles.propertiesToggle}>
        <input
          checked={placement.mirrored === true}
          type="checkbox"
          onChange={handleMirrorChange}
        />
        Mirror
      </label>
      {canStraighten && (
        <label className={styles.propertiesToggle}>
          <input
            checked={placement.arcStraightened === true}
            type="checkbox"
            onChange={handleStraightenChange}
          />
          Straighten
        </label>
      )}
    </div>
  );
}

export { AuraPlacementPropertiesActions };
