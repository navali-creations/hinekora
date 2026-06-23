import { ipcRenderer } from "electron";

import { OverlayWindowsChannel } from "./OverlayWindows.channels";
import type {
  CropRegionSelection,
  RecorderOverlayMode,
  ShowAuraOverlayOptions,
} from "./OverlayWindows.dto";

const OverlayWindowsAPI = {
  showRecorder: (): Promise<void> =>
    ipcRenderer.invoke(OverlayWindowsChannel.ShowRecorder),
  hideRecorder: (): Promise<void> =>
    ipcRenderer.invoke(OverlayWindowsChannel.HideRecorder),
  toggleRecorder: (): Promise<void> =>
    ipcRenderer.invoke(OverlayWindowsChannel.ToggleRecorder),
  isRecorderVisible: (): Promise<boolean> =>
    ipcRenderer.invoke(OverlayWindowsChannel.IsRecorderVisible),
  onRecorderVisibilityChanged: (callback: (isVisible: boolean) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      isVisible: boolean,
    ) => {
      callback(isVisible);
    };
    ipcRenderer.on(OverlayWindowsChannel.RecorderVisibilityChanged, listener);

    return () =>
      ipcRenderer.removeListener(
        OverlayWindowsChannel.RecorderVisibilityChanged,
        listener,
      );
  },
  getRecorderMode: (): Promise<RecorderOverlayMode> =>
    ipcRenderer.invoke(OverlayWindowsChannel.GetRecorderMode),
  setRecorderMode: (mode: RecorderOverlayMode): Promise<RecorderOverlayMode> =>
    ipcRenderer.invoke(OverlayWindowsChannel.SetRecorderMode, mode),
  onRecorderModeChanged: (callback: (mode: RecorderOverlayMode) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      mode: RecorderOverlayMode,
    ) => {
      callback(mode);
    };
    ipcRenderer.on(OverlayWindowsChannel.RecorderModeChanged, listener);

    return () =>
      ipcRenderer.removeListener(
        OverlayWindowsChannel.RecorderModeChanged,
        listener,
      );
  },
  hideClipPreview: (): Promise<void> =>
    ipcRenderer.invoke(OverlayWindowsChannel.HideClipPreview),
  showAura: (
    profileId?: string,
    options?: ShowAuraOverlayOptions,
  ): Promise<void> =>
    options === undefined
      ? ipcRenderer.invoke(OverlayWindowsChannel.ShowAura, profileId)
      : ipcRenderer.invoke(OverlayWindowsChannel.ShowAura, profileId, options),
  isAuraLocked: (): Promise<boolean> =>
    ipcRenderer.invoke(OverlayWindowsChannel.IsAuraLocked),
  setAuraLocked: (locked: boolean): Promise<void> =>
    ipcRenderer.invoke(OverlayWindowsChannel.SetAuraLocked, locked),
  onAuraLockChanged: (callback: (locked: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, locked: boolean) => {
      callback(locked);
    };
    ipcRenderer.on(OverlayWindowsChannel.AuraLockChanged, listener);

    return () =>
      ipcRenderer.removeListener(
        OverlayWindowsChannel.AuraLockChanged,
        listener,
      );
  },
  onAuraAddRequested: (callback: (requestId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: string) => {
      callback(requestId);
    };
    ipcRenderer.on(OverlayWindowsChannel.AuraAddRequested, listener);

    return () =>
      ipcRenderer.removeListener(
        OverlayWindowsChannel.AuraAddRequested,
        listener,
      );
  },
  selectCropRegion: (): Promise<CropRegionSelection | null> =>
    ipcRenderer.invoke(OverlayWindowsChannel.SelectCropRegion),
  completeCropRegionSelection: (
    selection: CropRegionSelection,
  ): Promise<void> =>
    ipcRenderer.invoke(
      OverlayWindowsChannel.CompleteCropRegionSelection,
      selection,
    ),
  cancelCropRegionSelection: (): Promise<void> =>
    ipcRenderer.invoke(OverlayWindowsChannel.CancelCropRegionSelection),
};

export { OverlayWindowsAPI };
