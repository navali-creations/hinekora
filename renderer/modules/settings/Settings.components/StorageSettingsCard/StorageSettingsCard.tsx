import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiPauseCircle } from "react-icons/fi";

import type { StorageGameLeagueUsage } from "~/main/modules/storage/Storage.dto";
import { useStorageShallow } from "~/renderer/store";

import DeleteLeagueModal from "../storage/DeleteLeagueModal/DeleteLeagueModal";
import DiskUsageSection from "../storage/DiskUsageSection/DiskUsageSection";
import LeagueDataSection from "../storage/LeagueDataSection/LeagueDataSection";
import { RecordingStorageSettingsFields } from "./RecordingStorageSettingsFields/RecordingStorageSettingsFields";

function StorageSettingsCard() {
  const {
    analysisAvailability,
    deletingGameLeagueId,
    deleteGameLeagueData,
    error,
    gameLeagueUsage,
    info,
    isLoading,
    refreshStorage,
  } = useStorageShallow((storage) => ({
    analysisAvailability: storage.analysisAvailability,
    deletingGameLeagueId: storage.deletingGameLeagueId,
    deleteGameLeagueData: storage.deleteGameLeagueData,
    error: storage.error,
    gameLeagueUsage: storage.gameLeagueUsage,
    info: storage.info,
    isLoading: storage.isLoading,
    refreshStorage: storage.refresh,
  }));
  const isAnalysisDeferred = analysisAvailability === "deferred";
  const [leagueToDelete, setLeagueToDelete] =
    useState<StorageGameLeagueUsage | null>(null);

  useEffect(() => {
    void refreshStorage();
  }, [refreshStorage]);

  const handleRefresh = useCallback(async () => {
    if (analysisAvailability === "deferred") {
      return;
    }

    await refreshStorage();
  }, [analysisAvailability, refreshStorage]);

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

        <RecordingStorageSettingsFields />

        {isAnalysisDeferred && (
          <div className="alert mt-4 text-sm" role="status">
            <FiPauseCircle className="h-4 w-4" />
            <span>
              Storage analysis is paused while Path of Exile or capture is
              active. It will resume automatically afterward.
            </span>
          </div>
        )}

        {isLoading && !info && !isAnalysisDeferred && (
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
              disabled={analysisAvailability === "deferred"}
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
