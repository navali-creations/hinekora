import { useSettingsShallow } from "~/renderer/store";

import {
  type DismissibleAlertSettingKey,
  DismissibleAlertVisibilityRow,
} from "./DismissibleAlertVisibilityRow/DismissibleAlertVisibilityRow";

const dismissibleAlertRows: ReadonlyArray<{
  alertId: string;
  description: string;
  settingKey: DismissibleAlertSettingKey;
  title: string;
}> = [
  {
    alertId: "group-play-death",
    description:
      "Reminds group players to add a character name so teammate deaths do not trigger death clips.",
    settingKey: "groupPlayDeathAlertDismissed",
    title: "Group play death clip alert",
  },
  {
    alertId: "capture-mode-info",
    description:
      "Explains the selected Recording or Rewind mode on the dashboard.",
    settingKey: "captureModeInfoAlertDismissed",
    title: "Capture mode info alert",
  },
  {
    alertId: "recorder-settings-info",
    description:
      "Reminds you that dashboard recorder settings are saved locally.",
    settingKey: "recorderSettingsInfoAlertDismissed",
    title: "Recorder settings info alert",
  },
  {
    alertId: "clip-preview-info",
    description:
      "Reminds you that Manual Replays and Death Clips are available on the Clips page.",
    settingKey: "clipPreviewInfoAlertDismissed",
    title: "Clip preview info alert",
  },
];

function DismissibleAlertsSettingsSection() {
  const dismissedCount = useSettingsShallow(
    (settings) =>
      dismissibleAlertRows.filter(
        (row) => settings.value?.[row.settingKey] ?? false,
      ).length,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Dismissible alerts</h2>
          <p className="mt-1 text-base-content/60 text-sm">
            Toggle on keeps an alert visible. Toggle off dismisses it until you
            turn it back on.
          </p>
        </div>
      </div>

      <section className="min-w-0 rounded-md border border-base-content/8 bg-base-300/35 p-3">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h4 className="truncate font-semibold text-sm">
            Dashboard and overlays
          </h4>
          <span className="badge badge-ghost badge-sm shrink-0">
            {dismissedCount} / {dismissibleAlertRows.length} dismissed
          </span>
        </div>

        <div className="divide-y divide-base-content/10">
          {dismissibleAlertRows.map((row) => (
            <DismissibleAlertVisibilityRow key={row.settingKey} {...row} />
          ))}
        </div>
      </section>
    </div>
  );
}

export { DismissibleAlertsSettingsSection };
