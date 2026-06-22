import { ipcRenderer } from "electron";

import type { OverlayPlacement } from "~/types";
import { OverlayWindowsChannel } from "./OverlayWindows.channels";
import type {
  CropRegionSelection,
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
  previewAuraPlacement: (
    profileId: string,
    placement: OverlayPlacement,
  ): Promise<void> =>
    ipcRenderer.invoke(
      OverlayWindowsChannel.PreviewAuraPlacement,
      profileId,
      placement,
    ),
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
