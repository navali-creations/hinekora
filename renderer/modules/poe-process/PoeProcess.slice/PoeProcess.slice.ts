import {
  createStoppedPoeProcessState,
  createStoppedPoeProcessStates,
  type PoeProcessSnapshot,
} from "~/main/modules/poe-process/PoeProcess.dto";
import type {
  BoundStoreStateCreator,
  PoeProcessSlice,
} from "~/renderer/store/store.types";

export const createPoeProcessSlice: BoundStoreStateCreator<PoeProcessSlice> = (
  set,
) => {
  let poeProcessChangeVersion = 0;

  return {
    poeProcess: {
      state: createStoppedPoeProcessState(),
      states: createStoppedPoeProcessStates(),
      error: null,
      hydrate: async () => {
        const changeVersion = poeProcessChangeVersion;
        const snapshot = await window.electron.poeProcess.getSnapshot();
        if (changeVersion !== poeProcessChangeVersion) {
          return;
        }

        set((store) => {
          store.poeProcess.state = snapshot.activeState;
          store.poeProcess.states = snapshot.states;
          store.poeProcess.error = null;
        });
      },
      startListening: () => {
        const setProcessState = (snapshot: PoeProcessSnapshot) => {
          poeProcessChangeVersion += 1;
          set((store) => {
            store.poeProcess.state = snapshot.activeState;
            store.poeProcess.states = snapshot.states;
            store.poeProcess.error = null;
          });
        };

        const unsubscribeStart =
          window.electron.poeProcess.onStart(setProcessState);
        const unsubscribeStop =
          window.electron.poeProcess.onStop(setProcessState);
        const unsubscribeState =
          window.electron.poeProcess.onSnapshot(setProcessState);
        const unsubscribeError = window.electron.poeProcess.onError((error) => {
          poeProcessChangeVersion += 1;
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
  };
};
