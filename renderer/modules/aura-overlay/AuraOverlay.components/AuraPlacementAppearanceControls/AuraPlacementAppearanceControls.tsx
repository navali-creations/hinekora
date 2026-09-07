import type {
  ChangeEvent,
  FocusEventHandler,
  KeyboardEventHandler,
} from "react";

import { AuraPlacementEffectSettings, type OverlayPlacement } from "~/types";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { AuraPlacementColorField } from "../AuraPlacementColorField/AuraPlacementColorField";
import { AuraPlacementNumberField } from "../AuraPlacementNumberField/AuraPlacementNumberField";
import type {
  AuraPlacementNumberValueChange,
  AuraPlacementPropertiesDraft,
  AuraPlacementPropertiesPatch,
} from "../AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";

interface AuraPlacementAppearanceControlsProps {
  draft: AuraPlacementPropertiesDraft;
  placement: OverlayPlacement;
  showClipShapeControls: boolean;
  onChange: (placementId: string, patch: AuraPlacementPropertiesPatch) => void;
  onNumberBlur: FocusEventHandler<HTMLInputElement>;
  onNumberFocus: FocusEventHandler<HTMLInputElement>;
  onNumberKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onNumberValueChange: AuraPlacementNumberValueChange;
}

function AuraPlacementAppearanceControls({
  draft,
  placement,
  showClipShapeControls,
  onChange,
  onNumberBlur,
  onNumberFocus,
  onNumberKeyDown,
  onNumberValueChange,
}: AuraPlacementAppearanceControlsProps) {
  const cornersRounded = placement.cornerRadius !== undefined;
  const outlineEnabled = placement.outlineThickness !== undefined;
  const shadowEnabled = placement.shadowSpread !== undefined;

  const handleOutlineChange = (event: ChangeEvent<HTMLInputElement>) => {
    const enabled = event.currentTarget.checked;
    onChange(placement.id, {
      outlineColor: enabled
        ? (placement.outlineColor ??
          AuraPlacementEffectSettings.defaultOutlineColor)
        : null,
      outlineThickness: enabled
        ? (placement.outlineThickness ??
          AuraPlacementEffectSettings.defaultOutlineThickness)
        : null,
    });
  };

  const handleShadowChange = (event: ChangeEvent<HTMLInputElement>) => {
    const enabled = event.currentTarget.checked;
    onChange(placement.id, {
      shadowColor: enabled
        ? (placement.shadowColor ??
          AuraPlacementEffectSettings.defaultShadowColor)
        : null,
      shadowSpread: enabled
        ? (placement.shadowSpread ??
          AuraPlacementEffectSettings.defaultShadowSpread)
        : null,
    });
  };

  const handleRoundedCornersChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(placement.id, {
      cornerRadius: event.currentTarget.checked
        ? (placement.cornerRadius ??
          AuraPlacementEffectSettings.defaultCornerRadius)
        : null,
    });
  };

  const handleOutlineColorCommit = (outlineColor: string) => {
    onChange(placement.id, { outlineColor });
  };

  const handleShadowColorCommit = (shadowColor: string) => {
    onChange(placement.id, { shadowColor });
  };

  return (
    <section
      aria-label="Aura appearance"
      className={styles.propertiesAppearance}
    >
      <div className={styles.propertiesCoordinates}>
        <AuraPlacementNumberField
          label="X"
          max="100000"
          min="-100000"
          name="x"
          value={draft.x}
          onBlur={onNumberBlur}
          onFocus={onNumberFocus}
          onKeyDown={onNumberKeyDown}
          onValueChange={onNumberValueChange}
        />
        <AuraPlacementNumberField
          label="Y"
          max="100000"
          min="-100000"
          name="y"
          value={draft.y}
          onBlur={onNumberBlur}
          onFocus={onNumberFocus}
          onKeyDown={onNumberKeyDown}
          onValueChange={onNumberValueChange}
        />
      </div>
      <AuraPlacementNumberField
        label="Opacity"
        max="1"
        min="0"
        name="opacity"
        step="0.05"
        value={draft.opacity}
        onBlur={onNumberBlur}
        onFocus={onNumberFocus}
        onKeyDown={onNumberKeyDown}
        onValueChange={onNumberValueChange}
      />
      <div className={styles.propertiesEffect}>
        <label className={styles.propertiesToggle}>
          <input
            checked={outlineEnabled}
            type="checkbox"
            onChange={handleOutlineChange}
          />
          Aura outline
        </label>
        {outlineEnabled && (
          <div className={styles.propertiesEffectControls}>
            <AuraPlacementNumberField
              label="Outline px"
              max={String(AuraPlacementEffectSettings.maxOutlineThickness)}
              min={String(AuraPlacementEffectSettings.minOutlineThickness)}
              name="outlineThickness"
              value={draft.outlineThickness}
              onBlur={onNumberBlur}
              onFocus={onNumberFocus}
              onKeyDown={onNumberKeyDown}
              onValueChange={onNumberValueChange}
            />
            <AuraPlacementColorField
              label="Outline color"
              value={
                placement.outlineColor ??
                AuraPlacementEffectSettings.defaultOutlineColor
              }
              onCommit={handleOutlineColorCommit}
            />
          </div>
        )}
      </div>
      <div className={styles.propertiesEffect}>
        <label className={styles.propertiesToggle}>
          <input
            checked={shadowEnabled}
            type="checkbox"
            onChange={handleShadowChange}
          />
          Aura shadow
        </label>
        {shadowEnabled && (
          <div className={styles.propertiesEffectControls}>
            <AuraPlacementNumberField
              label="Shadow spread"
              max={String(AuraPlacementEffectSettings.maxShadowSpread)}
              min={String(AuraPlacementEffectSettings.minShadowSpread)}
              name="shadowSpread"
              value={draft.shadowSpread}
              onBlur={onNumberBlur}
              onFocus={onNumberFocus}
              onKeyDown={onNumberKeyDown}
              onValueChange={onNumberValueChange}
            />
            <AuraPlacementColorField
              label="Shadow color"
              value={
                placement.shadowColor ??
                AuraPlacementEffectSettings.defaultShadowColor
              }
              onCommit={handleShadowColorCommit}
            />
          </div>
        )}
      </div>
      {(!showClipShapeControls || placement.clipShape === undefined) && (
        <div className={styles.propertiesEffect}>
          <label className={styles.propertiesToggle}>
            <input
              checked={cornersRounded}
              type="checkbox"
              onChange={handleRoundedCornersChange}
            />
            Round corners
          </label>
          {cornersRounded && (
            <AuraPlacementNumberField
              label="Corner radius"
              max={String(AuraPlacementEffectSettings.maxCornerRadius)}
              min={String(AuraPlacementEffectSettings.minCornerRadius)}
              name="cornerRadius"
              value={draft.cornerRadius}
              onBlur={onNumberBlur}
              onFocus={onNumberFocus}
              onKeyDown={onNumberKeyDown}
              onValueChange={onNumberValueChange}
            />
          )}
        </div>
      )}
    </section>
  );
}

export { AuraPlacementAppearanceControls };
