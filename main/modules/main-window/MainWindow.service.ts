import { join } from "node:path";

import { app, BrowserWindow, Menu, screen, shell } from "electron";

import { SettingsStoreService } from "~/main/modules/settings-store";
import { TrayService } from "~/main/modules/tray";
import { UpdaterService } from "~/main/modules/updater";
import { logWarn } from "~/main/utils/app-log";
import { validateBoundsOnDisplays } from "~/main/utils/display-geometry";
import {
  assertString,
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
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
const MAIN_WINDOW_EDITOR_CLIP_ID_MAX_LENGTH = 128;
const MAIN_WINDOW_LOG_SCOPE = "main-window";
const MAIN_WINDOW_DEFAULT_WIDTH = 1200;
const MAIN_WINDOW_DEFAULT_HEIGHT = 800;
const MAIN_WINDOW_BOUNDS_MIN_OVERLAP = 100;
const MAIN_WINDOW_BOUNDS_SAVE_DEBOUNCE_MS = 500;
const HINEKORA_DISCORD_URL = "https://discord.gg/mrqmPYXHHT";
const HINEKORA_GITHUB_URL = "https://github.com/navali-creations/hinekora";

class MainWindowService {
  private static instance: MainWindowService | null = null;

  private mainWindow: BrowserWindow | null = null;
  private isQuitting = false;
  private savedBoundsForQuit = false;
  private debouncedSaveBoundsTimer: ReturnType<typeof setTimeout> | null = null;
  private boundsMovedHandler: (() => void) | null = null;
  private boundsResizedHandler: (() => void) | null = null;

  static getInstance(): MainWindowService {
    if (!MainWindowService.instance) {
      MainWindowService.instance = new MainWindowService();
    }

    return MainWindowService.instance;
  }

  constructor() {
    app.on("before-quit", () => {
      this.isQuitting = true;
      this.saveMainWindowBoundsForQuit();
      TrayService.getInstance().destroyTray();
    });
    this.setupHandlers();
  }

  async createMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    Menu.setApplicationMenu(null);

    const restoredBounds = this.getRestoredMainWindowBounds();
    this.mainWindow = new BrowserWindow({
      ...(restoredBounds
        ? {
            x: restoredBounds.x,
            y: restoredBounds.y,
          }
        : {}),
      width: restoredBounds?.width ?? MAIN_WINDOW_DEFAULT_WIDTH,
      height: restoredBounds?.height ?? MAIN_WINDOW_DEFAULT_HEIGHT,
      minWidth: MAIN_WINDOW_DEFAULT_WIDTH,
      minHeight: MAIN_WINDOW_DEFAULT_HEIGHT,
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

      this.saveMainWindowBoundsImmediate(mainWindow);
      event.preventDefault();
      if (this.shouldMinimizeToTray()) {
        this.hideMainWindowToTray();
        return;
      }

      this.quitApplication();
    });
    mainWindow.on("closed", () => {
      this.removeBoundsListeners(mainWindow);
      unregisterIpcWindowRole(mainWindowWebContents);
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null;
      }
      if (!this.isQuitting) {
        app.quit();
      }
    });
    this.createTray();
    this.attachBoundsListeners(mainWindow);
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

    registerGuardedIpcHandler(
      MainWindowChannel.OpenEditorClip,
      [WindowName.Main, WindowName.ClipPreviewOverlay],
      (_event, clipId: unknown) => {
        try {
          assertString(clipId, "clip id", MainWindowChannel.OpenEditorClip, {
            min: 1,
            max: MAIN_WINDOW_EDITOR_CLIP_ID_MAX_LENGTH,
          });
        } catch (error) {
          return handleValidationError(error);
        }

        return this.openEditorClip(clipId);
      },
    );

    registerGuardedIpcHandler(
      MainWindowChannel.OpenDevTools,
      [WindowName.Main],
      () => {
        this.openMainWindowDevTools();
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
    this.createTray();
    this.saveMainWindowBoundsImmediate();
    this.mainWindow?.hide();
  }

  private async openEditorClip(clipId: string): Promise<void> {
    const mainWindow = await this.createMainWindow();
    await this.navigateMainWindowToEditorClip(mainWindow, clipId);
    this.showMainWindow();
  }

  private async openSettingsHelp(): Promise<void> {
    const mainWindow = await this.createMainWindow();
    await this.navigateMainWindowToSettingsHelp(mainWindow);
    this.showMainWindow();
  }

  private async navigateMainWindowToEditorClip(
    mainWindow: BrowserWindow,
    clipId: string,
  ): Promise<void> {
    if (mainWindow.isDestroyed()) {
      return;
    }

    const hash = `#/editor?kind=clip&id=${encodeURIComponent(clipId)}`;
    await mainWindow.webContents.executeJavaScript(
      `globalThis.location.hash = ${JSON.stringify(hash)}`,
    );
  }

  private async navigateMainWindowToSettingsHelp(
    mainWindow: BrowserWindow,
  ): Promise<void> {
    if (mainWindow.isDestroyed()) {
      return;
    }

    await mainWindow.webContents.executeJavaScript(
      `globalThis.location.hash = ${JSON.stringify("#/settings?tab=help")}`,
    );
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

  private openMainWindowDevTools(
    mainWindow: BrowserWindow | null = this.mainWindow,
  ): void {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (mainWindow.webContents.isDevToolsOpened()) {
      return;
    }

    mainWindow.webContents.openDevTools({
      mode: "detach",
      activate: true,
    });
  }

  private quitApplication(): void {
    this.saveMainWindowBoundsForQuit();
    this.isQuitting = true;
    app.quit();
  }

  private createTray(): void {
    TrayService.getInstance().createTray({
      openDiscord: () => {
        void shell.openExternal(HINEKORA_DISCORD_URL);
      },
      openGitHub: () => {
        void shell.openExternal(HINEKORA_GITHUB_URL);
      },
      openHelp: () => this.openSettingsHelp(),
      showMainWindow: () => this.showMainWindow(),
      quitApplication: () => this.quitApplication(),
    });
  }

  private getRestoredMainWindowBounds(): Electron.Rectangle | null {
    try {
      return validateBoundsOnDisplays(
        SettingsStoreService.getInstance().get().mainWindowBounds,
        screen.getAllDisplays(),
        MAIN_WINDOW_BOUNDS_MIN_OVERLAP,
      );
    } catch (error) {
      logWarn(MAIN_WINDOW_LOG_SCOPE, "Failed to restore main window bounds", {
        error: safeErrorMessage(error),
      });
      return null;
    }
  }

  private attachBoundsListeners(mainWindow: BrowserWindow): void {
    const debouncedSaveBounds = () => {
      if (this.debouncedSaveBoundsTimer) {
        clearTimeout(this.debouncedSaveBoundsTimer);
      }

      this.debouncedSaveBoundsTimer = setTimeout(() => {
        this.saveMainWindowBoundsImmediate(mainWindow);
        this.debouncedSaveBoundsTimer = null;
      }, MAIN_WINDOW_BOUNDS_SAVE_DEBOUNCE_MS);
    };

    this.boundsMovedHandler = debouncedSaveBounds;
    this.boundsResizedHandler = debouncedSaveBounds;
    mainWindow.on("moved", this.boundsMovedHandler);
    mainWindow.on("resized", this.boundsResizedHandler);
  }

  private removeBoundsListeners(mainWindow: BrowserWindow | null): void {
    if (this.debouncedSaveBoundsTimer) {
      clearTimeout(this.debouncedSaveBoundsTimer);
      this.debouncedSaveBoundsTimer = null;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      if (this.boundsMovedHandler) {
        mainWindow.removeListener("moved", this.boundsMovedHandler);
      }
      if (this.boundsResizedHandler) {
        mainWindow.removeListener("resized", this.boundsResizedHandler);
      }
    }

    this.boundsMovedHandler = null;
    this.boundsResizedHandler = null;
  }

  private saveMainWindowBoundsImmediate(
    mainWindow: BrowserWindow | null = this.mainWindow,
  ): void {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMaximized()) {
      return;
    }

    try {
      SettingsStoreService.getInstance().update({
        mainWindowBounds: mainWindow.getBounds(),
      });
    } catch (error) {
      logWarn(MAIN_WINDOW_LOG_SCOPE, "Failed to save main window bounds", {
        error: safeErrorMessage(error),
      });
    }
  }

  private saveMainWindowBoundsForQuit(): void {
    if (this.savedBoundsForQuit) {
      return;
    }

    this.savedBoundsForQuit = true;
    this.saveMainWindowBoundsImmediate();
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

        this.openMainWindowDevTools(window);
      }
    });
  }
}

export { MainWindowService };
