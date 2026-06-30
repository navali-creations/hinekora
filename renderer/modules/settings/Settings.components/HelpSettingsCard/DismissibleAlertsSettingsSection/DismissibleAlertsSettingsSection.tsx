import {
  DismissibleAlertRestoreRow,
  type DismissibleAlertSettingKey,
} from "./DismissibleAlertRestoreRow/DismissibleAlertRestoreRow";

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
];

function DismissibleAlertsSettingsSection() {
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

      {dismissibleAlertRows.map((row) => (
        <DismissibleAlertRestoreRow key={row.settingKey} {...row} />
      ))}
    </div>
  );
}

export { DismissibleAlertsSettingsSection };
