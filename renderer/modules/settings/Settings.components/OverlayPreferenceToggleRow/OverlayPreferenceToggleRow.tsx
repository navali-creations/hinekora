import clsx from "clsx";
import type { ChangeEvent } from "react";

import { useSettingsShallow } from "~/renderer/store";

import type { AppSettings } from "~/types";
import { SettingsToggleRow } from "../SettingsToggleRow/SettingsToggleRow";

type OverlayPreferenceKey = keyof Pick<
  AppSettings,
  | "auraOverlayIgnoreGameFocus"
  | "auraOverlayShowEditingFrame"
  | "clipPreviewOverlayIgnoreGameFocus"
  | "gridLinesOverlayIgnoreGameFocus"
  | "recorderOverlayIgnoreGameFocus"
  | "recorderOverlayShowOnStartup"
  | "recorderOverlayStartMinimized"
>;

interface OverlayPreferenceToggleRowProps {
  activeStatusLabel?: string;
  ariaLabel: string;
  defaultValue: boolean;
  description?: string;
  inactiveStatusLabel?: string;
  label: string;
  preferenceKey: OverlayPreferenceKey;
}

function OverlayPreferenceToggleRow({
  activeStatusLabel,
  ariaLabel,
  defaultValue,
  description,
  inactiveStatusLabel,
  label,
  preferenceKey,
}: OverlayPreferenceToggleRowProps) {
  const { error, settingsValue, updatePreference } = useSettingsShallow(
    (settings) => ({
      error: settings.preferenceErrors[preferenceKey] ?? null,
      settingsValue: settings.value,
      updatePreference: settings.updatePreference,
    }),
  );
  const checked = settingsValue?.[preferenceKey] ?? defaultValue;
  const hasSuccessStatus =
    error === null && checked && activeStatusLabel !== undefined;
  const statusLabel =
    error ?? (checked ? activeStatusLabel : inactiveStatusLabel);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updatePreference(preferenceKey, event.target.checked);
  };

  return (
    <SettingsToggleRow
      ariaLabel={ariaLabel}
      checked={checked}
      description={description}
      label={label}
      statusClassName={clsx({
        "text-base-content/50": error === null && !hasSuccessStatus,
        "text-error": error !== null,
        "text-success": hasSuccessStatus,
      })}
      statusLabel={statusLabel}
      statusRole={error !== null ? "alert" : "status"}
      onChange={handleChange}
    />
  );
}

export { OverlayPreferenceToggleRow };
