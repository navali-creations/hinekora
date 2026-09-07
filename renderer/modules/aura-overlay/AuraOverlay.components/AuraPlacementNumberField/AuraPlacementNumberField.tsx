import type {
  ChangeEvent,
  FocusEventHandler,
  KeyboardEvent,
  KeyboardEventHandler,
} from "react";
import { useEffect, useRef } from "react";

import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import type {
  AuraPlacementNumberValueChange,
  NumberFieldName,
} from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";

interface AuraPlacementNumberFieldProps {
  label: string;
  name: NumberFieldName;
  value: string;
  max?: string;
  min: string;
  step?: string;
  onBlur: FocusEventHandler<HTMLInputElement>;
  onFocus: FocusEventHandler<HTMLInputElement>;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onValueChange: AuraPlacementNumberValueChange;
}

function AuraPlacementNumberField({
  label,
  max,
  min,
  name,
  step,
  value,
  onBlur,
  onFocus,
  onKeyDown,
  onValueChange,
}: AuraPlacementNumberFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      input.focus({ preventScroll: true });
      if (event.deltaY < 0) {
        input.stepUp();
      } else {
        input.stepDown();
      }
      onValueChange(name, input.value);
    };
    input.addEventListener("wheel", handleWheel, { passive: false });

    return () => input.removeEventListener("wheel", handleWheel);
  }, [name, onValueChange]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(name, event.currentTarget.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "e" || event.key === "E") {
      event.preventDefault();
      return;
    }

    onKeyDown(event);
  };

  return (
    <label className={styles.propertiesField}>
      {label}
      <input
        className={styles.propertiesInput}
        max={max}
        min={min}
        name={name}
        ref={inputRef}
        step={step}
        type="number"
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
      />
    </label>
  );
}

export { AuraPlacementNumberField };
