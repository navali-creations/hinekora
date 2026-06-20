import type { ChangeEvent } from "react";

import { useSettingsShallow } from "~/renderer/store";

import type { AppCloseBehavior } from "~/types";

function AppSettingsCard() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));

  const handleCloseBehaviorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({
      appCloseBehavior: event.target.value as AppCloseBehavior,
    });
  };

  const handleLaunchOnStartupChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    void updateSettings({ appLaunchOnStartup: event.target.checked });
  };

  const handleStartMinimizedChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updateSettings({ appStartMinimized: event.target.checked });
  };

  return (
    <section className="col-span-12 space-y-3">
      <p className="sr-only">Application preferences</p>

      <div className="divide-y divide-base-content/10">
        <label className="flex items-center justify-between gap-4 py-3">
          <span className="font-semibold text-sm">When closing the window</span>
          <select
            className="select select-bordered select-sm w-48 max-w-full shrink-0"
            value={settingsValue?.appCloseBehavior ?? "exit"}
            onChange={handleCloseBehaviorChange}
          >
            <option value="exit">Exit Application</option>
            <option value="minimize-to-tray">Minimize to Tray</option>
          </select>
        </label>

        <div className="py-3">
          <label className="grid cursor-pointer grid-cols-[minmax(0,1fr)_33px] gap-4">
            <span className="font-semibold text-sm">Launch on startup</span>
            <input
              className="toggle toggle-primary toggle-sm"
              checked={settingsValue?.appLaunchOnStartup ?? false}
              type="checkbox"
              onChange={handleLaunchOnStartupChange}
            />
          </label>
        </div>

        <div className="py-3">
          <label className="grid cursor-pointer grid-cols-[minmax(0,1fr)_33px] gap-4">
            <span className="font-semibold text-sm">Start minimized</span>
            <input
              className="toggle toggle-primary toggle-sm"
              checked={settingsValue?.appStartMinimized ?? false}
              type="checkbox"
              onChange={handleStartMinimizedChange}
            />
          </label>
        </div>
      </div>
    </section>
  );
}

export { AppSettingsCard };
