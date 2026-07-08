import { afterEach, describe, expect, it, vi } from "vitest";

import { mockIpcMainHandlers } from "~/main/test/ipc";
import { ATTRIBUTIONS } from "~/types/attributions";

import { MainWindowChannel } from "../MainWindow.channels";
import { MainWindowService } from "../MainWindow.service";

const electronMocks = vi.hoisted(() => ({
  appOn: vi.fn(),
  browserWindowFactory: vi.fn(),
  BrowserWindow: vi.fn(function BrowserWindow(
    options: Electron.BrowserWindowConstructorOptions,
  ) {
    return electronMocks.browserWindowFactory(options);
  }),
  openExternal: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn(),
  setApplicationMenu: vi.fn(),
  getAllDisplays: vi.fn(() => [
    {
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    },
  ]),
  isPackaged: true,
}));

const updaterMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
}));
const settingsStoreMocks = vi.hoisted(() => ({
  get: vi.fn(() => ({
    appCloseBehavior: "exit",
    appStartMinimized: false,
    mainWindowBounds: null as Electron.Rectangle | null,
  })),
  update: vi.fn(),
}));
const trayMocks = vi.hoisted(() => ({
  createTray: vi.fn(),
  destroyTray: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return electronMocks.isPackaged;
    },
    on: electronMocks.appOn,
    quit: electronMocks.quit,
  },
  BrowserWindow: electronMocks.BrowserWindow,
  Menu: {
    setApplicationMenu: electronMocks.setApplicationMenu,
  },
  screen: {
    getAllDisplays: electronMocks.getAllDisplays,
  },
  shell: {
    openExternal: electronMocks.openExternal,
  },
}));

vi.mock("~/main/modules/updater", () => ({
  UpdaterService: {
    getInstance: () => ({
      initialize: updaterMocks.initialize,
    }),
  },
}));
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: () => ({
      get: settingsStoreMocks.get,
      update: settingsStoreMocks.update,
    }),
  },
}));
vi.mock("~/main/modules/tray", () => ({
  TrayService: {
    getInstance: () => trayMocks,
  },
}));

class FakeWindow {
  destroyed = false;
  focused = false;
  hidden = false;
  maximized = false;
  minimized = false;
  shown = false;
  closeListener: ((event: { preventDefault(): void }) => void) | null = null;
  closedListener: (() => void) | null = null;
  blurListener: (() => void) | null = null;
  focusListener: (() => void) | null = null;
  readyListener: (() => void) | null = null;
  movedListener: (() => void) | null = null;
  resizedListener: (() => void) | null = null;
  windowOpenHandler: ((details: { url: string }) => { action: "deny" }) | null =
    null;
  beforeInputListener:
    | ((event: { preventDefault(): void }, input: Electron.Input) => void)
    | null = null;

  webContents = {
    closeDevTools: vi.fn(),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    isDevToolsOpened: vi.fn(() => false),
    on: vi.fn(
      (
        event: string,
        listener: (
          event: { preventDefault(): void },
          input: Electron.Input,
        ) => void,
      ) => {
        if (event === "before-input-event") {
          this.beforeInputListener = listener;
        }
      },
    ),
    openDevTools: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    setWindowOpenHandler: vi.fn(
      (handler: (details: { url: string }) => { action: "deny" }) => {
        this.windowOpenHandler = handler;
      },
    ),
  };

  bounds: Electron.Rectangle = { x: 100, y: 100, width: 1200, height: 800 };
  close = vi.fn(() => {
    let prevented = false;
    this.closeListener?.({
      preventDefault: () => {
        prevented = true;
      },
    });
    if (!prevented) {
      this.closedListener?.();
    }
  });
  focus = vi.fn(() => {
    this.focused = true;
  });
  hide = vi.fn(() => {
    this.hidden = true;
  });
  getBounds = vi.fn(() => this.bounds);
  isDestroyed = vi.fn(() => this.destroyed);
  isMaximized = vi.fn(() => this.maximized);
  isMinimized = vi.fn(() => this.minimized);
  loadFile = vi.fn().mockResolvedValue(undefined);
  loadURL = vi.fn().mockResolvedValue(undefined);
  maximize = vi.fn(() => {
    this.maximized = true;
  });
  minimize = vi.fn();
  once = vi.fn((event: string, listener: () => void) => {
    if (event === "ready-to-show") {
      this.readyListener = listener;
    }
  });
  restore = vi.fn(() => {
    this.minimized = false;
  });
  removeListener = vi.fn((event: string, listener: () => void) => {
    if (event === "moved" && this.movedListener === listener) {
      this.movedListener = null;
    }
    if (event === "resized" && this.resizedListener === listener) {
      this.resizedListener = null;
    }
  });
  on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
    if (event === "close") {
      this.closeListener = listener as (event: {
        preventDefault(): void;
      }) => void;
    }
    if (event === "closed") {
      this.closedListener = listener as () => void;
    }
    if (event === "focus") {
      this.focusListener = listener as () => void;
    }
    if (event === "blur") {
      this.blurListener = listener as () => void;
    }
    if (event === "moved") {
      this.movedListener = listener as () => void;
    }
    if (event === "resized") {
      this.resizedListener = listener as () => void;
    }
  });
  show = vi.fn(() => {
    this.shown = true;
  });
  unmaximize = vi.fn(() => {
    this.maximized = false;
  });
}

afterEach(() => {
  electronMocks.appOn.mockReset();
  electronMocks.BrowserWindow.mockClear();
  electronMocks.browserWindowFactory.mockReset();
  electronMocks.openExternal.mockClear();
  electronMocks.quit.mockClear();
  electronMocks.setApplicationMenu.mockClear();
  electronMocks.getAllDisplays.mockReset();
  electronMocks.getAllDisplays.mockReturnValue([
    {
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    },
  ]);
  electronMocks.isPackaged = true;
  settingsStoreMocks.get.mockReset();
  settingsStoreMocks.get.mockReturnValue({
    appCloseBehavior: "exit",
    appStartMinimized: false,
    mainWindowBounds: null,
  });
  settingsStoreMocks.update.mockReset();
  trayMocks.createTray.mockClear();
  trayMocks.destroyTray.mockClear();
  updaterMocks.initialize.mockClear();
  vi.unstubAllGlobals();
});

describe("MainWindowService", () => {
  it("creates and reuses the singleton instance", () => {
    const singletonAccess = MainWindowService as unknown as {
      instance: MainWindowService | null;
    };
    singletonAccess.instance = null;

    const first = MainWindowService.getInstance();
    const second = MainWindowService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("creates a sandboxed main window and wires lifecycle handlers", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    expect(service.getMainWindow()).toBeNull();
    await expect(service.createMainWindow()).resolves.toBe(fakeWindow);
    expect(service.getMainWindow()).toBe(fakeWindow);

    expect(electronMocks.setApplicationMenu).toHaveBeenCalledWith(null);
    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: false,
        title: "Hinekora",
        webPreferences: expect.objectContaining({
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        }),
      }),
    );
    expect(updaterMocks.initialize).toHaveBeenCalledWith(fakeWindow);
    expect(fakeWindow.loadFile).toHaveBeenCalledWith(
      expect.stringContaining("main_window"),
    );

    fakeWindow.readyListener?.();
    expect(fakeWindow.show).toHaveBeenCalled();

    expect(
      fakeWindow.windowOpenHandler?.({
        url: "https://github.com/navali-creations/hinekora",
      }),
    ).toEqual({ action: "deny" });
    expect(electronMocks.openExternal).toHaveBeenCalledWith(
      "https://github.com/navali-creations/hinekora",
    );
    const warcraftRecorderAttribution = ATTRIBUTIONS.find(
      (attribution) => attribution.name === "Warcraft Recorder",
    );
    expect(warcraftRecorderAttribution).toBeDefined();
    const warcraftRecorderUrl = warcraftRecorderAttribution?.url ?? "";

    expect(
      fakeWindow.windowOpenHandler?.({
        url: warcraftRecorderUrl,
      }),
    ).toEqual({ action: "deny" });
    expect(electronMocks.openExternal).toHaveBeenCalledWith(
      warcraftRecorderUrl,
    );
    expect(
      fakeWindow.windowOpenHandler?.({ url: "file:///C:/Users/seb/a.html" }),
    ).toEqual({ action: "deny" });
    expect(electronMocks.openExternal).toHaveBeenCalledTimes(2);

    fakeWindow.close();
    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
    expect(service.getMainWindow()).toBe(fakeWindow);

    fakeWindow.closedListener?.();
    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
  });

  it("restores saved main window bounds when they overlap a current display", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    settingsStoreMocks.get.mockReturnValue({
      appCloseBehavior: "exit",
      appStartMinimized: false,
      mainWindowBounds: { x: 240, y: 120, width: 1400, height: 900 },
    });
    const service = new MainWindowService();

    await service.createMainWindow();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 240,
        y: 120,
        width: 1400,
        height: 900,
      }),
    );
  });

  it("falls back to default bounds when saved bounds are off-screen", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    settingsStoreMocks.get.mockReturnValue({
      appCloseBehavior: "exit",
      appStartMinimized: false,
      mainWindowBounds: { x: 5000, y: 5000, width: 1400, height: 900 },
    });
    const service = new MainWindowService();

    await service.createMainWindow();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 1200,
        height: 800,
      }),
    );
    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.not.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    );
  });

  it("saves main window bounds on debounced move and resize events", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.bounds = { x: 32, y: 48, width: 1280, height: 840 };

    vi.useFakeTimers();
    try {
      fakeWindow.movedListener?.();
      fakeWindow.bounds = { x: 48, y: 64, width: 1290, height: 850 };
      fakeWindow.resizedListener?.();
      vi.advanceTimersByTime(499);
      expect(settingsStoreMocks.update).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(settingsStoreMocks.update).toHaveBeenLastCalledWith({
        mainWindowBounds: { x: 48, y: 64, width: 1290, height: 850 },
      });

      settingsStoreMocks.update.mockClear();
      fakeWindow.bounds = { x: 64, y: 96, width: 1300, height: 860 };
      fakeWindow.resizedListener?.();
      vi.advanceTimersByTime(500);

      expect(settingsStoreMocks.update).toHaveBeenLastCalledWith({
        mainWindowBounds: { x: 64, y: 96, width: 1300, height: 860 },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears pending bounds saves when the main window is closed", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await service.createMainWindow();

    vi.useFakeTimers();
    try {
      fakeWindow.movedListener?.();
      fakeWindow.closedListener?.();
      vi.advanceTimersByTime(500);

      expect(settingsStoreMocks.update).not.toHaveBeenCalled();
      expect(fakeWindow.removeListener).toHaveBeenCalledWith(
        "moved",
        expect.any(Function),
      );
      expect(fakeWindow.removeListener).toHaveBeenCalledWith(
        "resized",
        expect.any(Function),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("tolerates bounds listener cleanup without a live window", () => {
    const service = new MainWindowService();
    const fakeWindow = new FakeWindow();
    const internals = service as unknown as {
      removeBoundsListeners(mainWindow: FakeWindow | null): void;
    };

    internals.removeBoundsListeners(null);

    fakeWindow.destroyed = true;
    internals.removeBoundsListeners(fakeWindow);

    expect(fakeWindow.removeListener).not.toHaveBeenCalled();
  });

  it("saves bounds immediately before hiding to tray", async () => {
    const fakeWindow = new FakeWindow();
    fakeWindow.bounds = { x: 20, y: 30, width: 1250, height: 850 };
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    settingsStoreMocks.get.mockReturnValue({
      appCloseBehavior: "minimize-to-tray",
      appStartMinimized: false,
      mainWindowBounds: null,
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.close();

    expect(settingsStoreMocks.update).toHaveBeenLastCalledWith({
      mainWindowBounds: { x: 20, y: 30, width: 1250, height: 850 },
    });
    expect(fakeWindow.hide).toHaveBeenCalled();
  });

  it("skips saving maximized main window bounds", async () => {
    const fakeWindow = new FakeWindow();
    fakeWindow.maximized = true;
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.close();

    expect(settingsStoreMocks.update).not.toHaveBeenCalled();
  });

  it("keeps closing when saving bounds fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    settingsStoreMocks.update.mockImplementation(() => {
      throw new Error("settings unavailable");
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.close();

    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("hides to tray when close behavior is minimize to tray", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    settingsStoreMocks.get.mockReturnValue({
      appCloseBehavior: "minimize-to-tray",
      appStartMinimized: false,
      mainWindowBounds: null,
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.close();

    expect(fakeWindow.hide).toHaveBeenCalled();
    expect(electronMocks.quit).not.toHaveBeenCalled();
    expect(trayMocks.createTray).toHaveBeenCalled();

    const trayActions = trayMocks.createTray.mock.calls.at(-1)?.[0];
    trayActions?.showMainWindow();
    expect(fakeWindow.show).toHaveBeenCalled();
    expect(fakeWindow.focus).toHaveBeenCalled();
  });

  it("creates the tray with main window actions", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await service.createMainWindow();
    expect(trayMocks.createTray).toHaveBeenCalledTimes(1);

    const trayActions = trayMocks.createTray.mock.calls[0]?.[0];

    fakeWindow.minimized = true;
    trayActions?.showMainWindow();
    expect(fakeWindow.restore).toHaveBeenCalled();
    expect(fakeWindow.show).toHaveBeenCalled();
    expect(fakeWindow.focus).toHaveBeenCalled();

    trayActions?.openDiscord();
    expect(electronMocks.openExternal).toHaveBeenCalledWith(
      "https://discord.gg/mrqmPYXHHT",
    );

    trayActions?.openGitHub();
    expect(electronMocks.openExternal).toHaveBeenCalledWith(
      "https://github.com/navali-creations/hinekora",
    );

    fakeWindow.webContents.executeJavaScript.mockClear();
    fakeWindow.show.mockClear();
    fakeWindow.focus.mockClear();
    await trayActions?.openHelp();
    expect(fakeWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
      'globalThis.location.hash = "#/settings?tab=help"',
    );
    expect(fakeWindow.show).toHaveBeenCalled();
    expect(fakeWindow.focus).toHaveBeenCalled();

    trayActions?.quitApplication();
    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
  });

  it("creates a new main window when the tray show action has no live window", () => {
    const service = new MainWindowService();
    const createMainWindow = vi
      .spyOn(service, "createMainWindow")
      .mockResolvedValue(new FakeWindow() as unknown as Electron.BrowserWindow);
    const internals = service as unknown as {
      mainWindow: FakeWindow | null;
      showMainWindow(): void;
    };
    internals.mainWindow = null;

    internals.showMainWindow();

    expect(createMainWindow).toHaveBeenCalled();
  });

  it("falls back to exiting when close behavior settings cannot be read", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    settingsStoreMocks.get.mockImplementation(() => {
      throw new Error("settings unavailable");
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.close();

    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
  });

  it("keeps the main window hidden on startup when start minimized is enabled", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    settingsStoreMocks.get.mockReturnValue({
      appCloseBehavior: "exit",
      appStartMinimized: true,
      mainWindowBounds: null,
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.readyListener?.();

    expect(fakeWindow.show).not.toHaveBeenCalled();
    expect(trayMocks.createTray).toHaveBeenCalled();
  });

  it("starts minimized from the hidden launch argument and tolerates settings failures", () => {
    const service = new MainWindowService();
    const internals = service as unknown as {
      shouldStartMinimized(): boolean;
    };
    const originalArgv = process.argv;
    process.argv = [...originalArgv, "--hidden"];

    try {
      expect(internals.shouldStartMinimized()).toBe(true);
    } finally {
      process.argv = originalArgv;
    }

    settingsStoreMocks.get.mockImplementation(() => {
      throw new Error("settings unavailable");
    });
    expect(internals.shouldStartMinimized()).toBe(false);
  });

  it("quits if the main window is closed outside the normal app quit flow", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.closedListener?.();

    expect(service.getMainWindow()).toBeNull();
    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing live main window", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await service.createMainWindow();
    await expect(service.createMainWindow()).resolves.toBe(fakeWindow);
    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(1);
  });

  it("does not quit from close events after app before-quit fires", async () => {
    const fakeWindow = new FakeWindow();
    let beforeQuit = () => {};
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    electronMocks.appOn.mockImplementation((_event, listener) => {
      beforeQuit = listener;
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    beforeQuit();
    fakeWindow.close();
    fakeWindow.closedListener?.();

    expect(electronMocks.quit).not.toHaveBeenCalled();
    expect(trayMocks.destroyTray).toHaveBeenCalledTimes(1);
  });

  it("saves main window bounds once across repeated app before-quit events", async () => {
    const fakeWindow = new FakeWindow();
    fakeWindow.bounds = { x: 40, y: 60, width: 1280, height: 860 };
    let beforeQuit = () => {};
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    electronMocks.appOn.mockImplementation((_event, listener) => {
      beforeQuit = listener;
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    beforeQuit();
    beforeQuit();

    expect(settingsStoreMocks.update).toHaveBeenCalledTimes(1);
    expect(settingsStoreMocks.update).toHaveBeenCalledWith({
      mainWindowBounds: { x: 40, y: 60, width: 1280, height: 860 },
    });
  });

  it("does not show a window destroyed before ready-to-show", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.destroyed = true;
    fakeWindow.readyListener?.();

    expect(fakeWindow.show).not.toHaveBeenCalled();
  });

  it("loads renderer URLs in dev and files in packaged mode", async () => {
    const fakeWindow = new FakeWindow();
    const service = new MainWindowService();
    const internals = service as unknown as {
      loadRenderer(window: FakeWindow): Promise<void>;
    };

    vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", "http://localhost:5173");
    await internals.loadRenderer(fakeWindow);
    expect(fakeWindow.loadURL).toHaveBeenCalledWith("http://localhost:5173");

    vi.unstubAllGlobals();
    vi.stubGlobal("MAIN_WINDOW_VITE_NAME", "main_window");
    await internals.loadRenderer(fakeWindow);
    expect(fakeWindow.loadFile).toHaveBeenCalledWith(
      expect.stringContaining("main_window"),
    );
  });

  it("keeps a window when renderer loading is interrupted during shutdown", async () => {
    const fakeWindow = new FakeWindow();
    fakeWindow.loadFile.mockRejectedValue(new Error("ERR_ABORTED"));
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await expect(service.createMainWindow()).resolves.toBe(fakeWindow);
  });

  it("rethrows non-interrupted renderer loading failures", async () => {
    const fakeWindow = new FakeWindow();
    fakeWindow.loadFile.mockRejectedValue(new Error("renderer missing"));
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await expect(service.createMainWindow()).rejects.toThrow(
      "renderer missing",
    );
  });

  it("classifies interrupted window load failures", () => {
    const service = new MainWindowService();
    const fakeWindow = new FakeWindow();
    const internals = service as unknown as {
      isInterruptedWindowLoadError(error: unknown, window: FakeWindow): boolean;
    };

    expect(
      internals.isInterruptedWindowLoadError("ERR_FAILED", fakeWindow),
    ).toBe(true);
    expect(
      internals.isInterruptedWindowLoadError(
        new Error("renderer missing"),
        fakeWindow,
      ),
    ).toBe(false);

    fakeWindow.destroyed = true;
    expect(
      internals.isInterruptedWindowLoadError(
        new Error("renderer missing"),
        fakeWindow,
      ),
    ).toBe(true);
  });

  it("wires development shortcuts only for dev renderer windows", () => {
    vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", "http://localhost:5173");
    const fakeWindow = new FakeWindow();
    electronMocks.isPackaged = false;
    const service = new MainWindowService();
    const internals = service as unknown as {
      setupDevelopmentShortcuts(window: FakeWindow): void;
    };
    const event = { preventDefault: vi.fn() };

    internals.setupDevelopmentShortcuts(fakeWindow);
    fakeWindow.beforeInputListener?.(event, {
      key: "F5",
      type: "keyDown",
    } as Electron.Input);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(fakeWindow.webContents.reloadIgnoringCache).toHaveBeenCalled();

    fakeWindow.beforeInputListener?.(event, {
      key: "F5",
      type: "keyUp",
    } as Electron.Input);
    expect(fakeWindow.webContents.reloadIgnoringCache).toHaveBeenCalledTimes(1);

    fakeWindow.webContents.isDevToolsOpened.mockReturnValueOnce(false);
    fakeWindow.beforeInputListener?.(event, {
      key: "F12",
      type: "keyDown",
    } as Electron.Input);
    expect(fakeWindow.webContents.openDevTools).toHaveBeenCalledWith({
      mode: "detach",
      activate: true,
    });

    fakeWindow.webContents.isDevToolsOpened.mockReturnValueOnce(true);
    fakeWindow.beforeInputListener?.(event, {
      control: true,
      key: "I",
      shift: true,
      type: "keyDown",
    } as Electron.Input);
    expect(fakeWindow.webContents.closeDevTools).toHaveBeenCalled();

    fakeWindow.beforeInputListener?.(event, {
      key: "A",
      type: "keyDown",
    } as Electron.Input);
    expect(fakeWindow.webContents.openDevTools).toHaveBeenCalledTimes(1);
    expect(fakeWindow.webContents.reloadIgnoringCache).toHaveBeenCalledTimes(1);
  });

  it("does not reopen main window devtools when they are already open", () => {
    const service = new MainWindowService();
    const fakeWindow = new FakeWindow();
    const internals = service as unknown as {
      openMainWindowDevTools(window: FakeWindow): void;
    };
    fakeWindow.webContents.isDevToolsOpened.mockReturnValue(true);

    internals.openMainWindowDevTools(fakeWindow);

    expect(fakeWindow.webContents.openDevTools).not.toHaveBeenCalled();
  });

  it("registers IPC handlers for window controls", async () => {
    const { handlers } = mockIpcMainHandlers();
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();
    await service.createMainWindow();

    handlers.get(MainWindowChannel.Minimize)?.({});
    expect(fakeWindow.minimize).toHaveBeenCalled();

    expect(await handlers.get(MainWindowChannel.Maximize)?.({})).toBe(true);
    expect(fakeWindow.maximize).toHaveBeenCalled();
    expect(await handlers.get(MainWindowChannel.IsMaximized)?.({})).toBe(true);

    expect(await handlers.get(MainWindowChannel.Unmaximize)?.({})).toBe(false);
    expect(fakeWindow.unmaximize).toHaveBeenCalled();

    handlers.get(MainWindowChannel.Close)?.({});
    expect(fakeWindow.close).toHaveBeenCalled();
    expect(electronMocks.quit).toHaveBeenCalledTimes(1);

    handlers.get(MainWindowChannel.OpenDevTools)?.({});
    expect(fakeWindow.webContents.openDevTools).toHaveBeenCalledWith({
      mode: "detach",
      activate: true,
    });

    fakeWindow.destroyed = true;
    await service.createMainWindow();
    fakeWindow.destroyed = true;
    handlers.get(MainWindowChannel.Close)?.({});
    expect(electronMocks.quit).toHaveBeenCalledTimes(2);
  });

  it("keeps IPC window controls safe when no main window exists", async () => {
    const { handlers } = mockIpcMainHandlers();
    electronMocks.browserWindowFactory.mockReturnValue(new FakeWindow());
    new MainWindowService();

    handlers.get(MainWindowChannel.Minimize)?.({});
    expect(await handlers.get(MainWindowChannel.Maximize)?.({})).toBe(false);
    expect(await handlers.get(MainWindowChannel.Unmaximize)?.({})).toBe(false);
    expect(await handlers.get(MainWindowChannel.IsMaximized)?.({})).toBe(false);

    handlers.get(MainWindowChannel.Close)?.({});
    expect(electronMocks.quit).toHaveBeenCalled();

    handlers.get(MainWindowChannel.OpenDevTools)?.({});
  });

  it("opens the editor for a replay clip from the clip preview overlay", async () => {
    const { handlers } = mockIpcMainHandlers();
    const fakeWindow = new FakeWindow();
    fakeWindow.minimized = true;
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    new MainWindowService();

    await expect(
      handlers.get(MainWindowChannel.OpenEditorClip)?.({}, "clip 1"),
    ).resolves.toBeUndefined();

    expect(fakeWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
      'globalThis.location.hash = "#/editor?kind=clip&id=clip%201"',
    );
    expect(fakeWindow.restore).toHaveBeenCalled();
    expect(fakeWindow.show).toHaveBeenCalled();
    expect(fakeWindow.focus).toHaveBeenCalled();
  });

  it("opens the editor with clip preview trim options", async () => {
    const { handlers } = mockIpcMainHandlers();
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    new MainWindowService();

    await expect(
      handlers.get(MainWindowChannel.OpenEditorClip)?.({}, "clip 1", {
        title: "Renamed clip",
        trim: { inSeconds: 1.25, outSeconds: 4.5 },
      }),
    ).resolves.toBeUndefined();

    expect(fakeWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
      'globalThis.location.hash = "#/editor?kind=clip&id=clip%201&trimIn=1.25&trimOut=4.5&title=Renamed%20clip"',
    );
  });

  it("rejects invalid editor clip IPC input", async () => {
    const { handlers } = mockIpcMainHandlers();
    electronMocks.browserWindowFactory.mockReturnValue(new FakeWindow());
    new MainWindowService();

    expect(handlers.get(MainWindowChannel.OpenEditorClip)?.({}, "")).toEqual({
      ok: false,
      error: "clip id is too short",
    });
    expect(
      handlers.get(MainWindowChannel.OpenEditorClip)?.({}, "clip-1", {
        trim: { inSeconds: 2, outSeconds: 2.05 },
      }),
    ).toEqual({
      ok: false,
      error: "trim range is too short",
    });
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
  });

  it("skips editor navigation when the main window is destroyed", async () => {
    const service = new MainWindowService();
    const fakeWindow = new FakeWindow();
    const internals = service as unknown as {
      navigateMainWindowToEditorClip(
        mainWindow: FakeWindow,
        clipId: string,
      ): Promise<void>;
    };
    fakeWindow.destroyed = true;

    await internals.navigateMainWindowToEditorClip(fakeWindow, "clip-1");

    expect(fakeWindow.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it("skips settings help navigation when the main window is destroyed", async () => {
    const service = new MainWindowService();
    const fakeWindow = new FakeWindow();
    const internals = service as unknown as {
      navigateMainWindowToSettingsHelp(mainWindow: FakeWindow): Promise<void>;
    };
    fakeWindow.destroyed = true;

    await internals.navigateMainWindowToSettingsHelp(fakeWindow);

    expect(fakeWindow.webContents.executeJavaScript).not.toHaveBeenCalled();
  });
});
