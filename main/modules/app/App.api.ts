import { ipcRenderer } from "electron";

import { AppChannel } from "./App.channels";
import type { AppSelectPathInput } from "./App.dto";

const AppAPI = {
  getVersion: (): Promise<string> => ipcRenderer.invoke(AppChannel.GetVersion),
  selectPath: (input: AppSelectPathInput): Promise<string | null> =>
    ipcRenderer.invoke(AppChannel.SelectPath, input),
};

export { AppAPI };
