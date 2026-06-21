import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { mockIpcMainHandlers } from "~/main/test/ipc";

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
  buildFromTemplate: vi.fn(
    (template: Electron.MenuItemConstructorOptions[]) => template,
  ),
  getAppPath: vi.fn(() => "C:\\repo\\Hinekora"),
  isPackaged: true,
  openExternal: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn(),
  setApplicationMenu: vi.fn(),
  trayFactory: vi.fn(),
  Tray: vi.fn(function Tray(iconPath: string) {
    return electronMocks.trayFactory(iconPath);
  }),
}));

const updaterMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
}));
const overlayMocks = vi.hoisted(() => ({
  setPoeFocusActive: vi.fn(),
}));
const settingsStoreMocks = vi.hoisted(() => ({
  get: vi.fn(() => ({
    appCloseBehavior: "exit",
    appStartMinimized: false,
  })),
}));

vi.mock("electron", () => ({
  app: {
    getAppPath: electronMocks.getAppPath,
    get isPackaged() {
      return electronMocks.isPackaged;
    },
    on: electronMocks.appOn,
    quit: electronMocks.quit,
  },
  BrowserWindow: electronMocks.BrowserWindow,
  Menu: {
    buildFromTemplate: electronMocks.buildFromTemplate,
    setApplicationMenu: electronMocks.setApplicationMenu,
  },
  shell: {
    openExternal: electronMocks.openExternal,
  },
  Tray: electronMocks.Tray,
}));

vi.mock("~/main/modules/updater", () => ({
  UpdaterService: {
    getInstance: () => ({
      initialize: updaterMocks.initialize,
    }),
  },
}));
vi.mock("~/main/modules/overlay-windows", () => ({
  OverlayWindowsService: {
    getInstance: () => ({
      setPoeFocusActive: overlayMocks.setPoeFocusActive,
    }),
  },
}));
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: () => ({
      get: settingsStoreMocks.get,
    }),
  },
}));

class FakeTray {
  contextMenu: Electron.MenuItemConstructorOptions[] | null = null;
  clickListener: (() => void) | null = null;

  on = vi.fn((event: string, listener: () => void) => {
    if (event === "click") {
      this.clickListener = listener;
    }
  });
  setContextMenu = vi.fn((menu: Electron.MenuItemConstructorOptions[]) => {
    this.contextMenu = menu;
  });
  setToolTip = vi.fn();
}

class FakeWindow {
  destroyed = false;
  focused = false;
  hidden = false;
  maximized = false;
  minimized = false;
  shown = false;
  closeListener: ((event: { preventDefault(): void }) => void) | null = null;
  closedListener: (() => void) | null = null;
  focusListener: (() => void) | null = null;
  readyListener: (() => void) | null = null;
  windowOpenHandler: ((details: { url: string }) => { action: "deny" }) | null =
    null;
  beforeInputListener:
    | ((event: { preventDefault(): void }, input: Electron.Input) => void)
    | null = null;

  webContents = {
    closeDevTools: vi.fn(),
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
  electronMocks.buildFromTemplate.mockClear();
  electronMocks.browserWindowFactory.mockReset();
  electronMocks.getAppPath.mockReset();
  electronMocks.getAppPath.mockReturnValue("C:\\repo\\Hinekora");
  electronMocks.isPackaged = true;
  electronMocks.openExternal.mockClear();
  electronMocks.quit.mockClear();
  electronMocks.setApplicationMenu.mockClear();
  electronMocks.Tray.mockClear();
  electronMocks.trayFactory.mockReset();
  settingsStoreMocks.get.mockReset();
  settingsStoreMocks.get.mockReturnValue({
    appCloseBehavior: "exit",
    appStartMinimized: false,
  });
  overlayMocks.setPoeFocusActive.mockClear();
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
    expect(
      fakeWindow.windowOpenHandler?.({ url: "file:///C:/Users/seb/a.html" }),
    ).toEqual({ action: "deny" });
    expect(electronMocks.openExternal).toHaveBeenCalledTimes(1);

    fakeWindow.close();
    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
    expect(service.getMainWindow()).toBe(fakeWindow);

    fakeWindow.closedListener?.();
    expect(electronMocks.quit).toHaveBeenCalledTimes(1);
  });

  it("hides to tray when close behavior is minimize to tray", async () => {
    const fakeWindow = new FakeWindow();
    const fakeTray = new FakeTray();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    electronMocks.trayFactory.mockReturnValue(fakeTray);
    settingsStoreMocks.get.mockReturnValue({
      appCloseBehavior: "minimize-to-tray",
      appStartMinimized: false,
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.close();

    expect(fakeWindow.hide).toHaveBeenCalled();
    expect(electronMocks.quit).not.toHaveBeenCalled();
    expect(electronMocks.Tray).toHaveBeenCalledWith(
      expect.stringContaining("logo"),
    );
    expect(fakeTray.setToolTip).toHaveBeenCalledWith("Hinekora");
    expect(fakeTray.setContextMenu).toHaveBeenCalled();

    fakeTray.clickListener?.();
    expect(fakeWindow.show).toHaveBeenCalled();
    expect(fakeWindow.focus).toHaveBeenCalled();
  });

  it("supports tray menu actions and reuses an existing tray", async () => {
    const fakeWindow = new FakeWindow();
    const fakeTray = new FakeTray();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    electronMocks.trayFactory.mockReturnValue(fakeTray);
    const service = new MainWindowService();
    const internals = service as unknown as {
      ensureTray(): void;
      showMainWindow(): void;
    };

    await service.createMainWindow();
    internals.ensureTray();
    internals.ensureTray();
    expect(electronMocks.Tray).toHaveBeenCalledTimes(1);

    fakeWindow.minimized = true;
    internals.showMainWindow();
    expect(fakeWindow.restore).toHaveBeenCalled();
    expect(fakeWindow.show).toHaveBeenCalled();
    expect(fakeWindow.focus).toHaveBeenCalled();

    (fakeTray.contextMenu?.[0]?.click as (() => void) | undefined)?.();
    expect(fakeWindow.focus).toHaveBeenCalledTimes(2);

    (fakeTray.contextMenu?.[1]?.click as (() => void) | undefined)?.();
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
    const fakeTray = new FakeTray();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    electronMocks.trayFactory.mockReturnValue(fakeTray);
    settingsStoreMocks.get.mockReturnValue({
      appCloseBehavior: "exit",
      appStartMinimized: true,
    });
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.readyListener?.();

    expect(fakeWindow.show).not.toHaveBeenCalled();
    expect(electronMocks.Tray).toHaveBeenCalled();
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

  it("resolves tray icons for packaged and unpackaged platforms", () => {
    const service = new MainWindowService();
    const internals = service as unknown as {
      resolveTrayIconPath(): string;
    };
    const originalPlatform = process.platform;
    const originalResourcesPath = process.resourcesPath;

    try {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "darwin",
      });
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: "C:\\resources",
      });
      expect(internals.resolveTrayIconPath()).toContain(
        join("logo", "macos", "16x16.png"),
      );

      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "linux",
      });
      electronMocks.isPackaged = false;
      expect(internals.resolveTrayIconPath()).toContain(
        join("logo", "linux", "icons", "32x32.png"),
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: originalResourcesPath,
      });
      electronMocks.isPackaged = true;
    }
  });

  it("clears PoE focus when the main window receives focus", async () => {
    const fakeWindow = new FakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(fakeWindow);
    const service = new MainWindowService();

    await service.createMainWindow();
    fakeWindow.focusListener?.();

    expect(overlayMocks.setPoeFocusActive).toHaveBeenCalledWith(false);
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
});
