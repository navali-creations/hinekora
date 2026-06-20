import type {
  DeleteGameLeagueDataResult,
  DiskSpaceCheck,
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
    isDiskLow: boolean;
    deletingGameLeagueId: string | null;
    fetchStorageInfo: () => Promise<void>;
    fetchGameLeagueUsage: () => Promise<void>;
    refresh: () => Promise<void>;
    deleteGameLeagueData: (
      input: StorageGameLeagueInput,
    ) => Promise<DeleteGameLeagueDataResult>;
    checkDiskSpace: () => Promise<void>;
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
      const [info, diskCheck] = await Promise.all([
        window.electron.storage.getInfo(),
        window.electron.storage.checkDiskSpace(),
      ]);
      set((state) => {
        state.storage.info = info;
        state.storage.isDiskLow = diskCheck.isLow;
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
      isDiskLow: false,
      deletingGameLeagueId: null,
      fetchStorageInfo,
      fetchGameLeagueUsage,
      refresh: async () => {
        await Promise.all([fetchStorageInfo(), fetchGameLeagueUsage()]);
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
      checkDiskSpace: async () => {
        try {
          const diskCheck: DiskSpaceCheck =
            await window.electron.storage.checkDiskSpace();
          set((state) => {
            state.storage.isDiskLow = diskCheck.isLow;
          });
        } catch {}
      },
    },
  };
};
