import { type ChangeEvent, useId } from "react";
import { FiSliders } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

import { AuraOverlayBulkResize } from "../AuraOverlayBulkResize/AuraOverlayBulkResize";
import { AuraOverlayPreferenceToggleRow } from "../AuraOverlayPreferenceToggleRow/AuraOverlayPreferenceToggleRow";
import { AuraOverlayToolbarPopover } from "../AuraOverlayToolbarPopover/AuraOverlayToolbarPopover";
import { AuraOverlayVisibilityPreferences } from "../AuraOverlayVisibilityPreferences/AuraOverlayVisibilityPreferences";

function AuraOverlayEditingPreferences() {
  const editingFrameId = useId();
  const editingGridId = useId();
  const centerGuidesId = useId();
  const snappingId = useId();
  const { preferenceErrors, settings, updatePreference } = useSettingsShallow(
    (settingsSlice) => ({
      preferenceErrors: settingsSlice.preferenceErrors,
      settings: settingsSlice.value,
      updatePreference: settingsSlice.updatePreference,
    }),
  );
  const showEditingFrame = settings?.auraOverlayShowEditingFrame ?? true;
  const showEditingGrid = settings?.auraOverlayShowEditingGrid ?? false;
  const showCenterGuides = settings?.auraOverlayShowCenterGuides ?? false;
  const enableSnapping = settings?.auraOverlayEnableSnapping ?? false;
  const activeToggleCount = [
    showEditingFrame,
    showEditingGrid,
    showCenterGuides,
    enableSnapping,
    settings?.auraOverlayHideLabels ?? false,
    settings?.auraOverlayHidePropertiesPanel ?? false,
  ].filter(Boolean).length;
  const editingFrameError =
    preferenceErrors.auraOverlayShowEditingFrame ?? null;
  const editingGridError = preferenceErrors.auraOverlayShowEditingGrid ?? null;
  const centerGuidesError =
    preferenceErrors.auraOverlayShowCenterGuides ?? null;
  const snappingError = preferenceErrors.auraOverlayEnableSnapping ?? null;

  const handleEditingFrameChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updatePreference("auraOverlayShowEditingFrame", event.target.checked);
  };

  const handleEditingGridChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updatePreference("auraOverlayShowEditingGrid", event.target.checked);
  };

  const handleCenterGuidesChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updatePreference("auraOverlayShowCenterGuides", event.target.checked);
  };

  const handleSnappingChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updatePreference("auraOverlayEnableSnapping", event.target.checked);
  };

  return (
    <AuraOverlayToolbarPopover
      buttonAriaLabel="Show aura display options"
      buttonTitle="Aura display options"
      description="Choose editing guides, snapping behavior, and icon sizing."
      icon={<FiSliders size={18} />}
      indicatorCount={activeToggleCount}
      panelAriaLabel="Aura display options"
      title="Display options"
    >
      <div className="divide-y divide-primary/15">
        <AuraOverlayPreferenceToggleRow
          ariaLabel="Show aura editing frame"
          checked={showEditingFrame}
          className="pt-0"
          description="Show the border and glow around the screen."
          error={editingFrameError}
          id={editingFrameId}
          label="Editing frame"
          onChange={handleEditingFrameChange}
        />
        <AuraOverlayPreferenceToggleRow
          ariaLabel="Show aura editing grid"
          checked={showEditingGrid}
          description="Show a resolution-aware grid centered on the screen."
          error={editingGridError}
          id={editingGridId}
          label="Show grid"
          onChange={handleEditingGridChange}
        />
        <AuraOverlayPreferenceToggleRow
          ariaLabel="Show aura center lines"
          checked={showCenterGuides}
          description="Show red horizontal and vertical lines through screen center."
          error={centerGuidesError}
          id={centerGuidesId}
          label="Show center lines"
          onChange={handleCenterGuidesChange}
        />
        <AuraOverlayPreferenceToggleRow
          ariaLabel="Enable aura item snapping"
          checked={enableSnapping}
          description="Snap auras to grid cells, screen center, and other auras."
          error={snappingError}
          id={snappingId}
          label="Enable item snapping"
          onChange={handleSnappingChange}
        />
        <AuraOverlayVisibilityPreferences />
        <AuraOverlayBulkResize />
      </div>
    </AuraOverlayToolbarPopover>
  );
}

export { AuraOverlayEditingPreferences };
