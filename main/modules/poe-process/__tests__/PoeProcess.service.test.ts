import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
  type PoeProcessSnapshot,
} from "~/main/modules/poe-process/PoeProcess.dto";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import { createPoeProcessSnapshotFromState } from "~/main/test/poe-process";

import { CapturePreviewChannel } from "../../capture-preview/CapturePreview.channels";
import { PoeProcessChannel } from "../PoeProcess.channels";
import { PoeProcessService } from "../PoeProcess.service";

const electronMocks = vi.hoisted(() => ({
  appIsPackaged: false,
  getAllWindows: vi.fn(),
  powerMonitorOff: vi.fn(),
  powerMonitorOn: vi.fn(),
}));

const watcherMocks = vi.hoisted(() => ({
  clearPoeProcessStateProvider: vi.fn(),
  getActiveGame: null as null | (() => "poe1" | "poe2"),
  listeners: new Map<string, (...args: unknown[]) => void>(),
  pollSnapshot: vi.fn(),
  setPoeProcessStateProvider: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  watcherOptions: null as null | { isPackaged?: boolean },
}));

const serviceMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  onDidChangeSettings: vi.fn(),
  recorderSetGameRunningState: vi.fn(),
  overlaySetGameRunningActive: vi.fn(),
  settingsChangeListeners: [] as Array<
    (settings: { activeGame: "poe1" | "poe2" }) => void
  >,
}));

const originalPlatform = process.platform;

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return electronMocks.appIsPackaged;
    },
  },
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
  ipcMain: {
    handle: vi.fn(),
  },
  powerMonitor: {
    off: electronMocks.powerMonitorOff,
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
      onDidChange: serviceMocks.onDidChangeSettings,
    }),
  },
}));

vi.mock("~/main/pollers", () => {
  class MockPoeProcessWatcher {
    constructor(
      getActiveGame: () => "poe1" | "poe2",
      options?: { isPackaged?: boolean },
    ) {
      watcherMocks.getActiveGame = getActiveGame;
      watcherMocks.watcherOptions = options ?? null;
    }

    on(event: string, listener: (...args: unknown[]) => void) {
      watcherMocks.listeners.set(event, listener);

      return this;
    }

    start = watcherMocks.start;
    stop = watcherMocks.stop;
    pollSnapshot = watcherMocks.pollSnapshot;
    getMode = vi.fn(() => "helper");
  }

  return {
    PoeProcessWatcher: MockPoeProcessWatcher,
    clearPoeProcessStateProvider: watcherMocks.clearPoeProcessStateProvider,
    setPoeProcessStateProvider: watcherMocks.setPoeProcessStateProvider,
  };
});

function resetSingleton(): void {
  PoeProcessService.resetForTests();
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

function getWatcherListener(event: string): (...args: unknown[]) => void {
  const listener = watcherMocks.listeners.get(event);
  if (!listener) {
    throw new Error(`Missing watcher listener: ${event}`);
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

type PoeProcessSnapshotStateInput = Parameters<
  typeof createPoeProcessSnapshotFromState
>[0];

function createServiceSnapshotFromState(
  state: PoeProcessSnapshotStateInput,
  activeGame: "poe1" | "poe2" = serviceMocks.getSettings().activeGame,
): PoeProcessSnapshot {
  return createPoeProcessSnapshotFromState(state, activeGame);
}

describe("PoeProcessService", () => {
  beforeEach(() => {
    electronMocks.appIsPackaged = false;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "linux",
    });
    resetSingleton();
    watcherMocks.clearPoeProcessStateProvider.mockReset();
    watcherMocks.getActiveGame = null;
    watcherMocks.listeners.clear();
    watcherMocks.pollSnapshot.mockReset();
    watcherMocks.setPoeProcessStateProvider.mockReset();
    watcherMocks.start.mockReset();
    watcherMocks.stop.mockReset();
    watcherMocks.watcherOptions = null;
    electronMocks.getAllWindows.mockReset();
    electronMocks.getAllWindows.mockReturnValue([]);
    electronMocks.powerMonitorOff.mockReset();
    electronMocks.powerMonitorOn.mockReset();
    serviceMocks.getSettings.mockReset();
    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe2" });
    watcherMocks.pollSnapshot.mockResolvedValue(
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );
    serviceMocks.settingsChangeListeners = [];
    serviceMocks.onDidChangeSettings.mockReset();
    serviceMocks.onDidChangeSettings.mockImplementation((listener) => {
      serviceMocks.settingsChangeListeners.push(listener);

      return () => {
        serviceMocks.settingsChangeListeners =
          serviceMocks.settingsChangeListeners.filter(
            (item) => item !== listener,
          );
      };
    });
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

    expect(handlers.get(PoeProcessChannel.GetSnapshot)?.({})).toEqual(
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );
    expect(electronMocks.powerMonitorOn).toHaveBeenCalledWith(
      "suspend",
      expect.any(Function),
    );
    expect(electronMocks.powerMonitorOn).toHaveBeenCalledWith(
      "resume",
      expect.any(Function),
    );
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(watcherMocks.getActiveGame?.()).toBe("poe2");
    expect(watcherMocks.watcherOptions).toEqual({ isPackaged: false });
  });

  it("passes packaged runtime state to the watcher", () => {
    electronMocks.appIsPackaged = true;

    new PoeProcessService();

    expect(watcherMocks.watcherOptions).toEqual({ isPackaged: true });
  });

  it("starts and stops the watcher", () => {
    const service = new PoeProcessService();

    service.initialize();
    service.stop();

    expect(watcherMocks.start).toHaveBeenCalledTimes(1);
    expect(watcherMocks.stop).toHaveBeenCalledTimes(1);
  });

  it("disposes process listeners and clears its provider", () => {
    const service = new PoeProcessService();
    const provider = watcherMocks.setPoeProcessStateProvider.mock.calls[0]?.[0];
    const unsubscribeSettings = serviceMocks.onDidChangeSettings.mock.results[0]
      ?.value as (() => void) | undefined;

    service.dispose();

    expect(watcherMocks.stop).toHaveBeenCalledTimes(1);
    expect(unsubscribeSettings).toBeDefined();
    expect(serviceMocks.settingsChangeListeners).toHaveLength(0);
    expect(electronMocks.powerMonitorOff).toHaveBeenCalledWith(
      "suspend",
      getPowerListener("suspend"),
    );
    expect(electronMocks.powerMonitorOff).toHaveBeenCalledWith(
      "resume",
      getPowerListener("resume"),
    );
    expect(electronMocks.powerMonitorOff).toHaveBeenCalledWith(
      "lock-screen",
      getPowerListener("lock-screen"),
    );
    expect(electronMocks.powerMonitorOff).toHaveBeenCalledWith(
      "unlock-screen",
      getPowerListener("unlock-screen"),
    );
    expect(watcherMocks.clearPoeProcessStateProvider).toHaveBeenCalledWith(
      provider,
    );
  });

  it("refreshes provider state with the preferred game", async () => {
    const service = new PoeProcessService();
    const provider = watcherMocks.setPoeProcessStateProvider.mock
      .calls[0]?.[0] as
      | {
          refreshState(preferredGame: "poe1" | "poe2" | null): Promise<unknown>;
        }
      | undefined;
    watcherMocks.pollSnapshot.mockResolvedValue(
      createServiceSnapshotFromState({
        game: "poe1",
        isRunning: true,
        processName: "PathOfExile.exe",
      }),
    );

    expect(provider).toBeDefined();
    await expect(provider!.refreshState("poe1")).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      pid: 4241,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });

    expect(watcherMocks.pollSnapshot).toHaveBeenCalled();
    expect(service.getState()).toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("refreshes provider state through the service without a preferred game", async () => {
    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe1" });
    const service = new PoeProcessService();
    const provider = watcherMocks.setPoeProcessStateProvider.mock
      .calls[0]?.[0] as
      | {
          refreshState(preferredGame: "poe1" | "poe2" | null): Promise<unknown>;
        }
      | undefined;
    watcherMocks.pollSnapshot.mockResolvedValue(
      createServiceSnapshotFromState({
        game: "poe1",
        isRunning: true,
        processName: "PathOfExile.exe",
      }),
    );

    expect(provider).toBeDefined();
    await expect(provider!.refreshState(null)).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      pid: 4241,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });

    expect(watcherMocks.pollSnapshot).toHaveBeenCalled();
    expect(service.getState()).toEqual({
      game: "poe1",
      isRunning: true,
      pid: 4241,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
  });

  it("tracks watcher start, data, and stop events", () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    service.initialize();

    const poe2Snapshot = createServiceSnapshotFromState({
      game: "poe2",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    getWatcherListener("start")(poe2Snapshot);
    expect(service.getState()).toEqual({
      game: "poe2",
      isRunning: true,
      pid: 4242,
      processName: "PathOfExileSteam.exe",
      windowTitle: "Path of Exile 2",
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
      poe2Snapshot,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );

    getWatcherListener("data")(
      createServiceSnapshotFromState({
        game: "poe1",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );
    expect(service.isActiveGameRunning()).toBe(false);
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );

    getWatcherListener("stop")(poe2Snapshot);
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.Stop,
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );
    expect(window.webContents.send).toHaveBeenLastCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
  });

  it("does not resync consumers or broadcast unchanged watcher data", () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    service.initialize();

    getWatcherListener("data")(
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );

    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(serviceMocks.overlaySetGameRunningActive).not.toHaveBeenCalled();
    expect(serviceMocks.recorderSetGameRunningState).not.toHaveBeenCalled();
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it("resyncs consumers and broadcasts when only the resolved game changes", () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    service.initialize();

    getWatcherListener("start")(
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );
    expect(service.isActiveGameRunning()).toBe(true);
    window.webContents.send.mockClear();

    const poe1Snapshot = createServiceSnapshotFromState({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    getWatcherListener("data")(poe1Snapshot);

    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(service.isActiveGameRunning()).toBe(false);
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.SnapshotChanged,
      poe1Snapshot,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
  });

  it("ignores late watcher state events after stop", () => {
    const service = new PoeProcessService();
    service.initialize();
    service.stop();
    serviceMocks.getSettings.mockImplementation(() => {
      throw new Error("database closed");
    });

    expect(() => {
      const snapshot = createServiceSnapshotFromState(
        {
          game: "poe2",
          isRunning: true,
          processName: "PathOfExileSteam.exe",
        },
        "poe2",
      );
      getWatcherListener("data")(snapshot);
      getWatcherListener("start")(snapshot);
      getWatcherListener("stop")(snapshot);
      getWatcherListener("error")(new Error("database closed"));
    }).not.toThrow();
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(serviceMocks.overlaySetGameRunningActive).not.toHaveBeenCalled();
    expect(serviceMocks.recorderSetGameRunningState).not.toHaveBeenCalled();
  });

  it("refreshes process state through the watcher", async () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    watcherMocks.pollSnapshot.mockResolvedValue(
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );

    await expect(service.refreshState()).resolves.toEqual({
      game: "poe2",
      isRunning: true,
      pid: 4242,
      processName: "PathOfExileSteam.exe",
      windowTitle: "Path of Exile 2",
    });
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      true,
    );
    expect(serviceMocks.recorderSetGameRunningState).toHaveBeenLastCalledWith(
      true,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.SnapshotChanged,
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
  });

  it("skips capture source refresh requests for capture-preview-owned process refreshes", async () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    watcherMocks.pollSnapshot.mockResolvedValue(
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );

    await service.refreshState({ requestCapturePreviewRefresh: false });

    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.SnapshotChanged,
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );
    expect(window.webContents.send).not.toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
  });

  it("returns stopped for a preferred game that is not running during refresh", async () => {
    const service = new PoeProcessService();
    watcherMocks.pollSnapshot.mockResolvedValue(
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );

    await expect(
      service.refreshState({ preferredGame: "poe1" }),
    ).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("returns the cached preferred game state while suspended", async () => {
    const service = new PoeProcessService();
    service.initialize();
    watcherMocks.pollSnapshot.mockClear();

    getPowerListener("suspend")();

    await expect(
      service.refreshState({ preferredGame: "poe1" }),
    ).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
    expect(watcherMocks.pollSnapshot).not.toHaveBeenCalled();
  });

  it("keeps cached preferred game state when refresh fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = new PoeProcessService();
    watcherMocks.pollSnapshot.mockRejectedValue(new Error("watch failed"));

    await expect(
      service.refreshState({ preferredGame: "poe1" }),
    ).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("PoE process refresh failed"),
      expect.objectContaining({ error: "watch failed", watcherMode: "helper" }),
    );
  });

  it("refreshes the full process snapshot through the watcher", async () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    const snapshot = createServiceSnapshotFromState({
      game: "poe2",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    watcherMocks.pollSnapshot.mockResolvedValue(snapshot);

    await expect(service.refreshSnapshot()).resolves.toEqual(snapshot);

    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      true,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.SnapshotChanged,
      snapshot,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
  });

  it("resyncs consumers when a full process snapshot refresh is unchanged", async () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    const snapshot = createPoeProcessSnapshot(
      createStoppedPoeProcessStates(),
      "poe2",
    );
    watcherMocks.pollSnapshot.mockResolvedValue(snapshot);

    await expect(service.refreshSnapshot()).resolves.toEqual(snapshot);

    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );
    expect(serviceMocks.recorderSetGameRunningState).toHaveBeenLastCalledWith(
      false,
    );
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it("returns the cached process snapshot while suspended", async () => {
    const service = new PoeProcessService();
    service.initialize();
    watcherMocks.pollSnapshot.mockClear();

    getPowerListener("suspend")();

    await expect(service.refreshSnapshot()).resolves.toEqual(
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );
    expect(watcherMocks.pollSnapshot).not.toHaveBeenCalled();
  });

  it("keeps the cached process snapshot when full snapshot refresh fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = new PoeProcessService();
    watcherMocks.pollSnapshot.mockRejectedValue(new Error("watch failed"));

    await expect(service.refreshSnapshot()).resolves.toEqual(
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("PoE process refresh failed"),
      expect.objectContaining({ error: "watch failed", watcherMode: "helper" }),
    );
  });

  it("resyncs consumers when the active game changes but process state does not", async () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe1" });
    const service = new PoeProcessService();
    service.initialize();

    getWatcherListener("start")(
      createServiceSnapshotFromState(
        {
          game: "poe2",
          isRunning: true,
          processName: "PathOfExileSteam.exe",
        },
        "poe1",
      ),
    );
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );
    window.webContents.send.mockClear();

    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe2" });
    watcherMocks.pollSnapshot.mockResolvedValue(
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );
    for (const listener of serviceMocks.settingsChangeListeners) {
      listener({ activeGame: "poe2" });
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      true,
    );
    expect(serviceMocks.recorderSetGameRunningState).toHaveBeenLastCalledWith(
      true,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.SnapshotChanged,
      createServiceSnapshotFromState(
        {
          game: "poe2",
          isRunning: true,
          processName: "PathOfExileSteam.exe",
        },
        "poe2",
      ),
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
    window.webContents.send.mockClear();

    await service.refreshState();

    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      true,
    );
    expect(serviceMocks.recorderSetGameRunningState).toHaveBeenLastCalledWith(
      true,
    );
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it("resyncs consumers from the cached snapshot when active game changes during suspend", async () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    service.initialize();
    watcherMocks.pollSnapshot.mockClear();

    getPowerListener("suspend")();
    window.webContents.send.mockClear();
    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe1" });
    for (const listener of serviceMocks.settingsChangeListeners) {
      listener({ activeGame: "poe1" });
    }
    await Promise.resolve();

    expect(watcherMocks.pollSnapshot).not.toHaveBeenCalled();
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.SnapshotChanged,
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe1"),
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
  });

  it("resyncs consumers when an active-game refresh receives an unchanged watcher snapshot", async () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    service.initialize();
    watcherMocks.pollSnapshot.mockResolvedValue(
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );

    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe1" });
    for (const listener of serviceMocks.settingsChangeListeners) {
      listener({ activeGame: "poe1" });
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );
    expect(serviceMocks.recorderSetGameRunningState).toHaveBeenLastCalledWith(
      false,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.SnapshotChanged,
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe1"),
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
  });

  it("ignores settings changes when the active game stays the same", () => {
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    new PoeProcessService();

    for (const listener of serviceMocks.settingsChangeListeners) {
      listener({ activeGame: "poe2" });
    }

    expect(serviceMocks.overlaySetGameRunningActive).not.toHaveBeenCalled();
    expect(serviceMocks.recorderSetGameRunningState).not.toHaveBeenCalled();
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it("keeps current state when refresh fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = new PoeProcessService();
    watcherMocks.pollSnapshot.mockRejectedValue(new Error("watch failed"));

    await expect(service.refreshState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("PoE process refresh failed"),
      expect.objectContaining({ error: "watch failed" }),
    );
  });

  it("keeps current state when active-game refresh fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const window = createWindow({});
    electronMocks.getAllWindows.mockReturnValue([window]);
    const service = new PoeProcessService();
    service.initialize();
    watcherMocks.pollSnapshot.mockRejectedValue(new Error("watch failed"));

    serviceMocks.getSettings.mockReturnValue({ activeGame: "poe1" });
    for (const listener of serviceMocks.settingsChangeListeners) {
      listener({ activeGame: "poe1" });
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("PoE process active-game refresh failed"),
      expect.objectContaining({ error: "watch failed", watcherMode: "helper" }),
    );
    expect(serviceMocks.overlaySetGameRunningActive).toHaveBeenLastCalledWith(
      false,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      PoeProcessChannel.SnapshotChanged,
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe1"),
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      CapturePreviewChannel.RefreshRequested,
    );
  });

  it("handles watcher errors and renderer send failures", () => {
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

    getWatcherListener("error")(new Error("process failed"));

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

    getWatcherListener("start")(
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );
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
    expect(watcherMocks.stop).toHaveBeenCalledTimes(1);
    expect(watcherMocks.start).not.toHaveBeenCalled();

    resume();
    expect(watcherMocks.start).toHaveBeenCalledTimes(1);
    suspend();
    expect(watcherMocks.stop).toHaveBeenCalledTimes(2);
    expect(service.getState()).toEqual({ isRunning: false, processName: "" });
    watcherMocks.pollSnapshot.mockResolvedValue(
      createServiceSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );
    await expect(service.refreshState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
    expect(watcherMocks.pollSnapshot).not.toHaveBeenCalled();

    service.stop();
    watcherMocks.start.mockClear();
    resume();
    expect(watcherMocks.start).not.toHaveBeenCalled();
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
