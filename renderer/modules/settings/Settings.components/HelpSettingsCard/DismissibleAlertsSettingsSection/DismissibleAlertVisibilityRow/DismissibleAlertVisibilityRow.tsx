import type { ChangeEvent } from "react";

import { trackEvent } from "~/renderer/modules/umami";
import { useSettingsShallow } from "~/renderer/store";

import type { AppSettings } from "~/types";
import { SettingsToggleRow } from "../../../SettingsToggleRow/SettingsToggleRow";

type DismissibleAlertSettingKey =
  | "groupPlayDeathAlertDismissed"
  | "captureModeInfoAlertDismissed"
  | "recorderSettingsInfoAlertDismissed"
  | "clipPreviewInfoAlertDismissed";

interface DismissibleAlertVisibilityRowProps {
  alertId: string;
  description: string;
  settingKey: DismissibleAlertSettingKey;
  title: string;
}

function DismissibleAlertVisibilityRow({
  alertId,
  description,
  settingKey,
  title,
}: DismissibleAlertVisibilityRowProps) {
  const { isDismissed, updateSettings } = useSettingsShallow((settings) => ({
    isDismissed: settings.value?.[settingKey] ?? false,
    updateSettings: settings.update,
  }));
  const isVisible = !isDismissed;

  const handleVisibilityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const visible = event.target.checked;
    const nextSettings: Partial<AppSettings> = {
      [settingKey]: !visible,
    };

    void updateSettings(nextSettings);
    trackEvent("dismissible-alert-visibility-toggled", {
      alertId,
      visible,
    });
  };

  return (
    <SettingsToggleRow
      ariaLabel={`${isVisible ? "Dismiss" : "Show"} ${title}`}
      checked={isVisible}
      description={description}
      label={title}
      statusClassName={isVisible ? "text-success" : "text-base-content/50"}
      statusLabel={isVisible ? "Visible" : "Dismissed"}
      onChange={handleVisibilityChange}
    />
  );
}

export type { DismissibleAlertSettingKey };
export { DismissibleAlertVisibilityRow };
