import { FiInfo } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

function ClipPreviewInfoAlert() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));

  const handleDismiss = () => {
    void updateSettings({
      clipPreviewInfoAlertDismissed: true,
    });
  };

  if (!settingsValue || settingsValue.clipPreviewInfoAlertDismissed) {
    return null;
  }

  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-info bg-secondary px-3 py-2 text-[0.75rem] text-info shadow-sm"
      role="status"
    >
      <FiInfo size={16} />
      <p className="m-0 min-w-0">
        Manual Replays and Death Clips are available on the Clips page.
      </p>
      <button
        aria-label="Dismiss clips page info"
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

export { ClipPreviewInfoAlert };
