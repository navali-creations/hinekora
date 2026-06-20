import { join } from "node:path";

import { app, BrowserWindow, Menu, shell, Tray } from "electron";

import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { UpdaterService } from "~/main/modules/updater";
import {
  registerGuardedIpcHandler,
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { MainWindowChannel } from "./MainWindow.channels";
import { WindowName } from "./MainWindow.types";
import { isAllowedExternalUrl } from "./MainWindow.utils";

const currentDir = __dirname;
const START_MINIMIZED_ARG = "--hidden";

class MainWindowService {
  private static instance: MainWindowService | null = null;

  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private isQuitting = false;

  static getInstance(): MainWindowService {
    if (!MainWindowService.instance) {
      MainWindowService.instance = new MainWindowService();
    }

    return MainWindowService.instance;
  }

  constructor() {
    app.on("before-quit", () => {
      this.isQuitting = true;
    });
    this.setupHandlers();
  }

  async createMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    Menu.setApplicationMenu(null);

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1200,
      minHeight: 800,
      autoHideMenuBar: true,
      backgroundColor: "#080909",
      frame: false,
      title: "Hinekora",
      show: false,
      webPreferences: {
        preload: join(currentDir, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    const mainWindow = this.mainWindow;
    const mainWindowWebContents = mainWindow.webContents;
    registerIpcWindowRole(mainWindowWebContents, WindowName.Main);

    mainWindow.once("ready-to-show", () => {
      if (mainWindow.isDestroyed()) {
        return;
      }

      if (this.shouldStartMinimized()) {
        this.ensureTray();
        return;
      }

      mainWindow.show();
    });
    mainWindowWebContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedExternalUrl(url)) {
        void shell.openExternal(url);
      }

      return { action: "deny" };
    });
    mainWindow.on("close", (event) => {
      if (this.isQuitting) {
        return;
      }

      event.preventDefault();
      if (this.shouldMinimizeToTray()) {
        this.hideMainWindowToTray();
        return;
      }

      this.quitApplication();
    });
    mainWindow.on("closed", () => {
      unregisterIpcWindowRole(mainWindowWebContents);
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null;
      }
      if (!this.isQuitting) {
        app.quit();
      }
    });
    mainWindow.on("focus", () => {
      OverlayWindowsService.getInstance().setPoeFocusActive(false);
    });
    this.setupDevelopmentShortcuts(mainWindow);
    UpdaterService.getInstance().initialize(mainWindow);

    try {
      await this.loadRenderer(mainWindow);
    } catch (error) {
      if (this.isInterruptedWindowLoadError(error, mainWindow)) {
        return mainWindow;
      }

      throw error;
    }

    return mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      MainWindowChannel.Minimize,
      [WindowName.Main],
      () => {
        this.mainWindow?.minimize();
      },
    );

    registerGuardedIpcHandler(
      MainWindowChannel.Maximize,
      [WindowName.Main],
      () => {
        if (this.mainWindow && !this.mainWindow.isMaximized()) {
          this.mainWindow.maximize();
        }

        return this.mainWindow?.isMaximized() ?? false;
      },
    );

    registerGuardedIpcHandler(
      MainWindowChannel.Unmaximize,
      [WindowName.Main],
      () => {
        if (this.mainWindow?.isMaximized()) {
          this.mainWindow.unmaximize();
        }

        return this.mainWindow?.isMaximized() ?? false;
      },
    );

    registerGuardedIpcHandler(
      MainWindowChannel.IsMaximized,
      [WindowName.Main],
      () => this.mainWindow?.isMaximized() ?? false,
    );

    registerGuardedIpcHandler(
      MainWindowChannel.Close,
      [WindowName.Main],
      () => {
        this.requestClose();
      },
    );
  }

  private requestClose(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
      return;
    }

    this.quitApplication();
  }

  private hideMainWindowToTray(): void {
    this.ensureTray();
    this.mainWindow?.hide();
  }

  private showMainWindow(): void {
    const mainWindow = this.mainWindow;

    if (!mainWindow || mainWindow.isDestroyed()) {
      void this.createMainWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }

  private ensureTray(): void {
    if (this.tray) {
      return;
    }

    this.tray = new Tray(this.resolveTrayIconPath());
    this.tray.setToolTip("Hinekora");
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Show Hinekora",
          click: () => this.showMainWindow(),
        },
        {
          label: "Quit Hinekora",
          click: () => this.quitApplication(),
        },
      ]),
    );
    this.tray.on("click", () => this.showMainWindow());
  }

  private quitApplication(): void {
    this.isQuitting = true;
    app.quit();
  }

  private shouldMinimizeToTray(): boolean {
    try {
      return (
        SettingsStoreService.getInstance().get().appCloseBehavior ===
        "minimize-to-tray"
      );
    } catch {
      return false;
    }
  }

  private shouldStartMinimized(): boolean {
    if (process.argv.includes(START_MINIMIZED_ARG)) {
      return true;
    }

    try {
      return SettingsStoreService.getInstance().get().appStartMinimized;
    } catch {
      return false;
    }
  }

  private resolveTrayIconPath(): string {
    const platformIconPath =
      process.platform === "darwin"
        ? ["logo", "macos", "16x16.png"]
        : process.platform === "linux"
          ? ["logo", "linux", "icons", "32x32.png"]
          : ["logo", "windows", "32x32.png"];

    if (app.isPackaged && process.resourcesPath) {
      return join(process.resourcesPath, ...platformIconPath);
    }

    return join(app.getAppPath(), "renderer", "assets", ...platformIconPath);
  }

  private async loadRenderer(window: BrowserWindow): Promise<void> {
    if (
      typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined" &&
      MAIN_WINDOW_VITE_DEV_SERVER_URL
    ) {
      await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      return;
    }

    await window.loadFile(
      join(
        currentDir,
        `../renderer/${typeof MAIN_WINDOW_VITE_NAME !== "undefined" ? MAIN_WINDOW_VITE_NAME : "main_window"}/index.html`,
      ),
    );
  }

  private isInterruptedWindowLoadError(
    error: unknown,
    window: BrowserWindow,
  ): boolean {
    const message = error instanceof Error ? error.message : String(error);

    return (
      this.isQuitting ||
      window.isDestroyed() ||
      message.includes("ERR_FAILED") ||
      message.includes("ERR_ABORTED")
    );
  }

  private setupDevelopmentShortcuts(window: BrowserWindow): void {
    if (
      app.isPackaged ||
      typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === "undefined" ||
      !MAIN_WINDOW_VITE_DEV_SERVER_URL
    ) {
      return;
    }

    window.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") {
        return;
      }

      const key = input.key.toLowerCase();
      const isCommandOrControl = input.control || input.meta;
      const shouldReload = key === "f5" || (isCommandOrControl && key === "r");
      const shouldToggleDevTools =
        key === "f12" || (isCommandOrControl && input.shift && key === "i");

      if (shouldReload) {
        event.preventDefault();
        window.webContents.reloadIgnoringCache();
        return;
      }

      if (shouldToggleDevTools) {
        event.preventDefault();
        if (window.webContents.isDevToolsOpened()) {
          window.webContents.closeDevTools();
          return;
        }

        window.webContents.openDevTools({
          mode: "detach",
          activate: true,
        });
      }
    });
  }
}

export { MainWindowService };
