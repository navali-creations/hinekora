import { useCallback } from "react";
import { FiRotateCcw } from "react-icons/fi";

import { trackEvent } from "~/renderer/modules/umami";
import { useSettingsShallow } from "~/renderer/store";

import type { AppSettings } from "~/types";

type DismissibleAlertSettingKey =
  | "groupPlayDeathAlertDismissed"
  | "captureModeInfoAlertDismissed"
  | "recorderSettingsInfoAlertDismissed";

interface DismissibleAlertRestoreRowProps {
  alertId: string;
  description: string;
  settingKey: DismissibleAlertSettingKey;
  title: string;
}

function DismissibleAlertRestoreRow({
  alertId,
  description,
  settingKey,
  title,
}: DismissibleAlertRestoreRowProps) {
  const { isDismissed, updateSettings } = useSettingsShallow((settings) => ({
    isDismissed: settings.value?.[settingKey] ?? false,
    updateSettings: settings.update,
  }));

  const handleRestore = useCallback(() => {
    const nextSettings: Partial<AppSettings> = {
      [settingKey]: false,
    };

    void updateSettings(nextSettings);
    trackEvent("dismissible-alert-restored", {
      alertId,
    });
  }, [alertId, settingKey, updateSettings]);

  return (
    <div className="flex items-start justify-between gap-4 border-base-content/10 border-t pt-4">
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="mt-1 text-base-content/60 text-sm">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="badge badge-outline badge-sm">
          {isDismissed ? "Dismissed" : "Visible"}
        </span>
        <button
          className="btn btn-outline btn-sm"
          disabled={!isDismissed}
          type="button"
          onClick={handleRestore}
        >
          <FiRotateCcw />
          Show Again
        </button>
      </div>
    </div>
  );
}

export type { DismissibleAlertSettingKey };
export { DismissibleAlertRestoreRow };
