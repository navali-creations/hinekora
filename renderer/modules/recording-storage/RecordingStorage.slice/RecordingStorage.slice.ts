import type {
  BoundStoreStateCreator,
  RecordingStorageSlice,
} from "~/renderer/store/store.types";

export const createRecordingStorageSlice: BoundStoreStateCreator<
  RecordingStorageSlice
> = (set, get) => {
  const refreshUsage = async () => {
    set((state) => {
      state.recordingStorage.isLoading = true;
      state.recordingStorage.error = null;
    });

    try {
      const usage = await window.electron.recordingStorage.getUsage();
      set((state) => {
        state.recordingStorage.usage = usage;
        state.recordingStorage.isLoading = false;
      });
    } catch (error) {
      set((state) => {
        state.recordingStorage.isLoading = false;
        state.recordingStorage.error =
          error instanceof Error ? error.message : "Storage failed";
      });
    }
  };

  const refreshRecordings: RecordingStorageSlice["recordingStorage"]["refreshRecordings"] =
    async (queryInput) => {
      const query = queryInput ?? get().recordingStorage.recordingsQuery ?? {};
      set((state) => {
        state.recordingStorage.isLoading = true;
        state.recordingStorage.error = null;
      });

      try {
        const recordingsPage =
          await window.electron.recordingStorage.listRecordingLibrary(query);
        set((state) => {
          state.recordingStorage.recordings = recordingsPage.items;
          state.recordingStorage.recordingsPage = recordingsPage;
          state.recordingStorage.recordingsQuery = query;
          state.recordingStorage.recordingLeagues =
            recordingsPage.availableLeagues;
          state.recordingStorage.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.recordingStorage.isLoading = false;
          state.recordingStorage.error =
            error instanceof Error ? error.message : "Storage failed";
        });
      }
    };

  const refreshRecordingsAndUsage = async () => {
    await Promise.all([refreshRecordings(), refreshUsage()]);
  };

  return {
    recordingStorage: {
      usage: null,
      recordings: [],
      recordingsPage: null,
      recordingsQuery: null,
      recordingLeagues: [],
      selectedRecordingIds: {},
      isLoading: false,
      error: null,
      hydrate: async () => {
        await Promise.all([refreshUsage(), refreshRecordings()]);
      },
      refreshUsage,
      refreshRecordings,
      openRecording: async (path) => {
        await window.electron.recordingStorage.openRecording(path);
      },
      revealRecording: async (path) => {
        await window.electron.recordingStorage.revealRecording(path);
      },
      deleteRecording: async (path) => {
        const result =
          await window.electron.recordingStorage.deleteRecording(path);
        if (!result.ok) {
          set((state) => {
            state.recordingStorage.error =
              result.error ?? "Recording delete failed";
          });
          return;
        }

        set((state) => {
          const deletedRecording = state.recordingStorage.recordings.find(
            (recording) => recording.path === path,
          );
          if (deletedRecording) {
            delete state.recordingStorage.selectedRecordingIds[
              deletedRecording.id
            ];
          }

          state.recordingStorage.error = null;
        });
        await refreshRecordingsAndUsage();
        set((state) => {
          state.recordingStorage.error = result.cleanupError ?? null;
        });
      },
      deleteSelectedRecordings: async () => {
        const state = get();
        const selectedPaths = state.recordingStorage.recordings
          .filter(
            (recording) =>
              state.recordingStorage.selectedRecordingIds[recording.id],
          )
          .map((recording) => recording.path);

        if (selectedPaths.length === 0) {
          return;
        }

        const result =
          await window.electron.recordingStorage.deleteManyRecordings(
            selectedPaths,
          );
        await refreshRecordingsAndUsage();
        set((state) => {
          state.recordingStorage.selectedRecordingIds = {};
          state.recordingStorage.error =
            result.cleanupErrors?.[0]?.error ??
            (result.ok ? null : result.error);
        });
      },
      setSelectedRecordingIds: (ids) => {
        set((state) => {
          state.recordingStorage.selectedRecordingIds = ids;
        });
      },
      clearSelectedRecordings: () => {
        set((state) => {
          state.recordingStorage.selectedRecordingIds = {};
        });
      },
    },
  };
};
