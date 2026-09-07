import type {
  ChangeEvent,
  FocusEventHandler,
  KeyboardEventHandler,
} from "react";

import type { OverlayPlacement } from "~/types";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { AuraPlacementNameField } from "../AuraPlacementNameField/AuraPlacementNameField";
import { AuraPlacementNumberField } from "../AuraPlacementNumberField/AuraPlacementNumberField";
import { AuraPlacementPointPropertiesFields } from "../AuraPlacementPointPropertiesFields/AuraPlacementPointPropertiesFields";
import { AuraPlacementPropertiesActions } from "../AuraPlacementPropertiesActions/AuraPlacementPropertiesActions";
import {
  type AuraPlacementNumberValueChange,
  type AuraPlacementPropertiesDraft,
  type AuraPlacementPropertiesPatch,
  auraPlacementScaleNumberField,
  auraPlacementSizeNumberFields,
} from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";
import { AuraPlacementRotationField } from "../AuraPlacementRotationField/AuraPlacementRotationField";

interface AuraPlacementGeneralControlsProps {
  draft: AuraPlacementPropertiesDraft;
  label: string;
  placement: OverlayPlacement;
  pointControls: boolean;
  thickness: number | null;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
  onNameCommit: (label: string) => void;
  onNumberBlur: FocusEventHandler<HTMLInputElement>;
  onNumberFocus: FocusEventHandler<HTMLInputElement>;
  onNumberKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onNumberValueChange: AuraPlacementNumberValueChange;
}

function AuraPlacementGeneralControls({
  draft,
  label,
  placement,
  pointControls,
  thickness,
  onChange,
  onNameCommit,
  onNumberBlur,
  onNumberFocus,
  onNumberKeyDown,
  onNumberValueChange,
}: AuraPlacementGeneralControlsProps) {
  const handleHideResizeControlsChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    onChange(placement.id, {
      hideResizeControls: event.currentTarget.checked,
    });
  };

  const handleResetClick = () => {
    onChange(placement.id, { resetToDefaults: true });
  };

  return (
    <>
      <AuraPlacementNameField label={label} onCommit={onNameCommit} />
      {auraPlacementSizeNumberFields.map((field) => (
        <AuraPlacementNumberField
          key={field.name}
          {...field}
          value={draft[field.name]}
          onBlur={onNumberBlur}
          onFocus={onNumberFocus}
          onKeyDown={onNumberKeyDown}
          onValueChange={onNumberValueChange}
        />
      ))}
      <AuraPlacementNumberField
        {...auraPlacementScaleNumberField}
        value={draft.scale}
        onBlur={onNumberBlur}
        onFocus={onNumberFocus}
        onKeyDown={onNumberKeyDown}
        onValueChange={onNumberValueChange}
      />
      <AuraPlacementRotationField placement={placement} onChange={onChange} />
      {thickness !== null && (
        <AuraPlacementNumberField
          label="Thickness"
          min="1"
          name="thickness"
          value={draft.thickness}
          onBlur={onNumberBlur}
          onFocus={onNumberFocus}
          onKeyDown={onNumberKeyDown}
          onValueChange={onNumberValueChange}
        />
      )}
      {pointControls && (
        <AuraPlacementPointPropertiesFields
          draft={draft}
          onBlur={onNumberBlur}
          onFocus={onNumberFocus}
          onKeyDown={onNumberKeyDown}
          onValueChange={onNumberValueChange}
        />
      )}
      <label className={styles.propertiesToggleWide}>
        <input
          checked={placement.hideResizeControls === true}
          type="checkbox"
          onChange={handleHideResizeControlsChange}
        />
        Hide resize controls
      </label>
      <AuraPlacementPropertiesActions
        canStraighten={thickness !== null}
        placement={placement}
        onChange={onChange}
      />
      <button
        className={styles.propertiesButton}
        type="button"
        onClick={handleResetClick}
      >
        Reset to default
      </button>
    </>
  );
}

export { AuraPlacementGeneralControls };
