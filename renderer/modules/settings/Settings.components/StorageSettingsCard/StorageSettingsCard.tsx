import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiInfo,
  FiFolder as FolderOpen,
} from "react-icons/fi";

import type { StorageGameLeagueUsage } from "~/main/modules/storage/Storage.dto";
import {
  useManagedRecorderSelector,
  useSettingsShallow,
  useStorageShallow,
} from "~/renderer/store";

import DeleteLeagueModal from "../storage/DeleteLeagueModal/DeleteLeagueModal";
import DiskUsageSection from "../storage/DiskUsageSection/DiskUsageSection";
import LeagueDataSection from "../storage/LeagueDataSection/LeagueDataSection";

function StorageSettingsCard() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const recorderStatus = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status,
  );
  const {
    deletingGameLeagueId,
    deleteGameLeagueData,
    error,
    fetchGameLeagueUsage,
    fetchStorageInfo,
    gameLeagueUsage,
    info,
    isLoading,
  } = useStorageShallow((storage) => ({
    deletingGameLeagueId: storage.deletingGameLeagueId,
    deleteGameLeagueData: storage.deleteGameLeagueData,
    error: storage.error,
    fetchGameLeagueUsage: storage.fetchGameLeagueUsage,
    fetchStorageInfo: storage.fetchStorageInfo,
    gameLeagueUsage: storage.gameLeagueUsage,
    info: storage.info,
    isLoading: storage.isLoading,
  }));
  const [leagueToDelete, setLeagueToDelete] =
    useState<StorageGameLeagueUsage | null>(null);

  useEffect(() => {
    void fetchStorageInfo();
    void fetchGameLeagueUsage();
  }, [fetchGameLeagueUsage, fetchStorageInfo]);

  const isRecording = recorderStatus?.recording === true;
  const isBusy =
    recorderStatus?.isStartingRecording === true ||
    recorderStatus?.isStoppingRecording === true;
  const recordingStorageDefaultPath =
    settingsValue?.recordingStoragePath ||
    recorderStatus?.outputDirectory ||
    undefined;

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchStorageInfo(), fetchGameLeagueUsage()]);
  }, [fetchGameLeagueUsage, fetchStorageInfo]);

  const handleStoragePathChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updateSettings({ recordingStoragePath: event.target.value || null });
  };

  const handleMaxStorageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsedValue = Number(event.target.value);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    void updateSettings({
      recordingMaxStorageGb: Math.max(0, Math.round(parsedValue)),
    });
  };

  const handleBrowseStorage = async () => {
    const selectPathInput: Parameters<
      typeof window.electron.app.selectPath
    >[0] = {
      title: "Select recording folder",
      properties: ["openDirectory"],
    };
    if (recordingStorageDefaultPath) {
      selectPathInput.defaultPath = recordingStorageDefaultPath;
    }

    const directoryPath = await window.electron.app.selectPath(selectPathInput);

    if (directoryPath) {
      await updateSettings({ recordingStoragePath: directoryPath });
      await handleRefresh();
    }
  };

  const handleDeleteRequest = useCallback((league: StorageGameLeagueUsage) => {
    setLeagueToDelete(league);
  }, []);

  const handleDeleteConfirm = useCallback(
    (league: StorageGameLeagueUsage) => {
      setLeagueToDelete(null);
      void deleteGameLeagueData({
        game: league.game,
        leagueName: league.leagueName,
      });
    },
    [deleteGameLeagueData],
  );

  const handleDeleteModalClose = useCallback(() => {
    setLeagueToDelete(null);
  }, []);

  return (
    <>
      <section className="col-span-12 space-y-3">
        <p className="sr-only">Disk usage for application data and database</p>

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
                  value={settingsValue?.recordingStoragePath ?? ""}
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
                  className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
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
                value={settingsValue?.recordingMaxStorageGb ?? 50}
                onChange={handleMaxStorageChange}
              />
            </label>
          </div>
        </div>

        {isLoading && !info && (
          <div className="mt-4 flex items-center gap-3 text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-sm">Analyzing storage...</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mt-4 text-sm" role="alert">
            <FiAlertTriangle className="h-4 w-4" />
            <span>{error}</span>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={handleRefresh}
            >
              Retry
            </button>
          </div>
        )}

        {info && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <DiskUsageSection info={info} />
            <LeagueDataSection
              deletingGameLeagueId={deletingGameLeagueId}
              isLoading={isLoading}
              usage={gameLeagueUsage}
              onDeleteRequest={handleDeleteRequest}
            />
          </div>
        )}
      </section>

      <DeleteLeagueModal
        league={leagueToDelete}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

export { StorageSettingsCard };
