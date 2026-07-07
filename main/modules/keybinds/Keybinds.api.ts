import { ipcRenderer } from "electron";

import { KeybindsChannel } from "./Keybinds.channels";
import type { KeybindRegistrationStatus } from "./Keybinds.dto";

const KeybindsAPI = {
  getStatus: (): Promise<KeybindRegistrationStatus> =>
    ipcRenderer.invoke(KeybindsChannel.GetStatus),
  onStatusChanged: (
    callback: (status: KeybindRegistrationStatus) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: KeybindRegistrationStatus,
    ) => {
      callback(status);
    };

    ipcRenderer.on(KeybindsChannel.StatusChanged, listener);

    return () =>
      ipcRenderer.removeListener(KeybindsChannel.StatusChanged, listener);
  },
};

export { KeybindsAPI };
