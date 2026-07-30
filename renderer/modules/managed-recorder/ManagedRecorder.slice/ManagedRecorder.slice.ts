import type {
  BoundStoreStateCreator,
  ManagedRecorderSlice,
} from "~/renderer/store/store.types";

export const createManagedRecorderSlice: BoundStoreStateCreator<
  ManagedRecorderSlice
> = (set) => ({
  managedRecorder: {
    captureMode: "rewind",
    status: null,
    hydrate: async () => {
      const [captureMode, status] = await Promise.all([
        window.electron.managedRecorder.getCaptureMode(),
        window.electron.managedRecorder.getStatus(),
      ]);
      set((state) => {
        state.managedRecorder.captureMode = captureMode;
        state.managedRecorder.status = status;
      });
    },
    setCaptureMode: async (mode) => {
      set((state) => {
        state.managedRecorder.captureMode = mode;
      });
      const captureMode =
        await window.electron.managedRecorder.setCaptureMode(mode);
      set((state) => {
        state.managedRecorder.captureMode = captureMode;
      });
    },
    startBuffer: async () => {
      const status = await window.electron.managedRecorder.startBuffer();
      set((state) => {
        state.managedRecorder.captureMode = "rewind";
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
        state.managedRecorder.captureMode = "session";
        state.managedRecorder.status = status;
      });
    },
    stopRunRecording: async () => {
      const status = await window.electron.managedRecorder.stopRunRecording();
      set((state) => {
        state.managedRecorder.status = status;
      });
    },
    startListening: () => {
      const stopRecorderStatusListener =
        window.electron.managedRecorder.onStatusChanged((status) => {
          set((state) => {
            state.managedRecorder.status = status;
          });
        });
      const stopCaptureModeListener =
        window.electron.managedRecorder.onCaptureModeChanged((captureMode) => {
          set((state) => {
            state.managedRecorder.captureMode = captureMode;
          });
        });

      return () => {
        stopRecorderStatusListener();
        stopCaptureModeListener();
      };
    },
  },
});
