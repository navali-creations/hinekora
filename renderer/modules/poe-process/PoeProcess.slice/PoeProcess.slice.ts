import type { PoeProcessState } from "~/main/modules/poe-process/PoeProcess.dto";
import type {
  BoundStoreStateCreator,
  PoeProcessSlice,
} from "~/renderer/store/store.types";

const stoppedPoeProcessState: PoeProcessState = {
  isRunning: false,
  processName: "",
};

export const createPoeProcessSlice: BoundStoreStateCreator<PoeProcessSlice> = (
  set,
) => ({
  poeProcess: {
    state: stoppedPoeProcessState,
    error: null,
    hydrate: async () => {
      const state = await window.electron.poeProcess.getState();
      set((store) => {
        store.poeProcess.state = state;
        store.poeProcess.error = null;
      });
    },
    startListening: () => {
      const setProcessState = (state: PoeProcessState) => {
        set((store) => {
          store.poeProcess.state = state;
          store.poeProcess.error = null;
        });
      };

      const unsubscribeStart =
        window.electron.poeProcess.onStart(setProcessState);
      const unsubscribeStop =
        window.electron.poeProcess.onStop(setProcessState);
      const unsubscribeState =
        window.electron.poeProcess.onState(setProcessState);
      const unsubscribeError = window.electron.poeProcess.onError((error) => {
        set((store) => {
          store.poeProcess.error = error.error;
        });
      });

      return () => {
        unsubscribeStart();
        unsubscribeStop();
        unsubscribeState();
        unsubscribeError();
      };
    },
  },
});
