import type {
  DeleteGameLeagueDataResult,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
} from "~/main/modules/storage/Storage.dto";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

export interface StorageSlice {
  storage: {
    info: StorageInfo | null;
    gameLeagueUsage: StorageGameLeagueUsage[];
    isLoading: boolean;
    error: string | null;
    deletingGameLeagueId: string | null;
    fetchStorageInfo: () => Promise<void>;
    fetchGameLeagueUsage: () => Promise<void>;
    refresh: () => Promise<void>;
    setError: (error: string | null) => void;
    deleteGameLeagueData: (
      input: StorageGameLeagueInput,
    ) => Promise<DeleteGameLeagueDataResult>;
  };
}

export const createStorageSlice: BoundStoreStateCreator<StorageSlice> = (
  set,
  get,
) => {
  const fetchStorageInfo = async () => {
    set((state) => {
      state.storage.isLoading = true;
      state.storage.error = null;
    });

    try {
      const info = await window.electron.storage.getInfo();
      set((state) => {
        state.storage.info = info;
        state.storage.isLoading = false;
      });
    } catch (error) {
      set((state) => {
        state.storage.isLoading = false;
        state.storage.error =
          error instanceof Error ? error.message : "Failed to fetch storage";
      });
    }
  };

  const fetchGameLeagueUsage = async () => {
    set((state) => {
      state.storage.isLoading = true;
      state.storage.error = null;
    });

    try {
      const gameLeagueUsage =
        await window.electron.storage.getGameLeagueUsage();
      set((state) => {
        state.storage.gameLeagueUsage = gameLeagueUsage;
        state.storage.isLoading = false;
      });
    } catch (error) {
      set((state) => {
        state.storage.isLoading = false;
        state.storage.error =
          error instanceof Error
            ? error.message
            : "Failed to fetch storage usage";
      });
    }
  };

  return {
    storage: {
      info: null,
      gameLeagueUsage: [],
      isLoading: false,
      error: null,
      deletingGameLeagueId: null,
      fetchStorageInfo,
      fetchGameLeagueUsage,
      refresh: async () => {
        await Promise.all([fetchStorageInfo(), fetchGameLeagueUsage()]);
      },
      setError: (error) => {
        set((state) => {
          state.storage.error = error;
        });
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

          await get().storage.refresh();
          set((state) => {
            state.storage.deletingGameLeagueId = null;
            state.storage.error = result.cleanupError ?? null;
          });

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
