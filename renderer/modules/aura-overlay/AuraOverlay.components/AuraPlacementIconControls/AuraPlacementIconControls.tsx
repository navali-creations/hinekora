import type { FocusEventHandler, KeyboardEventHandler } from "react";

import {
  AuraPlacementContentZoomSettings,
  type OverlayPlacement,
} from "~/types";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { AuraPlacementNumberField } from "../AuraPlacementNumberField/AuraPlacementNumberField";
import type {
  AuraPlacementNumberValueChange,
  AuraPlacementPropertiesDraft,
  AuraPlacementPropertiesPatch,
} from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";
import { AuraPlacementShapeControls } from "../AuraPlacementShapeControls/AuraPlacementShapeControls";

interface AuraPlacementIconControlsProps {
  draft: AuraPlacementPropertiesDraft;
  placement: OverlayPlacement;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
  onNumberBlur: FocusEventHandler<HTMLInputElement>;
  onNumberFocus: FocusEventHandler<HTMLInputElement>;
  onNumberKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onNumberValueChange: AuraPlacementNumberValueChange;
}

function AuraPlacementIconControls({
  draft,
  placement,
  onChange,
  onNumberBlur,
  onNumberFocus,
  onNumberKeyDown,
  onNumberValueChange,
}: AuraPlacementIconControlsProps) {
  return (
    <section aria-label="Icon properties" className={styles.propertiesIcon}>
      <AuraPlacementShapeControls placement={placement} onChange={onChange} />
      <AuraPlacementNumberField
        label="Offset X"
        max="100000"
        min="-100000"
        name="iconOffsetX"
        step="1"
        value={draft.iconOffsetX}
        onBlur={onNumberBlur}
        onFocus={onNumberFocus}
        onKeyDown={onNumberKeyDown}
        onValueChange={onNumberValueChange}
      />
      <AuraPlacementNumberField
        label="Offset Y"
        max="100000"
        min="-100000"
        name="iconOffsetY"
        step="1"
        value={draft.iconOffsetY}
        onBlur={onNumberBlur}
        onFocus={onNumberFocus}
        onKeyDown={onNumberKeyDown}
        onValueChange={onNumberValueChange}
      />
      <div className={styles.propertiesContentZoom}>
        <AuraPlacementNumberField
          label="Icon zoom (%)"
          max={String(AuraPlacementContentZoomSettings.maxPercent)}
          min={String(AuraPlacementContentZoomSettings.minPercent)}
          name="contentZoomPercent"
          step="5"
          value={draft.contentZoomPercent}
          onBlur={onNumberBlur}
          onFocus={onNumberFocus}
          onKeyDown={onNumberKeyDown}
          onValueChange={onNumberValueChange}
        />
      </div>
    </section>
  );
}

export { AuraPlacementIconControls };
