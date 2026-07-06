import { ipcRenderer } from "electron";

import { PoeProcessChannel } from "./PoeProcess.channels";
import type { PoeProcessError, PoeProcessSnapshot } from "./PoeProcess.dto";

const PoeProcessAPI = {
  getSnapshot: (): Promise<PoeProcessSnapshot> =>
    ipcRenderer.invoke(PoeProcessChannel.GetSnapshot),
  onStart: (callback: (state: PoeProcessSnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: PoeProcessSnapshot,
    ) => {
      callback(state);
    };
    ipcRenderer.on(PoeProcessChannel.Start, listener);

    return () => ipcRenderer.removeListener(PoeProcessChannel.Start, listener);
  },
  onStop: (callback: (state: PoeProcessSnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: PoeProcessSnapshot,
    ) => {
      callback(state);
    };
    ipcRenderer.on(PoeProcessChannel.Stop, listener);

    return () => ipcRenderer.removeListener(PoeProcessChannel.Stop, listener);
  },
  onSnapshot: (callback: (state: PoeProcessSnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: PoeProcessSnapshot,
    ) => {
      callback(state);
    };
    ipcRenderer.on(PoeProcessChannel.SnapshotChanged, listener);

    return () =>
      ipcRenderer.removeListener(PoeProcessChannel.SnapshotChanged, listener);
  },
  onError: (callback: (error: PoeProcessError) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      error: PoeProcessError,
    ) => {
      callback(error);
    };
    ipcRenderer.on(PoeProcessChannel.GetError, listener);

    return () =>
      ipcRenderer.removeListener(PoeProcessChannel.GetError, listener);
  },
};

export { PoeProcessAPI };
