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
        state.replayStatusOverlay.status = null;
      });
      if (!clipId) {
        return () => {};
      }

      let disposed = false;
      let receivedStatus = false;
      const api = getReplayStatusOverlayElectronAPI().replayStatusOverlay;
      const unsubscribe = api.onStatusChanged((status) => {
        if (disposed) {
          return;
        }
        receivedStatus = true;
        set((state) => {
          state.replayStatusOverlay.status = status;
        });
      });

      // Subscribe first; a newer event must win over a delayed snapshot.
      void api
        .getSnapshot()
        .then((status) => {
          if (!disposed && !receivedStatus) {
            set((state) => {
              state.replayStatusOverlay.status = status;
            });
          }
        })
        .catch(() => undefined);

      return () => {
        disposed = true;
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
