import type {
  BoundStoreStateCreator,
  ClientLogSlice,
} from "~/renderer/store/store.types";

export const createClientLogSlice: BoundStoreStateCreator<ClientLogSlice> = (
  set,
  get,
) => ({
  clientLog: {
    status: null,
    pendingPath: "",
    setPendingPath: (pendingPath) => {
      set((state) => {
        state.clientLog.pendingPath = pendingPath;
      });
    },
    hydrate: async () => {
      const status = await window.electron.clientLog.getStatus();
      set((state) => {
        state.clientLog.status = status;
        state.clientLog.pendingPath = status.path ?? "";
      });
    },
    savePath: async (path?: string) => {
      const settings = get().settings.value;
      const game = settings?.activeGame ?? "poe1";
      const nextPath = path ?? get().clientLog.pendingPath;
      const status = await window.electron.clientLog.setPath({
        game,
        path: nextPath,
      });
      set((state) => {
        state.clientLog.status = status;
        state.clientLog.pendingPath = nextPath;
      });
    },
    saveGamePath: async (game, path) => {
      const settings = get().settings.value;
      if (settings?.activeGame === game) {
        const status = await window.electron.clientLog.setPath({
          game,
          path,
        });
        set((state) => {
          state.clientLog.status = status;
          state.clientLog.pendingPath = status.path ?? "";
        });
        await get().settings.hydrate();
        return;
      }

      await get().settings.update(
        game === "poe1"
          ? { poe1ClientTxtPath: path }
          : { poe2ClientTxtPath: path },
      );
    },
    setActiveGame: async (game) => {
      const status = await window.electron.clientLog.setActiveGame({ game });
      await get().settings.hydrate();
      set((state) => {
        state.clientLog.status = status;
        state.clientLog.pendingPath = status.path ?? "";
      });
    },
    startListening: () =>
      window.electron.clientLog.onStatusChanged((status) => {
        set((state) => {
          state.clientLog.status = status;
        });
      }),
  },
});
