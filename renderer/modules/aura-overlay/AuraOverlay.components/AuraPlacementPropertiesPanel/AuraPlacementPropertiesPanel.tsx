import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { OverlayPlacement } from "~/types";
import { useAuraPlacementPropertiesPanelLayout } from "../../AuraOverlay.hooks/useAuraPlacementPropertiesPanelLayout/useAuraPlacementPropertiesPanelLayout";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { AuraPlacementNameField } from "../AuraPlacementNameField/AuraPlacementNameField";
import { AuraPlacementNumberField } from "../AuraPlacementNumberField/AuraPlacementNumberField";
import { AuraPlacementPointPropertiesFields } from "../AuraPlacementPointPropertiesFields/AuraPlacementPointPropertiesFields";
import { AuraPlacementPropertiesActions } from "../AuraPlacementPropertiesActions/AuraPlacementPropertiesActions";
import { AuraPlacementPropertiesPanelToggle } from "../AuraPlacementPropertiesPanelToggle/AuraPlacementPropertiesPanelToggle";
import {
  type AuraPlacementPropertiesPanelBounds,
  type AuraPlacementPropertiesPatch,
  auraPlacementBaseNumberFields,
  createCurrentNumericValues,
  createNumberFieldPatch,
  createPropertiesDraft,
  type NumberFieldName,
  normalizeNumberInputValue,
  readNumberFieldName,
  resolveNextRotationDegrees,
} from "./AuraPlacementPropertiesPanel.utils";

interface AuraPlacementPropertiesPanelProps {
  anchorBounds: AuraPlacementPropertiesPanelBounds;
  displayHeight: number;
  displayWidth: number;
  label: string;
  placement: OverlayPlacement;
  pointControls?: boolean;
  visibleThickness?: number;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
}

function AuraPlacementPropertiesPanel({
  anchorBounds,
  displayHeight,
  displayWidth,
  label,
  placement,
  pointControls = false,
  visibleThickness,
  onChange,
}: AuraPlacementPropertiesPanelProps) {
  const { panelRef, panelStyle } =
    useAuraPlacementPropertiesPanelLayout(anchorBounds);
  const thickness = visibleThickness ? Math.round(visibleThickness) : null;
  const activeFieldRef = useRef<NumberFieldName | null>(null);
  const historyRecordedFieldRef = useRef<NumberFieldName | null>(null);
  const createDraft = useCallback(
    () =>
      createPropertiesDraft(displayWidth, displayHeight, placement, thickness),
    [displayHeight, displayWidth, placement, thickness],
  );
  const [draft, setDraft] = useState(createDraft);

  useEffect(() => {
    if (activeFieldRef.current !== null) {
      return;
    }

    setDraft(createDraft());
  }, [createDraft]);

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
    const shouldRecordHistory = historyRecordedFieldRef.current !== fieldName;
    const didCommit = commitNumberField(fieldName, nextValue, {
      recordHistory: shouldRecordHistory,
      resetDraftOnNoop: false,
    });
    if (didCommit && shouldRecordHistory) {
      historyRecordedFieldRef.current = fieldName;
    }
  };

  const handleNumberFocus = (event: FocusEvent<HTMLInputElement>) => {
    const fieldName = readNumberFieldName(event.currentTarget.name);
    if (!fieldName) {
      return;
    }

    activeFieldRef.current = fieldName;
    historyRecordedFieldRef.current = null;
  };

  const handleNumberBlur = (event: FocusEvent<HTMLInputElement>) => {
    const fieldName = readNumberFieldName(event.currentTarget.name);
    if (!fieldName) {
      return;
    }

    const shouldRecordHistory = historyRecordedFieldRef.current !== fieldName;
    commitNumberField(fieldName, draft[fieldName], {
      recordHistory: shouldRecordHistory,
      resetDraftOnNoop: true,
    });
    activeFieldRef.current = null;
    historyRecordedFieldRef.current = null;
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
      setDraft(createDraft());
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

  const handleNameCommit = (nextLabel: string) => {
    onChange(placement.id, { label: nextLabel });
  };

  const commitNumberField = (
    fieldName: NumberFieldName,
    value: string,
    {
      recordHistory,
      resetDraftOnNoop,
    }: { recordHistory: boolean; resetDraftOnNoop: boolean },
  ): boolean => {
    const currentValue = createCurrentNumericValues(
      displayWidth,
      displayHeight,
      placement,
      thickness,
    )[fieldName];
    const normalizedValue = normalizeNumberInputValue(fieldName, value);
    if (
      normalizedValue === null ||
      (currentValue !== null &&
        Math.abs(normalizedValue - currentValue) < Number.EPSILON)
    ) {
      if (resetDraftOnNoop) {
        setDraft(createDraft());
      }
      return false;
    }

    onChange(
      placement.id,
      createNumberFieldPatch(fieldName, normalizedValue, recordHistory),
    );
    return true;
  };

  return (
    <details
      aria-label="Aura placement properties"
      className={styles.propertiesPanel}
      data-aura-properties-panel
      open
      ref={panelRef}
      role="region"
      style={panelStyle}
    >
      <AuraPlacementPropertiesPanelToggle />
      <div className={styles.propertiesPanelContent}>
        <AuraPlacementNameField label={label} onCommit={handleNameCommit} />
        {auraPlacementBaseNumberFields.map((field) => (
          <AuraPlacementNumberField
            key={field.name}
            {...field}
            value={draft[field.name]}
            onChange={handleNumberChange}
            onBlur={handleNumberBlur}
            onFocus={handleNumberFocus}
            onKeyDown={handleNumberKeyDown}
          />
        ))}
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
        {pointControls && (
          <AuraPlacementPointPropertiesFields
            draft={draft}
            onChange={handleNumberChange}
            onBlur={handleNumberBlur}
            onFocus={handleNumberFocus}
            onKeyDown={handleNumberKeyDown}
          />
        )}
        <AuraPlacementPropertiesActions
          arcStraightened={placement.arcStraightened === true}
          canStraighten={thickness !== null}
          mirrored={placement.mirrored === true}
          rotationDegrees={placement.rotationDegrees ?? 0}
          onMirrorChange={handleMirrorChange}
          onRotateClick={handleRotateClick}
          onStraightenChange={handleStraightenChange}
        />
      </div>
    </details>
  );
}

export type { AuraPlacementPropertiesPatch };
export { AuraPlacementPropertiesPanel };
