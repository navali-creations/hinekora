import { useSettingsShallow } from "~/renderer/store";

import type { AppSettings } from "~/types";
import { useManagedRecorderSettingsDisabled } from "../../ManagedRecorder.hooks/useManagedRecorderSettingsDisabled/useManagedRecorderSettingsDisabled";
import { ManagedRecorderSettingsToggle } from "../ManagedRecorderSettingsToggle/ManagedRecorderSettingsToggle";

type OverlayCaptureSettingKey =
  | "recordingHideOverlaysFromRecording"
  | "recordingHideOverlaysFromRewind";

interface ManagedRecorderOverlayCaptureToggleProps {
  ariaLabel: string;
  helpText: string;
  label: string;
  settingKey: OverlayCaptureSettingKey;
  tooltipPlacement?: "bottom" | "top";
}

function ManagedRecorderOverlayCaptureToggle({
  ariaLabel,
  helpText,
  label,
  settingKey,
  tooltipPlacement = "bottom",
}: ManagedRecorderOverlayCaptureToggleProps) {
  const disabled = useManagedRecorderSettingsDisabled();
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
      disabled={disabled}
      helpText={helpText}
      label={label}
      onChange={handleOverlayCaptureProtectionChange}
      tooltipPlacement={tooltipPlacement}
    />
  );
}

export { ManagedRecorderOverlayCaptureToggle };
