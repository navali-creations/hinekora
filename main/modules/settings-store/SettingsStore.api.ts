import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import type { AppSettings } from "~/types";
import { SettingsStoreChannel } from "./SettingsStore.channels";
import type {
  SettingsStoreClipPreviewOverlaySnapshot,
  SettingsStoreOverlaySnapshot,
  SettingsUpdateInput,
} from "./SettingsStore.dto";

const SettingsStoreAPI = {
  scope: "full" as const,
  get: (): Promise<AppSettings> =>
    ipcRenderer.invoke(SettingsStoreChannel.Get).then(unwrapIpcResult),
  getClipPreviewOverlaySnapshot:
    (): Promise<SettingsStoreClipPreviewOverlaySnapshot> =>
      ipcRenderer
        .invoke(SettingsStoreChannel.GetClipPreviewOverlaySnapshot)
        .then(unwrapIpcResult),
  dismissClipPreviewInfoAlert:
    (): Promise<SettingsStoreClipPreviewOverlaySnapshot> =>
      ipcRenderer
        .invoke(SettingsStoreChannel.Update, {
          clipPreviewInfoAlertDismissed: true,
        })
        .then(unwrapIpcResult),
  getOverlaySnapshot: (): Promise<SettingsStoreOverlaySnapshot> =>
    ipcRenderer
      .invoke(SettingsStoreChannel.GetOverlaySnapshot)
      .then(unwrapIpcResult),
  onChanged: (callback: (settings: AppSettings) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: AppSettings,
    ) => {
      callback(settings);
    };

    ipcRenderer.on(SettingsStoreChannel.Changed, listener);

    return () =>
      ipcRenderer.removeListener(SettingsStoreChannel.Changed, listener);
  },
  onClipPreviewOverlayChanged: (
    callback: (settings: SettingsStoreClipPreviewOverlaySnapshot) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: SettingsStoreClipPreviewOverlaySnapshot,
    ) => {
      callback(settings);
    };

    ipcRenderer.on(SettingsStoreChannel.ClipPreviewOverlayChanged, listener);

    return () =>
      ipcRenderer.removeListener(
        SettingsStoreChannel.ClipPreviewOverlayChanged,
        listener,
      );
  },
  onOverlayChanged: (
    callback: (settings: SettingsStoreOverlaySnapshot) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: SettingsStoreOverlaySnapshot,
    ) => {
      callback(settings);
    };

    ipcRenderer.on(SettingsStoreChannel.OverlayChanged, listener);

    return () =>
      ipcRenderer.removeListener(SettingsStoreChannel.OverlayChanged, listener);
  },
  update: (input: SettingsUpdateInput): Promise<AppSettings> =>
    ipcRenderer
      .invoke(SettingsStoreChannel.Update, input)
      .then(unwrapIpcResult),
};

export { SettingsStoreAPI };
