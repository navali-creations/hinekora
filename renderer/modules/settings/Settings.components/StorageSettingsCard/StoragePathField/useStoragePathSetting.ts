import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  useRecordingStorageShallow,
  useSettingsShallow,
  useStorageShallow,
} from "~/renderer/store";

import type { AppSettingsUpdate } from "~/types";
import { getStorageSettingsError } from "../StorageSettingsCard.utils";

interface UseStoragePathSettingOptions {
  defaultPath?: string | undefined;
  dialogTitle: string;
  persistedPath: string;
  settingKey: "editorExportStoragePath" | "recordingStoragePath";
}

function useStoragePathSetting({
  defaultPath,
  dialogTitle,
  persistedPath,
  settingKey,
}: UseStoragePathSettingOptions) {
  const updateSettings = useSettingsShallow((settings) => settings.update);
  const { refreshStorage, setError } = useStorageShallow((storage) => ({
    refreshStorage: storage.refreshAfterMutation,
    setError: storage.setError,
  }));
  const refreshUsage = useRecordingStorageShallow(
    (recordingStorage) => recordingStorage.refreshUsage,
  );
  const displayedPersistedPath = persistedPath || defaultPath || "";
  const [draft, setDraft] = useState(displayedPersistedPath);
  const previousDisplayedPersistedPathRef = useRef(displayedPersistedPath);

  useEffect(() => {
    const previousDisplayedPersistedPath =
      previousDisplayedPersistedPathRef.current;
    setDraft((currentDraft) =>
      currentDraft === previousDisplayedPersistedPath
        ? displayedPersistedPath
        : currentDraft,
    );
    previousDisplayedPersistedPathRef.current = displayedPersistedPath;
  }, [displayedPersistedPath]);

  const persist = async (path: string | null) => {
    try {
      setError(null);
      await updateSettings({ [settingKey]: path } as AppSettingsUpdate);
    } catch (error) {
      setDraft(displayedPersistedPath);
      setError(getStorageSettingsError(error));
      return;
    }
    void Promise.all([refreshStorage(), refreshUsage()]).catch((error) => {
      setError(getStorageSettingsError(error));
    });
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  };
  const handleBlur = () => {
    const path = draft || null;
    if (draft === displayedPersistedPath) {
      return;
    }
    if (path === (persistedPath || null)) {
      setDraft(displayedPersistedPath);
      return;
    }
    void persist(path);
  };
  const handleBrowse = () => {
    void (async () => {
      try {
        const path = await window.electron.app.selectPath({
          ...(defaultPath ? { defaultPath } : {}),
          properties: ["openDirectory"],
          title: dialogTitle,
        });
        if (path) {
          setDraft(path);
          await persist(path);
        }
      } catch (error) {
        setError(getStorageSettingsError(error));
      }
    })();
  };

  return { draft, handleBlur, handleBrowse, handleChange };
}

export { useStoragePathSetting };
