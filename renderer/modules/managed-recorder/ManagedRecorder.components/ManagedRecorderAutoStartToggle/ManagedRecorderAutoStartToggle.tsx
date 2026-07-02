import { useSettingsShallow } from "~/renderer/store";

import type { RecordingAutoStartMode } from "~/types";
import { ManagedRecorderSettingsToggle } from "../ManagedRecorderSettingsToggle/ManagedRecorderSettingsToggle";

interface ManagedRecorderAutoStartToggleProps {
  ariaLabel: string;
  helpText: string;
  label: string;
  mode: Exclude<RecordingAutoStartMode, "off">;
}

function ManagedRecorderAutoStartToggle({
  ariaLabel,
  helpText,
  label,
  mode,
}: ManagedRecorderAutoStartToggleProps) {
  const { autoStartMode, updateSettings } = useSettingsShallow((settings) => ({
    autoStartMode: settings.value?.recordingAutoStartMode ?? "off",
    updateSettings: settings.update,
  }));
  const checked = autoStartMode === mode;

  const handleAutoStartChange = (enabled: boolean) => {
    void updateSettings({
      recordingAutoStartMode: enabled ? mode : "off",
    });
  };

  return (
    <ManagedRecorderSettingsToggle
      ariaLabel={ariaLabel}
      checked={checked}
      helpText={helpText}
      label={label}
      onChange={handleAutoStartChange}
    />
  );
}

export { ManagedRecorderAutoStartToggle };
