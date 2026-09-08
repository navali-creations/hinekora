import { join } from "node:path";

import { app, BrowserWindow } from "electron";

import { DatabaseService } from "~/main/modules/database";
import {
  createWindowRoleArgument,
  WindowName,
} from "~/main/modules/main-window/MainWindow.types";
import {
  configureGameOverlayWindow,
  createOverlayWebPreferences,
  setOverlayDevToolsEnabled,
} from "~/main/modules/overlay-windows/OverlayWindow.shared";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import type { NativeOverlayDevToolsHarness } from "~/e2e/helpers/native-overlay-devtools.types";

const fixturePath = join(
  process.cwd(),
  "e2e",
  "helpers",
  "native-overlay-devtools.html",
);
const databasePath = process.env.HINEKORA_E2E_SETTINGS_DB_PATH;

if (!databasePath) {
  throw new Error("HINEKORA_E2E_SETTINGS_DB_PATH is required");
}

const overlayWindows: BrowserWindow[] = [];
let controllerWindow: BrowserWindow | null = null;

function registerWindowRole(window: BrowserWindow, role: WindowName): void {
  const { webContents } = window;
  registerIpcWindowRole(webContents, role);
  window.once("closed", () => unregisterIpcWindowRole(webContents));
}

async function createControllerWindow(): Promise<void> {
  controllerWindow = new BrowserWindow({
    height: 240,
    show: false,
    width: 320,
    webPreferences: {
      additionalArguments: [createWindowRoleArgument(WindowName.Main)],
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.js"),
      sandbox: true,
    },
  });
  registerWindowRole(controllerWindow, WindowName.Main);
  await controllerWindow.loadFile(fixturePath, { hash: "/main" });
}

async function createOverlayWindow(): Promise<void> {
  const window = new BrowserWindow({
    height: 240,
    show: true,
    width: 320,
    webPreferences: createOverlayWebPreferences(WindowName.RecorderOverlay),
  });
  registerWindowRole(window, WindowName.RecorderOverlay);
  configureGameOverlayWindow(window);
  overlayWindows.push(window);
  await window.loadFile(fixturePath, { hash: "/recorder-overlay" });
  window.focus();
}

function getState() {
  return {
    overlays: overlayWindows
      .filter((window) => !window.isDestroyed())
      .map((window) => ({
        devToolsOpened: window.webContents.isDevToolsOpened(),
        focused: window.isFocused(),
      })),
  };
}

const harness: NativeOverlayDevToolsHarness = {
  createOverlay: createOverlayWindow,
  getState,
};

Object.assign(globalThis, {
  __HINEKORA_OVERLAY_DEVTOOLS_E2E__: harness,
});

async function initialize(): Promise<void> {
  DatabaseService.getInstance(databasePath);
  const settingsStore = SettingsStoreService.getInstance();
  setOverlayDevToolsEnabled(settingsStore.get().overlayDevToolsEnabled);
  settingsStore.onDidChange((settings) => {
    setOverlayDevToolsEnabled(settings.overlayDevToolsEnabled);
  });

  await app.whenReady();
  await createControllerWindow();
  await createOverlayWindow();
}

void initialize().catch((error) => {
  console.error(error);
  app.quit();
});

app.on("before-quit", () => {
  DatabaseService.getInstance().close();
});

app.on("window-all-closed", () => {
  app.quit();
});
