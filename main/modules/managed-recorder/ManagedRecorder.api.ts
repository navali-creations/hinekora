import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import type { ManagedRecorderStatus } from "~/types";
import { ManagedRecorderChannel } from "./ManagedRecorder.channels";
import type {
  ManagedRecorderAudioDevices,
  ManagedRecorderCaptureMode,
  ManagedRecorderListAudioDevicesOptions,
  ManagedRecordingStorageEstimateRequest,
  ManagedRecordingStorageEstimateResponse,
} from "./ManagedRecorder.dto";

const ManagedRecorderAPI = {
  getCaptureMode: (): Promise<ManagedRecorderCaptureMode> =>
    ipcRenderer.invoke(ManagedRecorderChannel.GetCaptureMode),
  getStatus: (): Promise<ManagedRecorderStatus> =>
    ipcRenderer.invoke(ManagedRecorderChannel.GetStatus),
  getRecordingStorageEstimates: (
    input: ManagedRecordingStorageEstimateRequest,
  ): Promise<ManagedRecordingStorageEstimateResponse> =>
    ipcRenderer
      .invoke(ManagedRecorderChannel.GetRecordingStorageEstimates, input)
      .then(unwrapIpcResult),
  listAudioDevices: (
    options: ManagedRecorderListAudioDevicesOptions = {},
  ): Promise<ManagedRecorderAudioDevices> =>
    ipcRenderer.invoke(
      ManagedRecorderChannel.ListAudioDevices,
      options.forceRefresh === true,
    ),
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
