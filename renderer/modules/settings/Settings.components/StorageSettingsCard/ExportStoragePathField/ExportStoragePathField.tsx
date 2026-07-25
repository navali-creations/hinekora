import { useEffect, useState } from "react";

import {
  useEditorSelector,
  useRecordingStorageShallow,
  useSettingsShallow,
  useStorageShallow,
} from "~/renderer/store";

import { StorageBudgetField } from "../StorageBudgetField/StorageBudgetField";
import { StoragePathField } from "../StoragePathField/StoragePathField";
import { useStoragePathSetting } from "../StoragePathField/useStoragePathSetting";

function ExportStoragePathField() {
  const settingsValue = useSettingsShallow((settings) => settings.value);
  const exportUsage = useRecordingStorageShallow(
    (recordingStorage) => recordingStorage.usage,
  );
  const exportUsageBytes = exportUsage?.exportVideosSizeBytes ?? null;
  const setStorageError = useStorageShallow((storage) => storage.setError);
  const isExporting =
    useEditorSelector((editor) => editor.exportState.status) === "exporting";
  const persistedPath = settingsValue?.editorExportStoragePath ?? "";
  const [defaultPath, setDefaultPath] = useState("");

  useEffect(() => {
    if (persistedPath) {
      setDefaultPath(persistedPath);
      return;
    }
    let active = true;
    void window.electron.storage
      .revealPaths()
      .then((paths) => {
        if (active) {
          setDefaultPath(paths.exportStoragePath);
        }
      })
      .catch((error) => {
        if (active) {
          setStorageError(
            error instanceof Error
              ? error.message
              : "Could not resolve the default exports folder",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [persistedPath, setStorageError]);

  const exportPath = useStoragePathSetting({
    defaultPath: defaultPath || undefined,
    dialogTitle: "Select exports folder",
    persistedPath,
    settingKey: "editorExportStoragePath",
  });

  return (
    <div className="space-y-2">
      <span className="font-semibold text-sm">Export Storage</span>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
        <StoragePathField
          description="Finished videos saved from the editor. These are separate from your recordings and clips."
          disabled={isExporting}
          label="Exports folder"
          placeholder="Loading export folder..."
          value={exportPath.draft}
          onBlur={exportPath.handleBlur}
          onBrowse={exportPath.handleBrowse}
          onChange={exportPath.handleChange}
        />
        <StorageBudgetField
          currentUsageBytes={exportUsageBytes}
          currentUsageIsPartial={
            exportUsage?.exportVideosUsageTruncated === true
          }
          disabled={isExporting}
          helpText="Export storage limit. Hinekora automatically deletes the oldest saved edit videos when the limit is reached. Set 0 for unlimited storage."
          settingKey="editorExportMaxStorageGb"
        />
      </div>
    </div>
  );
}

export { ExportStoragePathField };
