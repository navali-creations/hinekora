import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import { MainWindowChannel } from "./MainWindow.channels";
import type { MainWindowOpenEditorClipOptions } from "./MainWindow.types";

const MainWindowAPI = {
  minimize: (): Promise<void> => ipcRenderer.invoke(MainWindowChannel.Minimize),
  maximize: (): Promise<boolean> =>
    ipcRenderer.invoke(MainWindowChannel.Maximize),
  unmaximize: (): Promise<boolean> =>
    ipcRenderer.invoke(MainWindowChannel.Unmaximize),
  isMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke(MainWindowChannel.IsMaximized),
  close: (): Promise<void> => ipcRenderer.invoke(MainWindowChannel.Close),
  openEditorClip: async (
    clipId: string,
    options?: MainWindowOpenEditorClipOptions,
  ): Promise<void> =>
    unwrapIpcResult(
      await ipcRenderer.invoke(
        MainWindowChannel.OpenEditorClip,
        clipId,
        options,
      ),
    ),
  openDevTools: (): Promise<void> =>
    ipcRenderer.invoke(MainWindowChannel.OpenDevTools),
};

export { MainWindowAPI };
