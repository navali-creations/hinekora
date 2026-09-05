import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import * as AppLog from "~/main/utils/app-log";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import type { ManagedRecorderStatus } from "~/types";
import { ManagedRecorderChannel } from "../ManagedRecorder.channels";
import {
  publishManagedRecorderCaptureMode,
  publishManagedRecorderStatus,
} from "../ManagedRecorder.status-publisher";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
}));

describe("ManagedRecorder status publisher", () => {
  beforeEach(() => {
    electronMocks.getAllWindows.mockReset();
  });

  afterEach(() => {
    clearIpcWindowRolesForTests();
    vi.restoreAllMocks();
  });

  it("publishes recorder updates only to live authorized windows", () => {
    const mainContents = { id: 1, send: vi.fn() };
    const recorderOverlayContents = { id: 2, send: vi.fn() };
    const auraOverlayContents = { id: 3, send: vi.fn() };
    const unregisteredContents = { id: 4, send: vi.fn() };
    const destroyedContents = { id: 5, send: vi.fn() };
    registerIpcWindowRole(mainContents, WindowName.Main);
    registerIpcWindowRole(recorderOverlayContents, WindowName.RecorderOverlay);
    registerIpcWindowRole(auraOverlayContents, WindowName.AuraOverlay);
    registerIpcWindowRole(destroyedContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: mainContents },
      { isDestroyed: () => false, webContents: recorderOverlayContents },
      { isDestroyed: () => false, webContents: auraOverlayContents },
      { isDestroyed: () => false, webContents: unregisteredContents },
      { isDestroyed: () => true, webContents: destroyedContents },
    ]);
    const status = {
      activeGame: "poe2",
      activeSessionDirectory: "C:\\recordings\\active",
      available: true,
      bufferActive: false,
      encoder: "h264",
      error: null,
      fps: 60,
      gameRunning: true,
      initialized: true,
      isStartingRecording: false,
      isStoppingRecording: false,
      lastRecordingPath: "C:\\recordings\\last.mp4",
      outputDirectory: "C:\\recordings",
      outputResolution: "1920x1080",
      recording: true,
      recordingStartedAt: "2026-09-05T10:00:00.000Z",
      runRecordingActive: true,
      runRecordingSession: {
        framesPerSecond: 60,
        path: "C:\\recordings\\run.mp4",
        sourceGame: "poe2",
        sourceLeague: "Standard",
        startedAt: "2026-09-05T10:00:00.000Z",
        state: "recording",
        stoppedAt: null,
      },
      runtime: "packaged_obs",
      runtimePath: "C:\\obs",
    } satisfies ManagedRecorderStatus;

    publishManagedRecorderStatus(status);
    publishManagedRecorderCaptureMode("session");

    expect(mainContents.send).toHaveBeenCalledWith(
      ManagedRecorderChannel.StatusChanged,
      status,
    );
    expect(recorderOverlayContents.send).toHaveBeenCalledWith(
      ManagedRecorderChannel.StatusChanged,
      {
        ...status,
        activeSessionDirectory: null,
        lastRecordingPath: null,
        outputDirectory: null,
        runRecordingSession: {
          ...status.runRecordingSession,
          path: null,
        },
        runtimePath: null,
      },
    );
    for (const contents of [mainContents, recorderOverlayContents]) {
      expect(contents.send).toHaveBeenCalledWith(
        ManagedRecorderChannel.CaptureModeChanged,
        "session",
      );
    }
    expect(auraOverlayContents.send).not.toHaveBeenCalled();
    expect(unregisteredContents.send).not.toHaveBeenCalled();
    expect(destroyedContents.send).not.toHaveBeenCalled();
  });

  it("isolates renderer delivery failures", () => {
    const failedContents = {
      id: 1,
      send: vi.fn(() => {
        throw new Error("window closed");
      }),
    };
    const liveContents = { id: 2, send: vi.fn() };
    registerIpcWindowRole(failedContents, WindowName.Main);
    registerIpcWindowRole(liveContents, WindowName.RecorderOverlay);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: failedContents },
      { isDestroyed: () => false, webContents: liveContents },
    ]);
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});

    expect(() => publishManagedRecorderCaptureMode("rewind")).not.toThrow();
    expect(liveContents.send).toHaveBeenCalledWith(
      ManagedRecorderChannel.CaptureModeChanged,
      "rewind",
    );
    expect(logWarn).toHaveBeenCalledWith(
      "managed-recorder",
      "Recorder renderer update failed",
      {
        channel: ManagedRecorderChannel.CaptureModeChanged,
        error: "window closed",
      },
    );
  });

  it("logs and ignores window enumeration failures", () => {
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    electronMocks.getAllWindows.mockImplementation(() => {
      throw new Error("windows unavailable");
    });

    expect(() => publishManagedRecorderCaptureMode("rewind")).not.toThrow();
    expect(logWarn).toHaveBeenCalledWith(
      "managed-recorder",
      "Recorder window listing failed",
      {
        channel: ManagedRecorderChannel.CaptureModeChanged,
        error: "windows unavailable",
      },
    );
  });
});
