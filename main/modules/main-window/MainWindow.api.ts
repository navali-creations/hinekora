import { ipcRenderer } from "electron";

import { MainWindowChannel } from "./MainWindow.channels";

const MainWindowAPI = {
  minimize: (): Promise<void> => ipcRenderer.invoke(MainWindowChannel.Minimize),
  maximize: (): Promise<boolean> =>
    ipcRenderer.invoke(MainWindowChannel.Maximize),
  unmaximize: (): Promise<boolean> =>
    ipcRenderer.invoke(MainWindowChannel.Unmaximize),
  isMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke(MainWindowChannel.IsMaximized),
  close: (): Promise<void> => ipcRenderer.invoke(MainWindowChannel.Close),
};

export { MainWindowAPI };
