import { type ChangeEvent, useId } from "react";

import { useSettingsShallow } from "~/renderer/store";

import { AuraOverlayPreferenceToggleRow } from "../AuraOverlayPreferenceToggleRow/AuraOverlayPreferenceToggleRow";

function AuraOverlayVisibilityPreferences() {
  const labelsId = useId();
  const propertiesId = useId();
  const { preferenceErrors, settings, updatePreference } = useSettingsShallow(
    (settingsSlice) => ({
      preferenceErrors: settingsSlice.preferenceErrors,
      settings: settingsSlice.value,
      updatePreference: settingsSlice.updatePreference,
    }),
  );
  const hideLabels = settings?.auraOverlayHideLabels ?? false;
  const hideProperties = settings?.auraOverlayHidePropertiesPanel ?? false;
  const labelsError = preferenceErrors.auraOverlayHideLabels ?? null;
  const propertiesError =
    preferenceErrors.auraOverlayHidePropertiesPanel ?? null;

  const handleLabelsChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updatePreference("auraOverlayHideLabels", event.target.checked);
  };

  const handlePropertiesChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updatePreference(
      "auraOverlayHidePropertiesPanel",
      event.target.checked,
    );
  };

  return (
    <div className="divide-y divide-primary/15">
      <AuraOverlayPreferenceToggleRow
        ariaLabel="Hide all aura labels"
        checked={hideLabels}
        description="Hide every aura name while editing."
        error={labelsError}
        id={labelsId}
        label="Hide aura labels"
        onChange={handleLabelsChange}
      />
      <AuraOverlayPreferenceToggleRow
        ariaLabel="Hide per-aura options when focused"
        checked={hideProperties}
        description="Keep the selected aura clear of its properties panel."
        error={propertiesError}
        id={propertiesId}
        label="Hide focused aura options"
        onChange={handlePropertiesChange}
      />
    </div>
  );
}

export { AuraOverlayVisibilityPreferences };
