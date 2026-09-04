import type { ReplayStatusOverlayEvent } from "~/main/modules/replay-status-overlay/ReplayStatusOverlay.dto";
import type { ReplayStatusOverlayElectronAPI } from "~/renderer/preload";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

interface ReplayStatusOverlaySlice {
  replayStatusOverlay: {
    startListening: (clipId: string | null) => () => void;
    status: ReplayStatusOverlayEvent | null;
  };
}

function getReplayStatusOverlayElectronAPI(): ReplayStatusOverlayElectronAPI {
  return (
    window as unknown as Window & {
      electron: ReplayStatusOverlayElectronAPI;
    }
  ).electron;
}

const createReplayStatusOverlaySlice: BoundStoreStateCreator<
  ReplayStatusOverlaySlice
> = (set) => ({
  replayStatusOverlay: {
    startListening: (clipId) => {
      set((state) => {
        state.replayStatusOverlay.status = clipId
          ? { clipId, dismissing: false, status: "processing" }
          : null;
      });
      if (!clipId) {
        return () => {};
      }

      const unsubscribe =
        getReplayStatusOverlayElectronAPI().replayStatusOverlay.onStatusChanged(
          (status) => {
            set((state) => {
              state.replayStatusOverlay.status = status;
            });
          },
        );

      return () => {
        unsubscribe();
        set((state) => {
          state.replayStatusOverlay.status = null;
        });
      };
    },
    status: null,
  },
});

export type { ReplayStatusOverlaySlice };
export { createReplayStatusOverlaySlice };
