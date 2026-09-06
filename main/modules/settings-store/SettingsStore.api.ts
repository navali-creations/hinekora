import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import type { AppSettings } from "~/types";
import { SettingsStoreChannel } from "./SettingsStore.channels";
import type {
  SettingsStoreAuraOverlaySnapshot,
  SettingsStoreAuraOverlayUpdate,
  SettingsStoreClipPreviewOverlaySnapshot,
  SettingsStoreCommonOverlaySnapshot,
  SettingsStoreRecorderOverlaySnapshot,
  SettingsUpdateInput,
} from "./SettingsStore.dto";

function getOverlaySnapshot<
  TSnapshot extends SettingsStoreCommonOverlaySnapshot,
>(): Promise<TSnapshot> {
  return ipcRenderer
    .invoke(SettingsStoreChannel.GetOverlaySnapshot)
    .then(unwrapIpcResult);
}

function onOverlayChanged<TSnapshot extends SettingsStoreCommonOverlaySnapshot>(
  callback: (settings: TSnapshot) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, settings: TSnapshot) => {
    callback(settings);
  };

  ipcRenderer.on(SettingsStoreChannel.OverlayChanged, listener);

  return () =>
    ipcRenderer.removeListener(SettingsStoreChannel.OverlayChanged, listener);
}

const SettingsStoreAPI = {
  scope: "full" as const,
  get: (): Promise<AppSettings> =>
    ipcRenderer.invoke(SettingsStoreChannel.Get).then(unwrapIpcResult),
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
  update: (input: SettingsUpdateInput): Promise<AppSettings> =>
    ipcRenderer
      .invoke(SettingsStoreChannel.Update, input)
      .then(unwrapIpcResult),
};

const SettingsStoreClipPreviewOverlayAPI = {
  scope: "clip-preview-overlay" as const,
  dismissClipPreviewInfoAlert:
    (): Promise<SettingsStoreClipPreviewOverlaySnapshot> =>
      ipcRenderer
        .invoke(SettingsStoreChannel.Update, {
          clipPreviewInfoAlertDismissed: true,
        })
        .then(unwrapIpcResult),
  get: (): Promise<SettingsStoreClipPreviewOverlaySnapshot> =>
    ipcRenderer
      .invoke(SettingsStoreChannel.GetClipPreviewOverlaySnapshot)
      .then(unwrapIpcResult),
  onChanged: (
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
};

const SettingsStoreOverlayAPI = {
  scope: "aura-overlay" as const,
  get: (): Promise<SettingsStoreAuraOverlaySnapshot> => getOverlaySnapshot(),
  onChanged: (
    callback: (settings: SettingsStoreAuraOverlaySnapshot) => void,
  ): (() => void) => onOverlayChanged(callback),
  update: (
    input: SettingsStoreAuraOverlayUpdate,
  ): Promise<SettingsStoreAuraOverlaySnapshot> =>
    ipcRenderer
      .invoke(SettingsStoreChannel.Update, input)
      .then(unwrapIpcResult),
};

const SettingsStoreRecorderOverlayAPI = {
  scope: "recorder-overlay" as const,
  get: (): Promise<SettingsStoreRecorderOverlaySnapshot> =>
    getOverlaySnapshot(),
  onChanged: (
    callback: (settings: SettingsStoreRecorderOverlaySnapshot) => void,
  ): (() => void) => onOverlayChanged(callback),
};

export {
  SettingsStoreAPI,
  SettingsStoreClipPreviewOverlayAPI,
  SettingsStoreOverlayAPI,
  SettingsStoreRecorderOverlayAPI,
};
