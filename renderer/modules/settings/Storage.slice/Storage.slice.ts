import type {
  DeleteGameLeagueDataResult,
  StorageAnalysisAvailability,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
} from "~/main/modules/storage/Storage.dto";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

export interface StorageSlice {
  storage: {
    analysisAvailability: StorageAnalysisAvailability | null;
    info: StorageInfo | null;
    gameLeagueUsage: StorageGameLeagueUsage[];
    isLoading: boolean;
    error: string | null;
    deletingGameLeagueId: string | null;
    fetchStorageInfo: () => Promise<void>;
    fetchGameLeagueUsage: () => Promise<void>;
    hydrateAnalysisAvailability: () => Promise<void>;
    refresh: () => Promise<void>;
    refreshAfterMutation: () => Promise<void>;
    setError: (error: string | null) => void;
    startListening: () => () => void;
    deleteGameLeagueData: (
      input: StorageGameLeagueInput,
    ) => Promise<DeleteGameLeagueDataResult>;
  };
}

export const createStorageSlice: BoundStoreStateCreator<StorageSlice> = (
  set,
  get,
) => {
  let activeLoadCount = 0;
  let analysisAvailabilityChangeVersion = 0;
  let analysisAvailabilityRequest: Promise<void> | null = null;
  let pendingRefresh = false;
  let pendingRefreshShouldClearError = false;
  let refreshRequest: Promise<void> | null = null;

  const beginLoad = (clearError: boolean) => {
    activeLoadCount += 1;
    set((state) => {
      state.storage.isLoading = true;
      if (clearError) {
        state.storage.error = null;
      }
    });
  };

  const finishLoad = () => {
    activeLoadCount = Math.max(0, activeLoadCount - 1);
    set((state) => {
      state.storage.isLoading = activeLoadCount > 0;
    });
  };

  const runStorageInfoRequest = async (clearError: boolean) => {
    beginLoad(clearError);

    try {
      const info = await window.electron.storage.getInfo();
      set((state) => {
        state.storage.info = info;
      });
    } catch (error) {
      set((state) => {
        state.storage.error =
          error instanceof Error ? error.message : "Failed to fetch storage";
      });
    } finally {
      finishLoad();
    }
  };

  const runGameLeagueUsageRequest = async (clearError: boolean) => {
    beginLoad(clearError);

    try {
      const gameLeagueUsage =
        await window.electron.storage.getGameLeagueUsage();
      set((state) => {
        state.storage.gameLeagueUsage = gameLeagueUsage;
      });
    } catch (error) {
      set((state) => {
        state.storage.error =
          error instanceof Error
            ? error.message
            : "Failed to fetch storage usage";
      });
    } finally {
      finishLoad();
    }
  };

  const applyAnalysisAvailability = (
    availability: StorageAnalysisAvailability,
  ) => {
    set((state) => {
      state.storage.analysisAvailability = availability;
    });

    if (availability !== "ready" || !pendingRefresh) {
      return;
    }

    const clearError = pendingRefreshShouldClearError;
    pendingRefresh = false;
    pendingRefreshShouldClearError = false;
    void requestRefresh(clearError);
  };

  const hydrateAnalysisAvailability = (force = false): Promise<void> => {
    if (!force && get().storage.analysisAvailability !== null) {
      return Promise.resolve();
    }
    if (analysisAvailabilityRequest) {
      return analysisAvailabilityRequest;
    }

    const changeVersion = analysisAvailabilityChangeVersion;
    const request = (async () => {
      try {
        const availability =
          await window.electron.storage.getAnalysisAvailability();
        if (changeVersion === analysisAvailabilityChangeVersion) {
          applyAnalysisAvailability(availability);
        }
      } catch (error) {
        set((state) => {
          state.storage.error =
            error instanceof Error
              ? error.message
              : "Failed to check storage availability";
        });
      }
    })();
    analysisAvailabilityRequest = request;
    void request.finally(() => {
      if (analysisAvailabilityRequest === request) {
        analysisAvailabilityRequest = null;
      }
    });

    return request;
  };

  const queueRefresh = (clearError: boolean) => {
    pendingRefresh = true;
    pendingRefreshShouldClearError ||= clearError;
  };

  const canRunAnalysis = async (clearError: boolean): Promise<boolean> => {
    await hydrateAnalysisAvailability();
    if (get().storage.analysisAvailability === "ready") {
      return true;
    }

    queueRefresh(clearError);
    return false;
  };

  const fetchStorageInfo = async () => {
    if (!(await canRunAnalysis(true))) {
      return;
    }
    await runStorageInfoRequest(true);
  };

  const fetchGameLeagueUsage = async () => {
    if (!(await canRunAnalysis(true))) {
      return;
    }
    await runGameLeagueUsageRequest(true);
  };

  const requestRefresh = async (
    clearError: boolean,
    ensureAfterCurrent = false,
  ): Promise<void> => {
    if (refreshRequest) {
      await refreshRequest;
      if (ensureAfterCurrent) {
        await requestRefresh(clearError);
      }
      return;
    }
    if (!(await canRunAnalysis(clearError))) {
      return;
    }
    if (refreshRequest) {
      await refreshRequest;
      if (ensureAfterCurrent) {
        await requestRefresh(clearError);
      }
      return;
    }

    const request = Promise.all([
      runStorageInfoRequest(clearError),
      runGameLeagueUsageRequest(clearError),
    ]).then(() => undefined);
    refreshRequest = request;
    try {
      await request;
    } finally {
      if (refreshRequest === request) {
        refreshRequest = null;
      }
    }
  };

  return {
    storage: {
      analysisAvailability: null,
      info: null,
      gameLeagueUsage: [],
      isLoading: false,
      error: null,
      deletingGameLeagueId: null,
      fetchStorageInfo,
      fetchGameLeagueUsage,
      hydrateAnalysisAvailability: () => hydrateAnalysisAvailability(),
      refresh: () => requestRefresh(true),
      refreshAfterMutation: () => requestRefresh(true, true),
      setError: (error) => {
        set((state) => {
          state.storage.error = error;
        });
      },
      startListening: () => {
        const unsubscribe =
          window.electron.storage.onAnalysisAvailabilityChanged(
            (availability) => {
              analysisAvailabilityChangeVersion += 1;
              applyAnalysisAvailability(availability);
            },
          );
        void (async () => {
          if (analysisAvailabilityRequest) {
            await analysisAvailabilityRequest;
          }
          await hydrateAnalysisAvailability(true);
        })();

        return unsubscribe;
      },
      deleteGameLeagueData: async (input) => {
        const deletingGameLeagueId = `${input.game}:${input.leagueName}`;
        set((state) => {
          state.storage.deletingGameLeagueId = deletingGameLeagueId;
          state.storage.error = null;
        });

        try {
          const result =
            await window.electron.storage.deleteGameLeagueData(input);
          if (!result.success) {
            set((state) => {
              state.storage.deletingGameLeagueId = null;
              state.storage.error =
                result.error ?? "Failed to delete league data";
            });
            return result;
          }

          set((state) => {
            state.storage.deletingGameLeagueId = null;
            state.storage.error = result.cleanupError ?? null;
            state.storage.gameLeagueUsage =
              state.storage.gameLeagueUsage.filter(
                (item) => item.id !== deletingGameLeagueId,
              );
          });
          void requestRefresh(false, true);

          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to delete league data";
          const result: DeleteGameLeagueDataResult = {
            success: false,
            freedBytes: 0,
            deletedClipCount: 0,
            deletedRecordingCount: 0,
            error: errorMessage,
          };
          set((state) => {
            state.storage.deletingGameLeagueId = null;
            state.storage.error = errorMessage;
          });

          return result;
        }
      },
    },
  };
};
