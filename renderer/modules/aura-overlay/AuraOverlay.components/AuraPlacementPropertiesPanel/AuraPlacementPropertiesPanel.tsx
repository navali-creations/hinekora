import {
  type FocusEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuraPlacementPropertiesPanelLayout } from "../../AuraOverlay.hooks/useAuraPlacementPropertiesPanelLayout/useAuraPlacementPropertiesPanelLayout";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { AuraPlacementAppearanceControls } from "../AuraPlacementAppearanceControls/AuraPlacementAppearanceControls";
import { AuraPlacementGeneralControls } from "../AuraPlacementGeneralControls/AuraPlacementGeneralControls";
import { AuraPlacementIconControls } from "../AuraPlacementIconControls/AuraPlacementIconControls";
import { AuraPlacementPropertiesPanelToggle } from "../AuraPlacementPropertiesPanelToggle/AuraPlacementPropertiesPanelToggle";
import {
  type AuraPlacementPropertiesTab,
  AuraPlacementPropertiesTabs,
} from "../AuraPlacementPropertiesTabs/AuraPlacementPropertiesTabs";
import {
  type AuraPlacementPropertiesPanelProps,
  type AuraPlacementPropertiesPatch,
  createCurrentNumericValues,
  createNumberFieldPatch,
  createPropertiesDraft,
  type NumberFieldName,
  normalizeNumberInputValue,
  readNumberFieldName,
} from "./AuraPlacementPropertiesPanel.utils";

function AuraPlacementPropertiesPanel({
  anchorBounds,
  centerOffsetX,
  centerOffsetY,
  displayHeight,
  displayWidth,
  label,
  placement,
  pointControls = false,
  showClipShapeControls = false,
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
      createPropertiesDraft(
        centerOffsetX,
        centerOffsetY,
        displayWidth,
        displayHeight,
        placement,
        thickness,
      ),
    [
      centerOffsetX,
      centerOffsetY,
      displayHeight,
      displayWidth,
      placement,
      thickness,
    ],
  );
  const [draft, setDraft] = useState(createDraft);
  const [activeTab, setActiveTab] =
    useState<AuraPlacementPropertiesTab>("general");

  useEffect(() => {
    if (activeFieldRef.current !== null) {
      return;
    }

    setDraft(createDraft());
  }, [createDraft]);

  const handleNumberValueChange = (
    fieldName: NumberFieldName,
    nextValue: string,
  ) => {
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
      centerOffsetX,
      centerOffsetY,
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
      <AuraPlacementPropertiesTabs
        activeTab={activeTab}
        showIconTab={showClipShapeControls}
        onChange={setActiveTab}
      />
      <div
        aria-label={`${activeTab} aura properties`}
        className={styles.propertiesPanelContent}
        id={`aura-properties-${activeTab}`}
        role="tabpanel"
      >
        {activeTab === "general" && (
          <AuraPlacementGeneralControls
            draft={draft}
            label={label}
            placement={placement}
            pointControls={pointControls}
            thickness={thickness}
            onChange={onChange}
            onNameCommit={handleNameCommit}
            onNumberBlur={handleNumberBlur}
            onNumberFocus={handleNumberFocus}
            onNumberKeyDown={handleNumberKeyDown}
            onNumberValueChange={handleNumberValueChange}
          />
        )}
        {activeTab === "aura" && (
          <AuraPlacementAppearanceControls
            draft={draft}
            placement={placement}
            showClipShapeControls={showClipShapeControls}
            onChange={onChange}
            onNumberBlur={handleNumberBlur}
            onNumberFocus={handleNumberFocus}
            onNumberKeyDown={handleNumberKeyDown}
            onNumberValueChange={handleNumberValueChange}
          />
        )}
        {activeTab === "icon" && showClipShapeControls && (
          <AuraPlacementIconControls
            draft={draft}
            placement={placement}
            onChange={onChange}
            onNumberBlur={handleNumberBlur}
            onNumberFocus={handleNumberFocus}
            onNumberKeyDown={handleNumberKeyDown}
            onNumberValueChange={handleNumberValueChange}
          />
        )}
      </div>
    </details>
  );
}

export { AuraPlacementPropertiesPanel, type AuraPlacementPropertiesPatch };
