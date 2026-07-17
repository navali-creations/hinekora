import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { FiInfo, FiFolder as FolderOpen } from "react-icons/fi";

import {
  useManagedRecorderSelector,
  useRecordingStorageShallow,
  useSettingsShallow,
  useStorageShallow,
} from "~/renderer/store";

import { defaultRecordingMaxStorageGb } from "~/types";
import { getRecordingStorageSettingsError } from "./RecordingStorageSettingsFields.utils";

function RecordingStorageSettingsFields() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const { refreshStorage, setError } = useStorageShallow((storage) => ({
    refreshStorage: storage.refresh,
    setError: storage.setError,
  }));
  const refreshRecordingStorageUsage = useRecordingStorageShallow(
    (recordingStorage) => recordingStorage.refreshUsage,
  );
  const recorderStatus = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status,
  );
  const persistedPath = settingsValue?.recordingStoragePath ?? "";
  const persistedMaxStorageGb =
    settingsValue?.recordingMaxStorageGb ?? defaultRecordingMaxStorageGb;
  const [recordingStoragePathDraft, setRecordingStoragePathDraft] =
    useState(persistedPath);
  const [maxStorageGbDraft, setMaxStorageGbDraft] = useState(
    String(persistedMaxStorageGb),
  );

  useEffect(() => {
    setRecordingStoragePathDraft(persistedPath);
  }, [persistedPath]);

  useEffect(() => {
    setMaxStorageGbDraft(String(persistedMaxStorageGb));
  }, [persistedMaxStorageGb]);

  const isRecording = recorderStatus?.recording === true;
  const isBusy =
    recorderStatus?.isStartingRecording === true ||
    recorderStatus?.isStoppingRecording === true;
  const recordingStorageDefaultPath =
    persistedPath || recorderStatus?.outputDirectory || undefined;

  const persistStoragePath = async (recordingStoragePath: string | null) => {
    try {
      setError(null);
      await updateSettings({ recordingStoragePath });
    } catch (error) {
      setRecordingStoragePathDraft(persistedPath);
      setError(getRecordingStorageSettingsError(error));
      return;
    }

    try {
      await Promise.all([refreshStorage(), refreshRecordingStorageUsage()]);
    } catch (error) {
      setError(getRecordingStorageSettingsError(error));
    }
  };

  const handleStoragePathChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRecordingStoragePathDraft(event.target.value);
  };

  const handleStoragePathCommit = async () => {
    const recordingStoragePath = recordingStoragePathDraft || null;
    if (recordingStoragePath !== (persistedPath || null)) {
      await persistStoragePath(recordingStoragePath);
    }
  };

  const handleMaxStorageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMaxStorageGbDraft(event.target.value);
  };

  const handleMaxStorageCommit = async () => {
    const trimmedValue = maxStorageGbDraft.trim();
    const parsedValue = Number(trimmedValue);
    if (trimmedValue.length === 0 || !Number.isFinite(parsedValue)) {
      setMaxStorageGbDraft(String(persistedMaxStorageGb));
      return;
    }

    const recordingMaxStorageGb = Math.max(0, Math.round(parsedValue));
    setMaxStorageGbDraft(String(recordingMaxStorageGb));
    if (recordingMaxStorageGb === persistedMaxStorageGb) {
      return;
    }

    try {
      setError(null);
      await updateSettings({ recordingMaxStorageGb });
    } catch (error) {
      setMaxStorageGbDraft(String(persistedMaxStorageGb));
      setError(getRecordingStorageSettingsError(error));
    }
  };

  const handleBrowseStorage = async () => {
    try {
      const directoryPath = await window.electron.app.selectPath({
        ...(recordingStorageDefaultPath
          ? { defaultPath: recordingStorageDefaultPath }
          : {}),
        title: "Select recording folder",
        properties: ["openDirectory"],
      });
      if (directoryPath) {
        setRecordingStoragePathDraft(directoryPath);
        await persistStoragePath(directoryPath);
      }
    } catch (error) {
      setError(getRecordingStorageSettingsError(error));
    }
  };

  return (
    <div className="space-y-3">
      <span className="font-semibold text-sm">Recording Storage</span>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="grid min-w-0 gap-1.5 text-primary text-[0.8125rem]">
          Recording folder
          <div className="join w-full">
            <input
              className="input input-bordered input-sm join-item min-w-0 flex-1"
              disabled={isRecording || isBusy}
              placeholder={
                recorderStatus?.outputDirectory ?? "Default media folder"
              }
              value={recordingStoragePathDraft}
              onBlur={handleStoragePathCommit}
              onChange={handleStoragePathChange}
            />
            <button
              className="no-drag btn btn-primary btn-sm btn-square join-item"
              disabled={isRecording || isBusy}
              title="Select recording folder"
              type="button"
              onClick={handleBrowseStorage}
            >
              <FolderOpen size={16} />
            </button>
          </div>
        </label>
        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          <span className="inline-flex items-center gap-1">
            Max storage GB
            <span
              aria-label="Disk storage limit for recordings and clips. Set 0 for unlimited storage."
              className="tooltip tooltip-left inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
              data-tip="Disk storage limit for recordings and clips. Set 0 for unlimited storage."
              role="img"
              tabIndex={0}
            >
              <FiInfo className="h-3.5 w-3.5" />
            </span>
          </span>
          <input
            className="input input-bordered input-sm w-full"
            disabled={isRecording || isBusy}
            min={0}
            step={1}
            type="number"
            value={maxStorageGbDraft}
            onBlur={handleMaxStorageCommit}
            onChange={handleMaxStorageChange}
          />
        </label>
      </div>
    </div>
  );
}

export { RecordingStorageSettingsFields };
