import { BrowserWindow, type IpcMainInvokeEvent } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { getIpcWindowRole } from "~/main/utils/ipc-window-roles";

import { ManagedRecorderChannel } from "./ManagedRecorder.channels";
import type {
  ManagedRecorderCaptureMode,
  ManagedRecorderStatus,
} from "./ManagedRecorder.dto";

const MANAGED_RECORDER_LOG_SCOPE = "managed-recorder";
const managedRecorderWindowRoles = new Set<WindowName>([
  WindowName.Main,
  WindowName.RecorderOverlay,
]);

function sendToRenderer(
  channel: ManagedRecorderChannel,
  createData: (role: WindowName) => unknown,
): void {
  let windows: BrowserWindow[];
  try {
    windows = BrowserWindow.getAllWindows();
  } catch (error) {
    logWarn(MANAGED_RECORDER_LOG_SCOPE, "Recorder window listing failed", {
      channel,
      error: safeErrorMessage(error),
    });
    return;
  }

  for (const window of windows) {
    try {
      if (window.isDestroyed()) {
        continue;
      }
      const role = getIpcWindowRole({ sender: window.webContents });
      if (!role || !managedRecorderWindowRoles.has(role)) {
        continue;
      }
      window.webContents.send(channel, createData(role));
    } catch (error) {
      logWarn(MANAGED_RECORDER_LOG_SCOPE, "Recorder renderer update failed", {
        channel,
        error: safeErrorMessage(error),
      });
    }
  }
}

export function publishManagedRecorderStatus(
  status: ManagedRecorderStatus,
): void {
  sendToRenderer(ManagedRecorderChannel.StatusChanged, (role) =>
    createManagedRecorderStatusForWindowRole(status, role),
  );
}

export function publishManagedRecorderCaptureMode(
  captureMode: ManagedRecorderCaptureMode,
): void {
  sendToRenderer(ManagedRecorderChannel.CaptureModeChanged, () => captureMode);
}

export function createManagedRecorderStatusForWindowRole(
  status: ManagedRecorderStatus,
  role: WindowName | null,
): ManagedRecorderStatus {
  if (role !== WindowName.RecorderOverlay) {
    return status;
  }

  return {
    activeGame: status.activeGame,
    activeSessionDirectory: null,
    available: status.available,
    bufferActive: status.bufferActive,
    encoder: status.encoder,
    error: status.error,
    fps: status.fps,
    gameRunning: status.gameRunning,
    initialized: status.initialized,
    isStartingRecording: status.isStartingRecording,
    isStoppingRecording: status.isStoppingRecording,
    lastRecordingPath: null,
    outputDirectory: null,
    outputResolution: status.outputResolution,
    recording: status.recording,
    recordingStartedAt: status.recordingStartedAt,
    runRecordingActive: status.runRecordingActive,
    runRecordingSession: status.runRecordingSession
      ? { ...status.runRecordingSession, path: null }
      : null,
    runtime: status.runtime,
    runtimePath: null,
  };
}

export function createManagedRecorderStatusForIpcEvent(
  status: ManagedRecorderStatus,
  event: IpcMainInvokeEvent,
): ManagedRecorderStatus {
  return createManagedRecorderStatusForWindowRole(
    status,
    getIpcWindowRole(event),
  );
}
