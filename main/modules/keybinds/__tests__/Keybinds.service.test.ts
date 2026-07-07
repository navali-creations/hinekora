import { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { type AppSettings, createDefaultSettings } from "~/types";
import { KeybindsChannel } from "../Keybinds.channels";
import { KeybindsService } from "../Keybinds.service";

const electronMocks = vi.hoisted(() => {
  const registeredCallbacks = new Map<string, () => void>();

  return {
    getAllWindows: vi.fn<() => unknown[]>(() => []),
    globalShortcutRegister: vi.fn(
      (accelerator: string, callback: () => void) => {
        registeredCallbacks.set(accelerator, callback);
        return true;
      },
    ),
    globalShortcutUnregister: vi.fn((accelerator: string) => {
      registeredCallbacks.delete(accelerator);
    }),
    registeredCallbacks,
  };
});

const settingsStoreMocks = vi.hoisted(() => ({
  get: vi.fn(),
  onDidChange: vi.fn(),
}));

const managedRecorderMocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  status: {
    bufferActive: false as boolean,
    runRecordingActive: false as boolean,
  },
}));

const bookmarksMocks = vi.hoisted(() => ({
  createManualBookmark: vi.fn(),
}));

const replayClipsMocks = vi.hoisted(() => ({
  saveManualReplay: vi.fn(),
}));

const appLogMocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
  globalShortcut: {
    register: electronMocks.globalShortcutRegister,
    unregister: electronMocks.globalShortcutUnregister,
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: () => ({
      get: settingsStoreMocks.get,
      onDidChange: settingsStoreMocks.onDidChange,
    }),
  },
}));

vi.mock("~/main/modules/managed-recorder", () => ({
  ManagedRecorderService: {
    getInstance: () => ({
      getStatus: managedRecorderMocks.getStatus,
    }),
  },
}));

vi.mock("~/main/modules/bookmarks", () => ({
  BookmarksService: {
    getInstance: () => ({
      createManualBookmark: bookmarksMocks.createManualBookmark,
    }),
  },
}));

vi.mock("~/main/modules/replay-clips", () => ({
  ReplayClipsService: {
    getInstance: () => ({
      saveManualReplay: replayClipsMocks.saveManualReplay,
    }),
  },
}));

vi.mock("~/main/utils/app-log", () => ({
  logInfo: appLogMocks.logInfo,
  logWarn: appLogMocks.logWarn,
}));

describe("KeybindsService", () => {
  beforeEach(() => {
    settingsStoreMocks.get.mockReturnValue(createDefaultSettings());
    settingsStoreMocks.onDidChange.mockReturnValue(vi.fn());
    managedRecorderMocks.getStatus.mockImplementation(
      () => managedRecorderMocks.status,
    );
    bookmarksMocks.createManualBookmark.mockReturnValue({
      bookmark: { id: "bookmark-1" },
      error: null,
      ok: true,
    });
    replayClipsMocks.saveManualReplay.mockResolvedValue({ id: "clip-1" });
  });

  afterEach(() => {
    clearIpcWindowRolesForTests();
    electronMocks.getAllWindows.mockReset();
    electronMocks.getAllWindows.mockReturnValue([]);
    electronMocks.globalShortcutRegister.mockClear();
    electronMocks.globalShortcutRegister.mockImplementation(
      (accelerator: string, callback: () => void) => {
        electronMocks.registeredCallbacks.set(accelerator, callback);
        return true;
      },
    );
    electronMocks.globalShortcutUnregister.mockClear();
    electronMocks.registeredCallbacks.clear();
    settingsStoreMocks.get.mockReset();
    settingsStoreMocks.onDidChange.mockReset();
    managedRecorderMocks.getStatus.mockReset();
    managedRecorderMocks.status = {
      bufferActive: false,
      runRecordingActive: false,
    };
    bookmarksMocks.createManualBookmark.mockReset();
    replayClipsMocks.saveManualReplay.mockReset();
    appLogMocks.logInfo.mockReset();
    appLogMocks.logWarn.mockReset();
    KeybindsService.resetForTests();
  });

  it("reuses a singleton service instance", () => {
    const service = KeybindsService.getInstance();

    expect(service).toBe(KeybindsService.getInstance());
  });

  it("registers default global shortcuts and re-registers when settings change", () => {
    const service = new KeybindsService();

    service.initialize();

    expect(electronMocks.globalShortcutRegister).toHaveBeenCalledWith(
      "Alt+B",
      expect.any(Function),
    );
    expect(electronMocks.globalShortcutRegister).toHaveBeenCalledWith(
      "Alt+C",
      expect.any(Function),
    );
    expect(service.getStatus().manualBookmark).toMatchObject({
      accelerator: "Alt+B",
      displayLabel: "ALT + B",
      registered: true,
    });

    const changeListener = settingsStoreMocks.onDidChange.mock.calls[0]?.[0] as
      | ((settings: AppSettings) => void)
      | undefined;
    expect(changeListener).toBeDefined();
    changeListener?.({
      ...createDefaultSettings(),
      keybindManualBookmark: "Ctrl+B",
      keybindManualReplay: null,
    });

    expect(electronMocks.globalShortcutUnregister).toHaveBeenCalledWith(
      "Alt+B",
    );
    expect(electronMocks.globalShortcutUnregister).toHaveBeenCalledWith(
      "Alt+C",
    );
    expect(electronMocks.globalShortcutRegister).toHaveBeenCalledWith(
      "Ctrl+B",
      expect.any(Function),
    );
    expect(service.getStatus().manualReplay).toMatchObject({
      accelerator: null,
      error: "No keybind set",
      registered: false,
    });
  });

  it("does not re-register global shortcuts for unrelated settings changes", () => {
    const service = new KeybindsService();

    service.initialize();
    electronMocks.globalShortcutRegister.mockClear();
    electronMocks.globalShortcutUnregister.mockClear();

    const changeListener = settingsStoreMocks.onDidChange.mock.calls[0]?.[0] as
      | ((settings: AppSettings) => void)
      | undefined;
    expect(changeListener).toBeDefined();
    changeListener?.({
      ...createDefaultSettings(),
      recordingFps: 60,
    });

    expect(electronMocks.globalShortcutUnregister).not.toHaveBeenCalled();
    expect(electronMocks.globalShortcutRegister).not.toHaveBeenCalled();
  });

  it("dispatches keybind actions only while the matching recorder mode is active", async () => {
    const service = new KeybindsService();
    service.initialize();

    electronMocks.registeredCallbacks.get("Alt+B")?.();
    electronMocks.registeredCallbacks.get("Alt+C")?.();

    expect(bookmarksMocks.createManualBookmark).not.toHaveBeenCalled();
    expect(replayClipsMocks.saveManualReplay).not.toHaveBeenCalled();

    managedRecorderMocks.status = {
      bufferActive: false,
      runRecordingActive: true,
    };
    electronMocks.registeredCallbacks.get("Alt+B")?.();
    expect(bookmarksMocks.createManualBookmark).toHaveBeenCalledTimes(1);

    managedRecorderMocks.status = {
      bufferActive: true,
      runRecordingActive: false,
    };
    electronMocks.registeredCallbacks.get("Alt+C")?.();

    await vi.waitFor(() => {
      expect(replayClipsMocks.saveManualReplay).toHaveBeenCalledTimes(1);
    });
  });

  it("reports unavailable and duplicate keybind registrations", () => {
    electronMocks.globalShortcutRegister.mockImplementation(
      (accelerator: string, callback: () => void) => {
        electronMocks.registeredCallbacks.set(accelerator, callback);
        return accelerator !== "Alt+C";
      },
    );
    const service = new KeybindsService();

    service.initialize();

    expect(service.getStatus().manualReplay).toMatchObject({
      accelerator: "Alt+C",
      error: "Shortcut is unavailable",
      registered: false,
    });

    service.destroy();
    settingsStoreMocks.get.mockReturnValue({
      ...createDefaultSettings(),
      keybindManualReplay: "Alt+B",
    });
    electronMocks.globalShortcutRegister.mockReturnValue(true);
    service.initialize();

    expect(service.getStatus().manualReplay).toMatchObject({
      accelerator: "Alt+B",
      error: "Already used by Manual bookmark",
      registered: false,
    });
  });

  it("reports invalid persisted keybinds without registering them", () => {
    settingsStoreMocks.get.mockReturnValue({
      ...createDefaultSettings(),
      keybindManualBookmark: "Mouse4",
    });
    const service = new KeybindsService();

    service.initialize();

    expect(service.getStatus().manualBookmark).toMatchObject({
      accelerator: "Mouse4",
      displayLabel: "Mouse4",
      error: "Invalid keybind",
      registered: false,
    });
    expect(electronMocks.globalShortcutRegister).toHaveBeenCalledTimes(1);
    expect(electronMocks.globalShortcutRegister).toHaveBeenCalledWith(
      "Alt+C",
      expect.any(Function),
    );
  });

  it("logs failures from active manual bookmark and replay actions", async () => {
    const service = new KeybindsService();
    service.initialize();

    managedRecorderMocks.status = {
      bufferActive: false,
      runRecordingActive: true,
    };
    bookmarksMocks.createManualBookmark.mockReturnValue({
      bookmark: null,
      error: "No active recording",
      ok: false,
    });

    electronMocks.registeredCallbacks.get("Alt+B")?.();

    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "keybinds",
      "Manual bookmark keybind failed",
      { error: "No active recording" },
    );

    managedRecorderMocks.status = {
      bufferActive: true,
      runRecordingActive: false,
    };
    replayClipsMocks.saveManualReplay.mockRejectedValue(new Error("Disk full"));

    electronMocks.registeredCallbacks.get("Alt+C")?.();

    await vi.waitFor(() => {
      expect(appLogMocks.logWarn).toHaveBeenCalledWith(
        "keybinds",
        "Manual replay keybind failed",
        { error: "Disk full" },
      );
    });
  });

  it("publishes status changes only to live main windows", () => {
    const mainWindow = createTestWindow(10, WindowName.Main);
    const overlayWindow = createTestWindow(11, WindowName.RecorderOverlay);
    const destroyedMainWindow = createTestWindow(12, WindowName.Main, true);
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow,
      overlayWindow,
      destroyedMainWindow,
    ]);
    const service = new KeybindsService();

    service.initialize();

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      KeybindsChannel.StatusChanged,
      expect.objectContaining({
        manualBookmark: expect.objectContaining({
          accelerator: "Alt+B",
        }),
      }),
    );
    expect(overlayWindow.webContents.send).not.toHaveBeenCalled();
    expect(destroyedMainWindow.webContents.send).not.toHaveBeenCalled();

    mainWindow.webContents.send.mockClear();
    const changeListener = settingsStoreMocks.onDidChange.mock.calls[0]?.[0] as
      | ((settings: AppSettings) => void)
      | undefined;
    changeListener?.({
      ...createDefaultSettings(),
      keybindManualBookmark: "Ctrl+B",
    });

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      KeybindsChannel.StatusChanged,
      expect.objectContaining({
        manualBookmark: expect.objectContaining({
          accelerator: "Ctrl+B",
        }),
      }),
    );
    expect(overlayWindow.webContents.send).not.toHaveBeenCalled();
    expect(destroyedMainWindow.webContents.send).not.toHaveBeenCalled();
  });

  it("skips status publishing when the window list is unavailable", () => {
    const browserWindow = BrowserWindow as unknown as {
      getAllWindows: (() => unknown[]) | undefined;
    };
    const originalGetAllWindows = browserWindow.getAllWindows;
    browserWindow.getAllWindows = undefined;
    const service = new KeybindsService();

    try {
      expect(() => service.initialize()).not.toThrow();
    } finally {
      browserWindow.getAllWindows = originalGetAllWindows;
    }
  });

  it("exposes registration status through guarded IPC", async () => {
    const { handlers } = mockIpcMainHandlers();
    const service = new KeybindsService();
    service.initialize();
    const mainEvent = createIpcEvent(1, WindowName.Main);
    const overlayEvent = createIpcEvent(2, WindowName.RecorderOverlay);

    expect(
      await handlers.get(KeybindsChannel.GetStatus)?.(mainEvent),
    ).toMatchObject({
      manualBookmark: {
        accelerator: "Alt+B",
        registered: true,
      },
    });
    expect(() =>
      handlers.get(KeybindsChannel.GetStatus)?.(overlayEvent),
    ).toThrow("keybinds:get-status is not available from this window");
  });
});

function createIpcEvent(
  id: number,
  role: WindowName,
): Electron.IpcMainInvokeEvent {
  const webContents = { id };
  registerIpcWindowRole(webContents, role);

  return { sender: webContents } as Electron.IpcMainInvokeEvent;
}

function createTestWindow(
  id: number,
  role: WindowName,
  destroyed = false,
): {
  isDestroyed: () => boolean;
  webContents: { id: number; send: ReturnType<typeof vi.fn> };
} {
  const webContents = { id, send: vi.fn() };
  registerIpcWindowRole(webContents, role);

  return {
    isDestroyed: () => destroyed,
    webContents,
  };
}
