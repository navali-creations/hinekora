import { ipcRenderer } from "electron";

import { UpdaterChannel } from "./Updater.channels";
import type { DownloadProgress, UpdateInfo } from "./Updater.service";

export interface LatestReleaseInfo {
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  url: string;
  changeType: string;
  entries: ChangelogEntry[];
}

export interface ChangelogEntry {
  description: string;
  content?: string;
  commitHash?: string;
  commitUrl?: string;
  contributor?: string;
  contributorUrl?: string;
  subItems?: string[];
}

export interface ChangelogRelease {
  version: string;
  changeType: string;
  entries: ChangelogEntry[];
}

export interface ChangelogResult {
  success: boolean;
  releases: ChangelogRelease[];
  error?: string;
}

const UpdaterAPI = {
  checkForUpdates: (): Promise<UpdateInfo | null> =>
    ipcRenderer.invoke(UpdaterChannel.CheckForUpdates),
  getUpdateInfo: (): Promise<UpdateInfo | null> =>
    ipcRenderer.invoke(UpdaterChannel.GetUpdateInfo),
  downloadUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(UpdaterChannel.DownloadUpdate),
  installUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(UpdaterChannel.InstallUpdate),
  getRecentReleases: (): Promise<LatestReleaseInfo[]> =>
    ipcRenderer.invoke(UpdaterChannel.GetRecentReleases),
  getChangelog: (): Promise<ChangelogResult> =>
    ipcRenderer.invoke(UpdaterChannel.GetChangelog),
  onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: UpdateInfo) =>
      callback(info);
    ipcRenderer.on(UpdaterChannel.OnUpdateAvailable, handler);
    return () => {
      ipcRenderer.removeListener(UpdaterChannel.OnUpdateAvailable, handler);
    };
  },
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: DownloadProgress,
    ) => callback(progress);
    ipcRenderer.on(UpdaterChannel.OnDownloadProgress, handler);
    return () => {
      ipcRenderer.removeListener(UpdaterChannel.OnDownloadProgress, handler);
    };
  },
};

export { UpdaterAPI };
