import { ipcRenderer } from "electron";

import { StorageChannel } from "./Storage.channels";
import type {
  DeleteGameLeagueDataResult,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
  StorageRevealPathsResult,
} from "./Storage.dto";

const StorageAPI = {
  getInfo: (): Promise<StorageInfo> =>
    ipcRenderer.invoke(StorageChannel.GetInfo),
  getGameLeagueUsage: (): Promise<StorageGameLeagueUsage[]> =>
    ipcRenderer.invoke(StorageChannel.GetGameLeagueUsage),
  deleteGameLeagueData: (
    input: StorageGameLeagueInput,
  ): Promise<DeleteGameLeagueDataResult> =>
    ipcRenderer.invoke(StorageChannel.DeleteGameLeagueData, input),
  revealPaths: (): Promise<StorageRevealPathsResult> =>
    ipcRenderer.invoke(StorageChannel.RevealPaths),
};

export { StorageAPI };
