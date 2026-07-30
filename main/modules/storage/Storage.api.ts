import { ipcRenderer } from "electron";

import { StorageChannel } from "./Storage.channels";
import type {
  DeleteGameLeagueDataResult,
  StorageAnalysisAvailability,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
  StorageRevealPathsResult,
} from "./Storage.dto";
import {
  DeleteGameLeagueDataResultSchema,
  StorageAnalysisAvailabilitySchema,
  StorageGameLeagueUsageListSchema,
  StorageInfoSchema,
  StorageRevealPathsResultSchema,
} from "./Storage.dto";

const StorageAPI = {
  getAnalysisAvailability: (): Promise<StorageAnalysisAvailability> =>
    ipcRenderer
      .invoke(StorageChannel.GetAnalysisAvailability)
      .then((value) => StorageAnalysisAvailabilitySchema.parse(value)),
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
  onAnalysisAvailabilityChanged: (
    callback: (availability: StorageAnalysisAvailability) => void,
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
      const availability = StorageAnalysisAvailabilitySchema.safeParse(value);
      if (availability.success) {
        callback(availability.data);
      }
    };

    ipcRenderer.on(StorageChannel.AnalysisAvailabilityChanged, listener);

    return () =>
      ipcRenderer.removeListener(
        StorageChannel.AnalysisAvailabilityChanged,
        listener,
      );
  },
};

export { StorageAPI };
