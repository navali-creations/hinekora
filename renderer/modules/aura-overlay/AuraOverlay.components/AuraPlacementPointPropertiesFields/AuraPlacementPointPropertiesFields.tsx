import type { FocusEventHandler, KeyboardEventHandler } from "react";

import { AuraPointPlacementSettings } from "~/types";
import { AuraPlacementNumberField } from "../AuraPlacementNumberField/AuraPlacementNumberField";
import type {
  AuraPlacementNumberValueChange,
  AuraPlacementPropertiesDraft,
} from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";

interface AuraPlacementPointPropertiesFieldsProps {
  draft: AuraPlacementPropertiesDraft;
  onBlur: FocusEventHandler<HTMLInputElement>;
  onFocus: FocusEventHandler<HTMLInputElement>;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onValueChange: AuraPlacementNumberValueChange;
}

function AuraPlacementPointPropertiesFields({
  draft,
  onBlur,
  onFocus,
  onKeyDown,
  onValueChange,
}: AuraPlacementPointPropertiesFieldsProps) {
  return (
    <>
      <AuraPlacementNumberField
        label="Thickness"
        max={String(AuraPointPlacementSettings.maxSampleSize)}
        min={String(AuraPointPlacementSettings.minSampleSize)}
        name="pointSampleSize"
        value={draft.pointSampleSize}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onValueChange={onValueChange}
      />
      <AuraPlacementNumberField
        label="Spacing"
        max={String(AuraPointPlacementSettings.maxGap)}
        min={String(AuraPointPlacementSettings.minGap)}
        name="pointGap"
        value={draft.pointGap}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onValueChange={onValueChange}
      />
    </>
  );
}

export { AuraPlacementPointPropertiesFields };
