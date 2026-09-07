import { useEffect, useRef } from "react";

import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";

interface AuraPlacementColorFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}

function AuraPlacementColorField({
  label,
  value,
  onCommit,
}: AuraPlacementColorFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const handleNativeChange = () => {
      onCommit(input.value);
      input.blur();
    };
    input.addEventListener("change", handleNativeChange);

    return () => {
      input.removeEventListener("change", handleNativeChange);
    };
  }, [onCommit]);

  return (
    <label className={styles.propertiesColorField}>
      Color
      <input
        aria-label={label}
        className={styles.propertiesColorInput}
        defaultValue={value}
        ref={inputRef}
        type="color"
      />
    </label>
  );
}

export { AuraPlacementColorField };
