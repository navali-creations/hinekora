import { ipcRenderer } from "electron";

import type { AppSettings } from "~/types";
import { SettingsStoreChannel } from "./SettingsStore.channels";
import type { SettingsUpdateInput } from "./SettingsStore.dto";

const SettingsStoreAPI = {
  get: (): Promise<AppSettings> => ipcRenderer.invoke(SettingsStoreChannel.Get),
  update: (input: SettingsUpdateInput): Promise<AppSettings> =>
    ipcRenderer.invoke(SettingsStoreChannel.Update, input),
};

export { SettingsStoreAPI };
