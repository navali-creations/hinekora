import { useCallback } from "react";
import { FiRotateCcw } from "react-icons/fi";

import { trackEvent } from "~/renderer/modules/umami";
import { useSettingsShallow } from "~/renderer/store";

function DismissibleAlertsSettingsSection() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const groupPlayDeathAlertDismissed =
    settingsValue?.groupPlayDeathAlertDismissed ?? false;
  const captureModeInfoAlertDismissed =
    settingsValue?.captureModeInfoAlertDismissed ?? false;

  const handleRestoreGroupPlayDeathAlert = useCallback(() => {
    void updateSettings({
      groupPlayDeathAlertDismissed: false,
    });
    trackEvent("dismissible-alert-restored", {
      alertId: "group-play-death",
    });
  }, [updateSettings]);
  const handleRestoreCaptureModeInfoAlert = useCallback(() => {
    void updateSettings({
      captureModeInfoAlertDismissed: false,
    });
    trackEvent("dismissible-alert-restored", {
      alertId: "capture-mode-info",
    });
  }, [updateSettings]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Dismissible alerts</h2>
          <p className="mt-1 text-base-content/60 text-sm">
            Restore dashboard alerts you have hidden.
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 border-base-content/10 border-t pt-4">
        <div>
          <h3 className="font-semibold text-sm">Group play death clip alert</h3>
          <p className="mt-1 text-base-content/60 text-sm">
            Reminds group players to add a character name so teammate deaths do
            not trigger death clips.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="badge badge-outline badge-sm">
            {groupPlayDeathAlertDismissed ? "Dismissed" : "Visible"}
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={!groupPlayDeathAlertDismissed}
            type="button"
            onClick={handleRestoreGroupPlayDeathAlert}
          >
            <FiRotateCcw />
            Show Again
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 border-base-content/10 border-t pt-4">
        <div>
          <h3 className="font-semibold text-sm">Capture mode info alert</h3>
          <p className="mt-1 text-base-content/60 text-sm">
            Explains the selected Recording or Rewind mode on the dashboard.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="badge badge-outline badge-sm">
            {captureModeInfoAlertDismissed ? "Dismissed" : "Visible"}
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={!captureModeInfoAlertDismissed}
            type="button"
            onClick={handleRestoreCaptureModeInfoAlert}
          >
            <FiRotateCcw />
            Show Again
          </button>
        </div>
      </div>
    </div>
  );
}

export { DismissibleAlertsSettingsSection };
