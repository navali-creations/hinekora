import { ipcRenderer } from "electron";

import type { ClientLogStatus } from "~/types";
import { ClientLogChannel } from "./ClientLog.channels";
import type {
  ClientLogActiveGameInput,
  ClientLogPathInput,
} from "./ClientLog.dto";

const ClientLogAPI = {
  getStatus: (): Promise<ClientLogStatus> =>
    ipcRenderer.invoke(ClientLogChannel.GetStatus),
  setPath: (input: ClientLogPathInput): Promise<ClientLogStatus> =>
    ipcRenderer.invoke(ClientLogChannel.SetPath, input),
  setActiveGame: (input: ClientLogActiveGameInput): Promise<ClientLogStatus> =>
    ipcRenderer.invoke(ClientLogChannel.SetActiveGame, input),
  onStatusChanged: (callback: (status: ClientLogStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: ClientLogStatus,
    ) => {
      callback(status);
    };
    ipcRenderer.on(ClientLogChannel.StatusChanged, listener);

    return () =>
      ipcRenderer.removeListener(ClientLogChannel.StatusChanged, listener);
  },
};

export { ClientLogAPI };
