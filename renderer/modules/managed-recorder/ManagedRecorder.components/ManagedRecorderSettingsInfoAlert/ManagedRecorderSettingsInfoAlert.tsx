import { FiInfo } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

function ManagedRecorderSettingsInfoAlert() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));

  if (!settingsValue || settingsValue.recorderSettingsInfoAlertDismissed) {
    return null;
  }

  const handleDismiss = () => {
    void updateSettings({
      recorderSettingsInfoAlertDismissed: true,
    });
  };

  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-info bg-secondary px-4 py-2 text-[0.8125rem] text-info shadow-sm"
      role="status"
    >
      <FiInfo size={16} />
      <p className="m-0 truncate">Settings are saved locally; set them once.</p>
      <button
        aria-label="Dismiss recorder settings info alert"
        className="btn btn-xs border-info/20 bg-base-300/80 px-2 text-info hover:bg-base-300"
        title="Dismiss"
        type="button"
        onClick={handleDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

export { ManagedRecorderSettingsInfoAlert };
