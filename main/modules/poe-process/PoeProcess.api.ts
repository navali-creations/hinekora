import { ipcRenderer } from "electron";

import { PoeProcessChannel } from "./PoeProcess.channels";
import type { PoeProcessError, PoeProcessState } from "./PoeProcess.dto";

const PoeProcessAPI = {
  getState: (): Promise<PoeProcessState> =>
    ipcRenderer.invoke(PoeProcessChannel.IsRunning),
  onStart: (callback: (state: PoeProcessState) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: PoeProcessState,
    ) => {
      callback(state);
    };
    ipcRenderer.on(PoeProcessChannel.Start, listener);

    return () => ipcRenderer.removeListener(PoeProcessChannel.Start, listener);
  },
  onStop: (callback: (state: PoeProcessState) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: PoeProcessState,
    ) => {
      callback(state);
    };
    ipcRenderer.on(PoeProcessChannel.Stop, listener);

    return () => ipcRenderer.removeListener(PoeProcessChannel.Stop, listener);
  },
  onState: (callback: (state: PoeProcessState) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: PoeProcessState,
    ) => {
      callback(state);
    };
    ipcRenderer.on(PoeProcessChannel.GetState, listener);

    return () =>
      ipcRenderer.removeListener(PoeProcessChannel.GetState, listener);
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
