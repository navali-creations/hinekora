import { ipcRenderer } from "electron";

import type { ManagedRecorderStatus } from "~/types";
import { ManagedRecorderChannel } from "./ManagedRecorder.channels";
import type {
  ManagedRecorderCaptureMode,
  ManagedReplaySaveResult,
} from "./ManagedRecorder.dto";

const ManagedRecorderAPI = {
  getCaptureMode: (): Promise<ManagedRecorderCaptureMode> =>
    ipcRenderer.invoke(ManagedRecorderChannel.GetCaptureMode),
  getStatus: (): Promise<ManagedRecorderStatus> =>
    ipcRenderer.invoke(ManagedRecorderChannel.GetStatus),
  setCaptureMode: (
    mode: ManagedRecorderCaptureMode,
  ): Promise<ManagedRecorderCaptureMode> =>
    ipcRenderer.invoke(ManagedRecorderChannel.SetCaptureMode, mode),
  startBuffer: (): Promise<ManagedRecorderStatus> =>
    ipcRenderer.invoke(ManagedRecorderChannel.StartBuffer),
  stopBuffer: (): Promise<ManagedRecorderStatus> =>
    ipcRenderer.invoke(ManagedRecorderChannel.StopBuffer),
  startRunRecording: (): Promise<ManagedRecorderStatus> =>
    ipcRenderer.invoke(ManagedRecorderChannel.StartRunRecording),
  stopRunRecording: (): Promise<ManagedRecorderStatus> =>
    ipcRenderer.invoke(ManagedRecorderChannel.StopRunRecording),
  saveReplay: (): Promise<ManagedReplaySaveResult> =>
    ipcRenderer.invoke(ManagedRecorderChannel.SaveReplay),
  onStatusChanged: (callback: (status: ManagedRecorderStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: ManagedRecorderStatus,
    ) => {
      callback(status);
    };
    ipcRenderer.on(ManagedRecorderChannel.StatusChanged, listener);

    return () =>
      ipcRenderer.removeListener(
        ManagedRecorderChannel.StatusChanged,
        listener,
      );
  },
  onCaptureModeChanged: (
    callback: (mode: ManagedRecorderCaptureMode) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      mode: ManagedRecorderCaptureMode,
    ) => {
      callback(mode);
    };
    ipcRenderer.on(ManagedRecorderChannel.CaptureModeChanged, listener);

    return () =>
      ipcRenderer.removeListener(
        ManagedRecorderChannel.CaptureModeChanged,
        listener,
      );
  },
};

export { ManagedRecorderAPI };
