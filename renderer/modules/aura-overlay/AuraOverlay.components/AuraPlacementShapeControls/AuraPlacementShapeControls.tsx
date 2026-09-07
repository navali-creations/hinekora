import type { MouseEvent } from "react";
import { LuCircle, LuOctagon, LuShield, LuSquare } from "react-icons/lu";

import { AuraPlacementClipShapeSchema, type OverlayPlacement } from "~/types";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import type { AuraPlacementPropertiesPatch } from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";

interface AuraPlacementShapeControlsProps {
  placement: OverlayPlacement;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
}

const shapeOptions = [
  { Icon: LuSquare, label: "Default", value: "default" },
  { Icon: LuCircle, label: "Circle", value: "circle" },
  { Icon: LuShield, label: "Shield", value: "shield" },
  { Icon: LuOctagon, label: "Octagon", value: "octagon" },
] as const;

function AuraPlacementShapeControls({
  placement,
  onChange,
}: AuraPlacementShapeControlsProps) {
  const handleShapeClick = (event: MouseEvent<HTMLButtonElement>) => {
    const value = event.currentTarget.dataset.shape;
    if (value === "default") {
      onChange(placement.id, { clipShape: null });
      return;
    }

    const clipShape = AuraPlacementClipShapeSchema.safeParse(value);
    if (clipShape.success) {
      onChange(placement.id, { clipShape: clipShape.data });
    }
  };

  return (
    <fieldset aria-label="Aura shape" className={styles.propertiesShapeField}>
      <legend>Shape</legend>
      <div className={styles.propertiesShapeRow}>
        {shapeOptions.map((option) => {
          const ShapeIcon = option.Icon;
          const active =
            option.value === "default"
              ? placement.clipShape === undefined
              : placement.clipShape === option.value;

          return (
            <button
              aria-label={`Use ${option.label.toLowerCase()} aura shape`}
              aria-pressed={active}
              className={styles.propertiesShapeButton}
              data-shape={option.value}
              key={option.value}
              title={option.label}
              type="button"
              onClick={handleShapeClick}
            >
              <ShapeIcon
                aria-hidden="true"
                className={styles.propertiesShapeIcon}
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export { AuraPlacementShapeControls };
