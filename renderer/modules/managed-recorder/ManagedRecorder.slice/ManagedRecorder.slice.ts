import type {
  BoundStoreStateCreator,
  ManagedRecorderSlice,
} from "~/renderer/store/store.types";

export const createManagedRecorderSlice: BoundStoreStateCreator<
  ManagedRecorderSlice
> = (set) => ({
  managedRecorder: {
    status: null,
    hydrate: async () => {
      const status = await window.electron.managedRecorder.getStatus();
      set((state) => {
        state.managedRecorder.status = status;
      });
    },
    startBuffer: async () => {
      const status = await window.electron.managedRecorder.startBuffer();
      set((state) => {
        state.managedRecorder.status = status;
      });
    },
    stopBuffer: async () => {
      const status = await window.electron.managedRecorder.stopBuffer();
      set((state) => {
        state.managedRecorder.status = status;
      });
    },
    startRunRecording: async () => {
      const status = await window.electron.managedRecorder.startRunRecording();
      set((state) => {
        state.managedRecorder.status = status;
      });
    },
    stopRunRecording: async () => {
      const status = await window.electron.managedRecorder.stopRunRecording();
      set((state) => {
        state.managedRecorder.status = status;
      });
    },
    saveReplay: async () => {
      await window.electron.managedRecorder.saveReplay();
      const status = await window.electron.managedRecorder.getStatus();
      set((state) => {
        state.managedRecorder.status = status;
      });
    },
    startListening: () =>
      window.electron.managedRecorder.onStatusChanged((status) => {
        set((state) => {
          state.managedRecorder.status = status;
        });
      }),
  },
});
