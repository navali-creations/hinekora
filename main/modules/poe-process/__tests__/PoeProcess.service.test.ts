import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIpcMainHandlers } from "~/main/test/ipc";

import { PoeProcessChannel } from "../PoeProcess.channels";
import { PoeProcessService } from "../PoeProcess.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  powerMonitorOn: vi.fn(),
}));

const pollerMocks = vi.hoisted(() => ({
  getActiveGame: null as null | (() => "poe1" | "poe2"),
  listeners: new Map<string, (...args: unknown[]) => void>(),
  pollNow: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  recorderSetGameRunningState: vi.fn(),
  overlaySetGameRunningActive: vi.fn(),
}));

const originalPlatform = process.platform;

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
  ipcMain: {
    handle: vi.fn(),
  },
  powerMonitor: {
    on: electronMocks.powerMonitorOn,
  },
}));

vi.mock("~/main/modules/managed-recorder", () => ({
  ManagedRecorderService: {
    getInstance: () => ({
      setGameRunningState: serviceMocks.recorderSetGameRunningState,
    }),
  },
}));

vi.mock("~/main/modules/overlay-windows", () => ({
  OverlayWindowsService: {
    getInstance: () => ({
      setGameRunningActive: serviceMocks.overlaySetGameRunningActive,
    }),
  },
}));

vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: () => ({
      get: serviceMocks.getSettings,
    }),
  },
}));

vi.mock("~/main/pollers", () => {
  class MockPoeProcessPoller {
    constructor(getActiveGame: () => "poe1" | "poe2") {
      pollerMocks.getActiveGame = getActiveGame;
    }

    on(event: string, listener: (...args: unknown[]) => void) {
      pollerMocks.listeners.set(event, listener);

      return this;
    }

    start = pollerMocks.start;
    stop = pollerMocks.stop;
    pollNow = pollerMocks.pollNow;
  }

  return {
    isPoeProcessStateForGame: (
      state: { isRunning: boolean; processName: string },
      game: "poe1" | "poe2",
    ) => {
      if (!state.isRunning) {
        return false;
      }

      const stateGame = state.processName.toLowerCase().includes("pathofexile2")
        ? "poe2"
        : "poe1";

      return stateGame === game;
    },
    PoeProcessPoller: MockPoeProcessPoller,
  };
});

function resetSingleton(): void {
  (
    PoeProcessService as unknown as { instance: PoeProcessService | null }
  ).instance = null;
}

function createWindow(options: { destroyed?: boolean; sendThrows?: boolean }) {
  return {
    isDestroyed: () => options.destroyed ?? false,
    webContents: {
      send: vi.fn(() => {
        if (options.sendThrows) {
          throw new Error("send failed");
        }
      }),
    },
  };
}

function getPollerListener(event: string): (...args: unknown[]) => void {
  const listener = pollerMocks.listeners.get(event);
  if (!listener) {
    throw new Error(`Missing poller listener: ${event}`);
  }

  return listener;
}

function getPowerListener(event: string): () => void {
  const call = electronMocks.powerMonitorOn.mock.calls.find(
    ([eventName]) => eventName === event,
  );
  if (!call) {
    throw new Error(`Missing power listener: ${event}`);
  }

  return call[1];
}

describe("PoeProcessService", () => {
  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "linux",
    });
    resetSingleton();
    pollerMocks.getActiveGame = null;
    pollerMocks.listeners.clear();
    pollerMocks.pollNow.mockReset();
    pollerMocks.start.mockReset();
    pollerMocks.stop.mockReset();
    electronMocks.getAllWindows.mockReset();
    electronMocks.getAllWindows.mockReturnValue([]);
    electronMocks.powerMonitorOn.mockReset();
    serviceMocks.getSettings.mockReset();
    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe2" });
    serviceMocks.recorderSetGameRunningState.mockReset();
    serviceMocks.recorderSetGameRunningState.mockResolvedValue(false);
    serviceMocks.overlaySetGameRunningActive.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("creates and reuses the singleton instance", () => {
    const first = PoeProcessService.getInstance();
    const second = PoeProcessService.getInstance();

    expect(first).toBe(second);
  });

  it("registers IPC and power handlers", () => {
    const { handlers } = mockIpcMainHandlers();
    const service = new PoeProcessService();

    expect(handlers.get(PoeProcessChannel.IsRunning)?.({})).toEqual({
      isRunning: false,
      processName: "",
    });
    expect(electronMocks.powerMonitorOn).toHaveBeenCalledWith(
      "suspend",
      expect.any(Function),
    );
    expect(electronMocks.powerMonitorOn).toHaveBeenCalledWith(
      "resume",
      expect.any(Function),
    );
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(pollerMocks.getActiveGame?.()).toBe("poe2");
  });

  it("starts and stops the poller", () => {
    const service = new PoeProcessService();

    service.initialize();
    service.stop();

    expect(pollerMocks.start).toHaveBeenCalledTimes(1);
    expect(pollerMocks.stop).toHaveBeenCalledTimes(1);
  });

  it("tracks poller start, data, and stop events", () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    service.initialize();

    getPollerListener("start")({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    expect(service.getState()).toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    expect(service.isActiveGameRunning()).toBe(true);
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      true,
    );
    expect(serviceMocks.recorderSetGameRunningState).toHaveBeenLastCalledWith(
      true,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.Start,
      { isRunning: true, processName: "PathOfExile2Steam.exe" },
    );

    getPollerListener("data")({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    expect(service.isActiveGameRunning()).toBe(false);
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );

    getPollerListener("stop")({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.Stop,
      { isRunning: false, processName: "" },
    );
  });

  it("does not resync consumers or broadcast unchanged poller data", () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    service.initialize();

    getPollerListener("data")({
      isRunning: false,
      processName: "",
    });

    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(serviceMocks.overlaySetGameRunningActive).not.toHaveBeenCalled();
    expect(serviceMocks.recorderSetGameRunningState).not.toHaveBeenCalled();
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it("ignores late poller state events after stop", () => {
    const service = new PoeProcessService();
    service.initialize();
    service.stop();
    serviceMocks.getSettings.mockImplementation(() => {
      throw new Error("database closed");
    });

    expect(() => {
      getPollerListener("data")({
        isRunning: true,
        processName: "PathOfExile2Steam.exe",
      });
      getPollerListener("start")({
        isRunning: true,
        processName: "PathOfExile2Steam.exe",
      });
      getPollerListener("stop")({
        isRunning: true,
        processName: "PathOfExile2Steam.exe",
      });
      getPollerListener("error")(new Error("database closed"));
    }).not.toThrow();
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(serviceMocks.overlaySetGameRunningActive).not.toHaveBeenCalled();
    expect(serviceMocks.recorderSetGameRunningState).not.toHaveBeenCalled();
  });

  it("refreshes process state through the poller", async () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    pollerMocks.pollNow.mockResolvedValue({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });

    await expect(service.refreshState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      true,
    );
    expect(serviceMocks.recorderSetGameRunningState).toHaveBeenLastCalledWith(
      true,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.GetState,
      { isRunning: true, processName: "PathOfExile2Steam.exe" },
    );
  });

  it("resyncs consumers when the active game changes but process state does not", async () => {
    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe1" });
    const service = new PoeProcessService();
    service.initialize();

    getPollerListener("start")({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );

    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe2" });
    pollerMocks.pollNow.mockResolvedValue({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });

    await service.refreshState();

    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      true,
    );
    expect(serviceMocks.recorderSetGameRunningState).toHaveBeenLastCalledWith(
      true,
    );
  });

  it("keeps current state when refresh fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = new PoeProcessService();
    pollerMocks.pollNow.mockRejectedValue(new Error("poll failed"));

    await expect(service.refreshState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("PoE process refresh failed"),
      { error: "poll failed" },
    );
  });

  it("handles poller errors and renderer send failures", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const goodWindow = createWindow({});
    const destroyedWindow = createWindow({ destroyed: true });
    const throwingWindow = createWindow({ sendThrows: true });
    electronMocks.getAllWindows.mockReturnValue([
      destroyedWindow,
      throwingWindow,
      goodWindow,
    ]);
    const service = new PoeProcessService();
    service.initialize();

    getPollerListener("error")(new Error("process failed"));

    expect(goodWindow.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.GetError,
      { error: "process failed" },
    );
    expect(destroyedWindow.webContents.send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send process state"),
      {
        channel: PoeProcessChannel.GetError,
        error: "send failed",
      },
    );
  });

  it("logs recorder game-state sync failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    serviceMocks.recorderSetGameRunningState.mockRejectedValue(
      new Error("recorder failed"),
    );
    const service = new PoeProcessService();
    service.initialize();

    getPollerListener("start")({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await Promise.resolve();

    expect(service.isActiveGameRunning()).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to sync recorder game state"),
      { error: "recorder failed" },
    );
  });

  it("stops during suspend and restarts after resume only when initialized", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const service = new PoeProcessService();
    const suspend = getPowerListener("suspend");
    const resume = getPowerListener("resume");

    suspend();
    service.initialize();
    expect(pollerMocks.stop).toHaveBeenCalledTimes(1);
    expect(pollerMocks.start).not.toHaveBeenCalled();

    resume();
    expect(pollerMocks.start).toHaveBeenCalledTimes(1);
    suspend();
    expect(pollerMocks.stop).toHaveBeenCalledTimes(2);
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    pollerMocks.pollNow.mockResolvedValue({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await expect(service.refreshState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
    expect(pollerMocks.pollNow).not.toHaveBeenCalled();

    service.stop();
    pollerMocks.start.mockClear();
    resume();
    expect(pollerMocks.start).not.toHaveBeenCalled();
  });

  it("logs lock and unlock events", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    new PoeProcessService();

    getPowerListener("lock-screen")();
    getPowerListener("unlock-screen")();

    expect(info).toHaveBeenCalledWith(expect.stringContaining("Screen locked"));
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Screen unlocked"),
    );
  });
});
