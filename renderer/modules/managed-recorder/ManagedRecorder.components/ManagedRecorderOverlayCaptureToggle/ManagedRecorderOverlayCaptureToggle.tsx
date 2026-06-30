import type { ChangeEvent } from "react";
import { FiInfo } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

import type { AppSettings } from "~/types";

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

  const handleOverlayCaptureProtectionChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const checked = event.target.checked;
    const nextSettings: Partial<AppSettings> =
      settingKey === "recordingHideOverlaysFromRecording"
        ? { recordingHideOverlaysFromRecording: checked }
        : { recordingHideOverlaysFromRewind: checked };

    void updateSettings(nextSettings);
  };

  return (
    <label className="flex min-w-0 items-center justify-between gap-3 py-1 text-primary text-[0.8125rem]">
      <span className="inline-flex min-w-0 items-center gap-1 font-semibold">
        {label}
        <span
          aria-label={helpText}
          className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
          data-tip={helpText}
          role="img"
          tabIndex={0}
        >
          <FiInfo className="h-3.5 w-3.5" />
        </span>
      </span>
      <input
        aria-label={ariaLabel}
        checked={overlayCaptureProtectionEnabled}
        className="toggle toggle-primary toggle-xs shrink-0"
        type="checkbox"
        onChange={handleOverlayCaptureProtectionChange}
      />
    </label>
  );
}

export { ManagedRecorderOverlayCaptureToggle };
