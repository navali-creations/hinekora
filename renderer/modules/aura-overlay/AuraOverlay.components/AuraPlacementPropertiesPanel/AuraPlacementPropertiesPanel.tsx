import clsx from "clsx";
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { OverlayPlacement } from "~/types";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { AuraPlacementNumberField } from "../AuraPlacementNumberField/AuraPlacementNumberField";
import { AuraPlacementPropertiesActions } from "../AuraPlacementPropertiesActions/AuraPlacementPropertiesActions";
import {
  type AuraPlacementPropertiesPanelSide,
  type AuraPlacementPropertiesPatch,
  createCurrentNumericValues,
  createPropertiesDraft,
  type NumberFieldName,
  normalizeNumberInputValue,
  readNumberFieldName,
  resolveNextRotationDegrees,
} from "./AuraPlacementPropertiesPanel.utils";

interface AuraPlacementPropertiesPanelProps {
  displayHeight: number;
  displayWidth: number;
  placement: OverlayPlacement;
  side: AuraPlacementPropertiesPanelSide;
  visibleThickness?: number;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
}

const panelSideClassNames: Record<AuraPlacementPropertiesPanelSide, string> = {
  bottom: styles.propertiesPanelBottom ?? "",
  left: styles.propertiesPanelLeft ?? "",
  right: styles.propertiesPanelRight ?? "",
  top: styles.propertiesPanelTop ?? "",
};

function AuraPlacementPropertiesPanel({
  displayHeight,
  displayWidth,
  placement,
  side,
  visibleThickness,
  onChange,
}: AuraPlacementPropertiesPanelProps) {
  const thickness = visibleThickness ? Math.round(visibleThickness) : null;
  const activeFieldRef = useRef<NumberFieldName | null>(null);
  const [draft, setDraft] = useState(() =>
    createPropertiesDraft(displayWidth, displayHeight, placement, thickness),
  );

  useEffect(() => {
    if (activeFieldRef.current !== null) {
      return;
    }

    setDraft(
      createPropertiesDraft(displayWidth, displayHeight, placement, thickness),
    );
  }, [displayHeight, displayWidth, placement, thickness]);

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fieldName = readNumberFieldName(event.currentTarget.name);
    if (!fieldName) {
      return;
    }

    const nextValue = event.currentTarget.value;
    setDraft((currentDraft) => ({
      ...currentDraft,
      [fieldName]: nextValue,
    }));
  };

  const handleNumberFocus = (event: FocusEvent<HTMLInputElement>) => {
    const fieldName = readNumberFieldName(event.currentTarget.name);
    if (!fieldName) {
      return;
    }

    activeFieldRef.current = fieldName;
  };

  const handleNumberBlur = (event: FocusEvent<HTMLInputElement>) => {
    const fieldName = readNumberFieldName(event.currentTarget.name);
    if (!fieldName) {
      return;
    }

    commitNumberField(fieldName);
    activeFieldRef.current = null;
  };

  const handleNumberKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const fieldName = readNumberFieldName(event.currentTarget.name);
    if (!fieldName) {
      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      setDraft(
        createPropertiesDraft(
          displayWidth,
          displayHeight,
          placement,
          thickness,
        ),
      );
      event.currentTarget.blur();
    }
  };

  const handleMirrorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(placement.id, { mirrored: event.currentTarget.checked });
  };

  const handleStraightenChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(placement.id, { arcStraightened: event.currentTarget.checked });
  };

  const handleRotateClick = () => {
    onChange(placement.id, {
      rotationDegrees: resolveNextRotationDegrees(placement.rotationDegrees),
    });
  };

  const commitNumberField = (fieldName: NumberFieldName) => {
    const currentValue = createCurrentNumericValues(
      displayWidth,
      displayHeight,
      placement,
      thickness,
    )[fieldName];
    const normalizedValue = normalizeNumberInputValue(
      fieldName,
      draft[fieldName],
    );
    if (
      normalizedValue === null ||
      (currentValue !== null &&
        Math.abs(normalizedValue - currentValue) < Number.EPSILON)
    ) {
      setDraft(
        createPropertiesDraft(
          displayWidth,
          displayHeight,
          placement,
          thickness,
        ),
      );
      return;
    }

    if (fieldName === "width") {
      onChange(placement.id, { displayWidth: normalizedValue });
      return;
    }

    if (fieldName === "height") {
      onChange(placement.id, { displayHeight: normalizedValue });
      return;
    }

    if (fieldName === "scale") {
      onChange(placement.id, { scale: normalizedValue });
      return;
    }

    onChange(placement.id, { arcVisibleThickness: normalizedValue });
  };

  return (
    <section
      aria-label="Aura placement properties"
      className={clsx(styles.propertiesPanel, panelSideClassNames[side])}
    >
      <AuraPlacementNumberField
        label="Width"
        min="1"
        name="width"
        value={draft.width}
        onChange={handleNumberChange}
        onBlur={handleNumberBlur}
        onFocus={handleNumberFocus}
        onKeyDown={handleNumberKeyDown}
      />
      <AuraPlacementNumberField
        label="Height"
        min="1"
        name="height"
        value={draft.height}
        onChange={handleNumberChange}
        onBlur={handleNumberBlur}
        onFocus={handleNumberFocus}
        onKeyDown={handleNumberKeyDown}
      />
      <AuraPlacementNumberField
        label="Scale"
        max="8"
        min="0.1"
        name="scale"
        step="0.1"
        value={draft.scale}
        onChange={handleNumberChange}
        onBlur={handleNumberBlur}
        onFocus={handleNumberFocus}
        onKeyDown={handleNumberKeyDown}
      />
      {thickness !== null && (
        <AuraPlacementNumberField
          label="Thickness"
          min="1"
          name="thickness"
          value={draft.thickness}
          onChange={handleNumberChange}
          onBlur={handleNumberBlur}
          onFocus={handleNumberFocus}
          onKeyDown={handleNumberKeyDown}
        />
      )}
      <AuraPlacementPropertiesActions
        arcStraightened={placement.arcStraightened === true}
        mirrored={placement.mirrored === true}
        rotationDegrees={placement.rotationDegrees ?? 0}
        onMirrorChange={handleMirrorChange}
        onRotateClick={handleRotateClick}
        onStraightenChange={handleStraightenChange}
      />
    </section>
  );
}

export type { AuraPlacementPropertiesPanelSide, AuraPlacementPropertiesPatch };
export { AuraPlacementPropertiesPanel };
