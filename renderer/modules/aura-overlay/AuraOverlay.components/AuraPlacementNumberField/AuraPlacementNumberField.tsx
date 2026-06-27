import type {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
} from "react";

import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import type { NumberFieldName } from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";

interface AuraPlacementNumberFieldProps {
  label: string;
  name: NumberFieldName;
  value: string;
  max?: string;
  min: string;
  step?: string;
  onBlur: FocusEventHandler<HTMLInputElement>;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onFocus: FocusEventHandler<HTMLInputElement>;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
}

function AuraPlacementNumberField({
  label,
  max,
  min,
  name,
  step,
  value,
  onBlur,
  onChange,
  onFocus,
  onKeyDown,
}: AuraPlacementNumberFieldProps) {
  return (
    <label className={styles.propertiesField}>
      {label}
      <input
        className={styles.propertiesInput}
        max={max}
        min={min}
        name={name}
        step={step}
        type="number"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}

export { AuraPlacementNumberField };
