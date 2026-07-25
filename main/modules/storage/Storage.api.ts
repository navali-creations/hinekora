import { ipcRenderer } from "electron";

import { StorageChannel } from "./Storage.channels";
import type {
  DeleteGameLeagueDataResult,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
  StorageRevealPathsResult,
} from "./Storage.dto";
import {
  DeleteGameLeagueDataResultSchema,
  StorageGameLeagueUsageListSchema,
  StorageInfoSchema,
  StorageRevealPathsResultSchema,
} from "./Storage.dto";

const StorageAPI = {
  getInfo: (): Promise<StorageInfo> =>
    ipcRenderer
      .invoke(StorageChannel.GetInfo)
      .then((value) => StorageInfoSchema.parse(value)),
  getGameLeagueUsage: (): Promise<StorageGameLeagueUsage[]> =>
    ipcRenderer
      .invoke(StorageChannel.GetGameLeagueUsage)
      .then((value) => StorageGameLeagueUsageListSchema.parse(value)),
  deleteGameLeagueData: (
    input: StorageGameLeagueInput,
  ): Promise<DeleteGameLeagueDataResult> =>
    ipcRenderer
      .invoke(StorageChannel.DeleteGameLeagueData, input)
      .then((value) => DeleteGameLeagueDataResultSchema.parse(value)),
  revealPaths: (): Promise<StorageRevealPathsResult> =>
    ipcRenderer
      .invoke(StorageChannel.RevealPaths)
      .then((value) => StorageRevealPathsResultSchema.parse(value)),
};

export { StorageAPI };
