import { trackEvent } from "~/renderer/modules/umami";
import type {
  BoundStoreStateCreator,
  ManagedRecorderSlice,
} from "~/renderer/store/store.types";

export const createManagedRecorderSlice: BoundStoreStateCreator<
  ManagedRecorderSlice
> = (set, get) => ({
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
      trackEvent("recording-rewind-started");
    },
    stopBuffer: async () => {
      const status = await window.electron.managedRecorder.stopBuffer();
      set((state) => {
        state.managedRecorder.status = status;
      });
      trackEvent("recording-rewind-stopped");
    },
    startRunRecording: async () => {
      const status = await window.electron.managedRecorder.startRunRecording();
      set((state) => {
        state.managedRecorder.captureMode = "session";
        state.managedRecorder.status = status;
      });
      trackEvent("recording-session-started");
    },
    stopRunRecording: async () => {
      const status = await window.electron.managedRecorder.stopRunRecording();
      set((state) => {
        state.managedRecorder.status = status;
      });
      trackEvent("recording-session-stopped");
    },
    saveReplay: async () => {
      await window.electron.managedRecorder.saveReplay();
      const status = await window.electron.managedRecorder.getStatus();
      set((state) => {
        state.managedRecorder.status = status;
      });
      trackEvent("recording-manual-replay-requested");
    },
    startListening: () => {
      const stopRecorderStatusListener =
        window.electron.managedRecorder.onStatusChanged((status) => {
          let shouldRefreshCapturePreview = false;
          set((state) => {
            shouldRefreshCapturePreview =
              state.managedRecorder.status?.gameRunning !== true &&
              status.gameRunning === true;
            state.managedRecorder.status = status;
          });
          if (shouldRefreshCapturePreview) {
            void get().capturePreview.refresh({ force: true });
          }
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
