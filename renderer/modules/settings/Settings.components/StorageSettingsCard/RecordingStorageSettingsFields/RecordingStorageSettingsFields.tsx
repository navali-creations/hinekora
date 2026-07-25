import {
  useManagedRecorderSelector,
  useRecordingStorageShallow,
  useSettingsShallow,
} from "~/renderer/store";

import { ExportStoragePathField } from "../ExportStoragePathField/ExportStoragePathField";
import { StorageBudgetField } from "../StorageBudgetField/StorageBudgetField";
import { StoragePathField } from "../StoragePathField/StoragePathField";
import { useStoragePathSetting } from "../StoragePathField/useStoragePathSetting";

function RecordingStorageSettingsFields() {
  const settingsValue = useSettingsShallow((settings) => settings.value);
  const recorderStatus = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status,
  );
  const persistedPath = settingsValue?.recordingStoragePath ?? "";
  const recordingUsage = useRecordingStorageShallow(
    (recordingStorage) => recordingStorage.usage,
  );
  const recordingUsageBytes = recordingUsage
    ? recordingUsage.clipsSizeBytes + recordingUsage.recordingsSizeBytes
    : null;
  const isRecording = recorderStatus?.recording === true;
  const isBusy =
    recorderStatus?.isStartingRecording === true ||
    recorderStatus?.isStoppingRecording === true;
  const recordingStorageDefaultPath =
    persistedPath || recorderStatus?.outputDirectory || undefined;
  const recordingPath = useStoragePathSetting({
    defaultPath: recordingStorageDefaultPath,
    dialogTitle: "Select recording folder",
    persistedPath,
    settingKey: "recordingStoragePath",
  });

  return (
    <div className="space-y-3">
      <span className="font-semibold text-sm">Recording Storage</span>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
        <StoragePathField
          description="Full recordings, death clips, and manual replays created by Hinekora."
          disabled={isRecording || isBusy}
          label="Recording folder"
          placeholder={
            recorderStatus?.outputDirectory ?? "Default media folder"
          }
          value={recordingPath.draft}
          onBlur={recordingPath.handleBlur}
          onBrowse={recordingPath.handleBrowse}
          onChange={recordingPath.handleChange}
        />
        <StorageBudgetField
          currentUsageBytes={recordingUsageBytes}
          disabled={isRecording || isBusy}
          helpText="Disk storage limit for recordings and clips. Set 0 for unlimited storage."
          settingKey="recordingMaxStorageGb"
        />
      </div>
      <ExportStoragePathField />
    </div>
  );
}

export { RecordingStorageSettingsFields };
