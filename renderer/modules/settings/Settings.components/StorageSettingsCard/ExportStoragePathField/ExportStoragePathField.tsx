import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { FiFolder as FolderOpen } from "react-icons/fi";

import {
  useEditorSelector,
  useRecordingStorageShallow,
  useSettingsShallow,
  useStorageShallow,
} from "~/renderer/store";

import { getRecordingStorageSettingsError } from "../RecordingStorageSettingsFields/RecordingStorageSettingsFields.utils";

function ExportStoragePathField() {
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
  const exportStatus = useEditorSelector((editor) => editor.exportState.status);
  const persistedPath = settingsValue?.editorExportStoragePath ?? "";
  const [pathDraft, setPathDraft] = useState(persistedPath);

  useEffect(() => {
    setPathDraft(persistedPath);
  }, [persistedPath]);

  const persistPath = async (editorExportStoragePath: string | null) => {
    try {
      setError(null);
      await updateSettings({ editorExportStoragePath });
    } catch (error) {
      setPathDraft(persistedPath);
      setError(getRecordingStorageSettingsError(error));
      return;
    }

    try {
      await Promise.all([refreshStorage(), refreshRecordingStorageUsage()]);
    } catch (error) {
      setError(getRecordingStorageSettingsError(error));
    }
  };

  const handlePathChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPathDraft(event.target.value);
  };

  const handlePathCommit = async () => {
    const path = pathDraft || null;
    if (path !== (persistedPath || null)) {
      await persistPath(path);
    }
  };

  const handleBrowse = async () => {
    try {
      const directoryPath = await window.electron.app.selectPath({
        ...(persistedPath ? { defaultPath: persistedPath } : {}),
        title: "Select exports folder",
        properties: ["openDirectory"],
      });
      if (directoryPath) {
        setPathDraft(directoryPath);
        await persistPath(directoryPath);
      }
    } catch (error) {
      setError(getRecordingStorageSettingsError(error));
    }
  };

  const isExporting = exportStatus === "exporting";

  return (
    <label className="grid min-w-0 gap-1.5 text-primary text-[0.8125rem]">
      Exports folder
      <div className="join w-full">
        <input
          className="input input-bordered input-sm join-item min-w-0 flex-1"
          disabled={isExporting}
          placeholder="Default: Videos\Hinekora Exports"
          value={pathDraft}
          onBlur={handlePathCommit}
          onChange={handlePathChange}
        />
        <button
          className="no-drag btn btn-primary btn-sm btn-square join-item"
          disabled={isExporting}
          title="Select exports folder"
          type="button"
          onClick={handleBrowse}
        >
          <FolderOpen size={16} />
        </button>
      </div>
      <span className="text-base-content/55 text-xs">
        Finished videos saved from the editor. These are separate from your
        recordings and clips.
      </span>
    </label>
  );
}

export { ExportStoragePathField };
