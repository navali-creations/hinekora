import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientLogService } from "~/main/modules/client-log";
import { DatabaseService } from "~/main/modules/database";
import { EditorService } from "~/main/modules/editor";
import { KeybindsService } from "~/main/modules/keybinds";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { PoeProcessService } from "~/main/modules/poe-process";
import { UpdaterService } from "~/main/modules/updater";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import { AppChannel } from "../App.channels";
import { AppService } from "../App.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  getFocusedWindow: vi.fn(),
  getVersion: vi.fn(),
  handle: vi.fn(),
  on: vi.fn(),
  powerMonitorOn: vi.fn(),
  quit: vi.fn(),
  showOpenDialog: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getVersion: electronMocks.getVersion,
    on: electronMocks.on,
    quit: electronMocks.quit,
  },
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
    getFocusedWindow: electronMocks.getFocusedWindow,
  },
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog,
  },
  ipcMain: {
    handle: electronMocks.handle,
  },
  powerMonitor: {
    on: electronMocks.powerMonitorOn,
  },
}));

describe("AppService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMocks.getAllWindows.mockReturnValue([]);
    electronMocks.getFocusedWindow.mockReturnValue(null);
    electronMocks.getVersion.mockReturnValue("0.0.0");
    electronMocks.on.mockReset();
    electronMocks.powerMonitorOn.mockReset();
    electronMocks.quit.mockReset();
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
  });

  it("returns the app version", () => {
    electronMocks.getVersion.mockReturnValue("1.2.3");
    const service = new AppService();

    expect(service.version()).toBe("1.2.3");
  });

  it("creates and reuses the singleton instance", () => {
    const singletonAccess = AppService as unknown as {
      instance: AppService | null;
    };
    singletonAccess.instance = null;

    const first = AppService.getInstance();
    const second = AppService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("sanitizes select path options and uses an available parent window", async () => {
    const parent = { isDestroyed: () => false };
    const destroyed = { isDestroyed: () => true };
    electronMocks.getAllWindows.mockReturnValue([destroyed, parent]);
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["C:/Games/Path of Exile/Client.txt"],
    });
    const service = new AppService();

    await expect(
      service.selectPath({
        title: "  Select Client Log  ",
        defaultPath: "  C:/Games  ",
        properties: ["openFile", "openDirectory"],
        filters: [
          {
            name: "  Client logs  ",
            extensions: [".txt", "bad/path", "*"],
          },
          null,
        ],
      }),
    ).resolves.toBe("C:/Games/Path of Exile/Client.txt");
    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith(parent, {
      title: "Select Client Log",
      defaultPath: "C:/Games",
      properties: ["openDirectory"],
      filters: [{ name: "Client logs", extensions: ["txt", "*"] }],
    });
  });

  it("returns null when path selection is canceled", async () => {
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    const service = new AppService();

    await expect(
      service.selectPath({ properties: ["openFile"] }),
    ).resolves.toBeNull();
    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith({
      properties: ["openFile"],
    });
  });

  it("defaults unsafe or blank select path options", async () => {
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [],
    });
    const service = new AppService();

    await expect(
      service.selectPath({
        defaultPath: "   ",
        filters: [{ extensions: [".png"] }],
        properties: "openDirectory",
        title: "\t",
      }),
    ).resolves.toBeNull();
    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith({
      properties: ["openFile"],
      filters: [{ name: "Files", extensions: ["png"] }],
    });
  });

  it("drops unusable dialog filters", async () => {
    const service = new AppService();

    await expect(
      service.selectPath({
        properties: ["openFile"],
        filters: [
          { name: "Invalid extensions", extensions: "txt" },
          { name: "Unsafe extensions", extensions: ["bad/path"] },
        ],
      }),
    ).resolves.toBeNull();

    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith({
      properties: ["openFile"],
      filters: [],
    });
  });

  it("rejects invalid select path input", async () => {
    const service = new AppService();

    await expect(service.selectPath(null)).rejects.toThrow(
      "select path options must be an object",
    );
  });

  it("registers IPC handlers for version and path selection", async () => {
    const { handle, handlers } = mockIpcMainHandlers();
    electronMocks.getVersion.mockReturnValue("2.0.0");
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["C:/Games/Path of Exile/Client.txt"],
    });
    new AppService();

    expect(handlers.get(AppChannel.GetVersion)?.({})).toBe("2.0.0");
    await expect(
      handlers.get(AppChannel.SelectPath)?.({}, { properties: ["openFile"] }),
    ).resolves.toBe("C:/Games/Path of Exile/Client.txt");
    await expect(
      handlers.get(AppChannel.SelectPath)?.({}, null),
    ).resolves.toEqual({
      error: "select path options must be an object",
      ok: false,
    });
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it("runs shutdown cleanup once before resuming quit", async () => {
    const shutdownEditor = vi
      .spyOn(EditorService, "shutdownIfInitialized")
      .mockResolvedValue();
    let beforeQuit: ((event?: { preventDefault?(): void }) => void) | undefined;
    const services = {
      clientLog: { stopWatchFile: vi.fn() },
      database: { close: vi.fn() },
      managedRecorder: {
        getStatus: vi.fn(() => ({
          bufferActive: true,
          runRecordingActive: true,
        })),
        stopBuffer: vi.fn().mockResolvedValue({}),
        stopRunRecording: vi.fn().mockResolvedValue({}),
      },
      keybinds: { destroy: vi.fn() },
      overlayWindows: { destroyAll: vi.fn() },
      poeProcess: { stop: vi.fn() },
      updater: { destroy: vi.fn() },
    };
    electronMocks.on.mockImplementation((_event, listener) => {
      beforeQuit = listener;
    });
    vi.spyOn(ClientLogService, "getInstance").mockReturnValue(
      services.clientLog as unknown as ClientLogService,
    );
    vi.spyOn(DatabaseService, "getInstance").mockReturnValue(
      services.database as unknown as DatabaseService,
    );
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue(
      services.managedRecorder as unknown as ManagedRecorderService,
    );
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue(
      services.overlayWindows as unknown as OverlayWindowsService,
    );
    vi.spyOn(PoeProcessService, "getInstance").mockReturnValue(
      services.poeProcess as unknown as PoeProcessService,
    );
    vi.spyOn(UpdaterService, "getInstance").mockReturnValue(
      services.updater as unknown as UpdaterService,
    );
    vi.spyOn(KeybindsService, "getInstance").mockReturnValue(
      services.keybinds as unknown as KeybindsService,
    );
    const service = new AppService();

    service.registerShutdownCleanup();
    const event = { preventDefault: vi.fn() };
    beforeQuit?.(event);
    beforeQuit?.(event);

    await vi.waitFor(() => {
      expect(electronMocks.quit).toHaveBeenCalledTimes(1);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(service.isQuitting).toBe(true);
    expect(services.clientLog.stopWatchFile).toHaveBeenCalledTimes(1);
    expect(services.poeProcess.stop).toHaveBeenCalledTimes(1);
    expect(services.managedRecorder.stopRunRecording).toHaveBeenCalledTimes(1);
    expect(services.managedRecorder.stopBuffer).toHaveBeenCalledTimes(1);
    expect(services.updater.destroy).toHaveBeenCalledTimes(1);
    expect(services.keybinds.destroy).toHaveBeenCalledTimes(1);
    expect(services.overlayWindows.destroyAll).toHaveBeenCalledTimes(1);
    expect(shutdownEditor).toHaveBeenCalledTimes(1);
    expect(services.database.close).toHaveBeenCalledTimes(1);
  });

  it("runs shutdown cleanup without recorder stops or quit resume when no event can be prevented", async () => {
    const services = {
      clientLog: { stopWatchFile: vi.fn() },
      database: { close: vi.fn() },
      managedRecorder: {
        getStatus: vi.fn(() => ({
          bufferActive: false,
          runRecordingActive: false,
        })),
        stopBuffer: vi.fn().mockResolvedValue({}),
        stopRunRecording: vi.fn().mockResolvedValue({}),
      },
      keybinds: { destroy: vi.fn() },
      overlayWindows: { destroyAll: vi.fn() },
      poeProcess: { stop: vi.fn() },
      updater: { destroy: vi.fn() },
    };
    vi.spyOn(ClientLogService, "getInstance").mockReturnValue(
      services.clientLog as unknown as ClientLogService,
    );
    vi.spyOn(DatabaseService, "getInstance").mockReturnValue(
      services.database as unknown as DatabaseService,
    );
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue(
      services.managedRecorder as unknown as ManagedRecorderService,
    );
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue(
      services.overlayWindows as unknown as OverlayWindowsService,
    );
    vi.spyOn(PoeProcessService, "getInstance").mockReturnValue(
      services.poeProcess as unknown as PoeProcessService,
    );
    vi.spyOn(UpdaterService, "getInstance").mockReturnValue(
      services.updater as unknown as UpdaterService,
    );
    vi.spyOn(KeybindsService, "getInstance").mockReturnValue(
      services.keybinds as unknown as KeybindsService,
    );
    const service = new AppService();
    const internals = service as unknown as {
      handleBeforeQuit(event?: { preventDefault?(): void }): Promise<void>;
    };

    await internals.handleBeforeQuit(undefined);

    expect(services.poeProcess.stop).toHaveBeenCalledTimes(1);
    expect(services.managedRecorder.stopRunRecording).not.toHaveBeenCalled();
    expect(services.managedRecorder.stopBuffer).not.toHaveBeenCalled();
    expect(services.keybinds.destroy).toHaveBeenCalledTimes(1);
    expect(electronMocks.quit).not.toHaveBeenCalled();
  });

  it("registers shutdown cleanup only once", () => {
    const service = new AppService();

    service.registerShutdownCleanup();
    service.registerShutdownCleanup();

    expect(electronMocks.on).toHaveBeenCalledTimes(1);
  });

  it("registers system power cleanup once, suspends overlays, and restores requested overlays", async () => {
    const powerListeners = new Map<string, () => void>();
    const overlayWindows = {
      restoreRequestedOverlays: vi.fn().mockResolvedValue(undefined),
      suspendForSystem: vi.fn(),
    };
    const clientLog = {
      reconcilePoeFocusStateFromRecentLog: vi.fn(),
    };
    electronMocks.powerMonitorOn.mockImplementation((event, listener) => {
      powerListeners.set(event, listener);
    });
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue(
      overlayWindows as unknown as OverlayWindowsService,
    );
    vi.spyOn(ClientLogService, "getInstance").mockReturnValue(
      clientLog as unknown as ClientLogService,
    );
    const service = new AppService();

    service.registerSystemPowerCleanup();
    service.registerSystemPowerCleanup();
    powerListeners.get("suspend")?.();
    powerListeners.get("resume")?.();
    powerListeners.get("unlock-screen")?.();
    powerListeners.get("resume")?.();

    expect(electronMocks.powerMonitorOn).toHaveBeenCalledTimes(3);
    expect(electronMocks.powerMonitorOn).toHaveBeenCalledWith(
      "suspend",
      expect.any(Function),
    );
    expect(electronMocks.powerMonitorOn).toHaveBeenCalledWith(
      "resume",
      expect.any(Function),
    );
    expect(electronMocks.powerMonitorOn).toHaveBeenCalledWith(
      "unlock-screen",
      expect.any(Function),
    );
    expect(overlayWindows.suspendForSystem).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(overlayWindows.restoreRequestedOverlays).toHaveBeenCalledTimes(3);
    });
    expect(clientLog.reconcilePoeFocusStateFromRecentLog).toHaveBeenCalledTimes(
      3,
    );
  });

  it("logs system suspend overlay cleanup failures", () => {
    let suspendListener: (() => void) | undefined;
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    electronMocks.powerMonitorOn.mockImplementation((event, listener) => {
      if (event === "suspend") {
        suspendListener = listener;
      }
    });
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      suspendForSystem: () => {
        throw new Error("cannot close C:\\Users\\seb\\overlay");
      },
    } as unknown as OverlayWindowsService);
    const service = new AppService();

    service.registerSystemPowerCleanup();
    suspendListener?.();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        "ERROR [app] System suspend overlay cleanup failed",
      ),
      { error: "cannot close [path]" },
    );
  });

  it("logs system overlay restore failures", async () => {
    let resumeListener: (() => void) | undefined;
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    electronMocks.powerMonitorOn.mockImplementation((event, listener) => {
      if (event === "resume") {
        resumeListener = listener;
      }
    });
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      restoreRequestedOverlays: () => {
        throw new Error("cannot restore C:\\Users\\seb\\overlay");
      },
    } as unknown as OverlayWindowsService);
    vi.spyOn(ClientLogService, "getInstance").mockReturnValue({
      reconcilePoeFocusStateFromRecentLog: vi.fn(),
    } as unknown as ClientLogService);
    const service = new AppService();

    service.registerSystemPowerCleanup();
    resumeListener?.();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(
          "ERROR [app] System resumed overlay restore failed",
        ),
        { error: "cannot restore [path]" },
      );
    });
  });

  it("logs focus reconciliation failures and still restores overlays", async () => {
    let resumeListener: (() => void) | undefined;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const overlayWindows = {
      restoreRequestedOverlays: vi.fn().mockResolvedValue(undefined),
    };
    electronMocks.powerMonitorOn.mockImplementation((event, listener) => {
      if (event === "resume") {
        resumeListener = listener;
      }
    });
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue(
      overlayWindows as unknown as OverlayWindowsService,
    );
    vi.spyOn(ClientLogService, "getInstance").mockReturnValue({
      reconcilePoeFocusStateFromRecentLog: vi.fn(() => {
        throw new Error("cannot inspect C:\\Users\\seb\\focus");
      }),
    } as unknown as ClientLogService);
    const service = new AppService();

    service.registerSystemPowerCleanup();
    resumeListener?.();

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "WARN [app] System resumed focus reconciliation failed",
        ),
        { error: "cannot inspect [path]" },
      );
    });
    expect(overlayWindows.restoreRequestedOverlays).toHaveBeenCalledTimes(1);
  });

  it("logs shutdown cleanup failures and marks cleanup complete", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const service = new AppService();
    const internals = service as unknown as {
      handleBeforeQuit(event?: { preventDefault?(): void }): Promise<void>;
      runShutdownCleanup(): Promise<void>;
    };
    vi.spyOn(internals, "runShutdownCleanup").mockRejectedValue(
      new Error("cannot close C:\\Users\\seb\\Videos\\hinekora.sqlite"),
    );
    const event = { preventDefault: vi.fn() };

    await internals.handleBeforeQuit(event);
    await internals.handleBeforeQuit(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("ERROR [app] Shutdown cleanup failed"),
      { error: "cannot close [path]" },
    );
    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
  });

  it("continues shutdown cleanup when an individual step fails", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const service = new AppService();
    const internals = service as unknown as {
      runShutdownStep(
        message: string,
        work: () => Promise<unknown> | unknown,
      ): Promise<void>;
    };

    await expect(
      internals.runShutdownStep("Closing database", () => {
        throw new Error("close failed");
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("ERROR [app] Closing database failed"),
      { error: "close failed" },
    );
  });
});
