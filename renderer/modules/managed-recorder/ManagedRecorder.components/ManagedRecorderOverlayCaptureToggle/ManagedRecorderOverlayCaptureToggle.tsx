import { useSettingsShallow } from "~/renderer/store";

import type { AppSettings } from "~/types";
import { ManagedRecorderSettingsToggle } from "../ManagedRecorderSettingsToggle/ManagedRecorderSettingsToggle";

type OverlayCaptureSettingKey =
  | "recordingHideOverlaysFromRecording"
  | "recordingHideOverlaysFromRewind";

interface ManagedRecorderOverlayCaptureToggleProps {
  ariaLabel: string;
  helpText: string;
  label: string;
  settingKey: OverlayCaptureSettingKey;
}

function ManagedRecorderOverlayCaptureToggle({
  ariaLabel,
  helpText,
  label,
  settingKey,
}: ManagedRecorderOverlayCaptureToggleProps) {
  const { overlayCaptureProtectionEnabled, updateSettings } =
    useSettingsShallow((settings) => ({
      overlayCaptureProtectionEnabled: settings.value?.[settingKey] ?? true,
      updateSettings: settings.update,
    }));

  const handleOverlayCaptureProtectionChange = (checked: boolean) => {
    const nextSettings: Partial<AppSettings> =
      settingKey === "recordingHideOverlaysFromRecording"
        ? { recordingHideOverlaysFromRecording: checked }
        : { recordingHideOverlaysFromRewind: checked };

    void updateSettings(nextSettings);
  };

  return (
    <ManagedRecorderSettingsToggle
      ariaLabel={ariaLabel}
      checked={overlayCaptureProtectionEnabled}
      helpText={helpText}
      label={label}
      onChange={handleOverlayCaptureProtectionChange}
    />
  );
}

export { ManagedRecorderOverlayCaptureToggle };
