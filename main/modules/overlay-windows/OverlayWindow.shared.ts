import { join } from "node:path";

import { app, type BrowserWindow } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";

const currentDir = __dirname;
const OVERLAY_TOPMOST_LEVEL = 1;
const OVERLAY_ROUTE_NAMES = [
  WindowName.RecorderOverlay,
  WindowName.ClipPreviewOverlay,
  WindowName.CropSelectorOverlay,
  WindowName.AuraOverlay,
];

interface GameOverlayWindowOptions {
  contentProtection?: boolean;
}

function createOverlayWebPreferences(): Electron.WebPreferences {
  return {
    preload: join(currentDir, "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    devTools: !app.isPackaged,
    sandbox: true,
  };
}

function applyGameOverlayContentProtection(
  window: BrowserWindow | null,
  enabled: boolean,
): void {
  if (!window || window.isDestroyed()) {
    return;
  }

  window.setContentProtection(enabled);
}

function configureGameOverlayWindow(
  window: BrowserWindow,
  options: GameOverlayWindowOptions = {},
): void {
  window.setAlwaysOnTop(true, "screen-saver", OVERLAY_TOPMOST_LEVEL);
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });
  window.setFullScreenable(false);
  if (options.contentProtection !== undefined) {
    applyGameOverlayContentProtection(window, options.contentProtection);
  }
}

function showGameOverlayWindow(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) {
    return;
  }

  configureGameOverlayWindow(window);
  window.setOpacity(1);
  window.setIgnoreMouseEvents(false);
  if (!window.isVisible()) {
    window.showInactive();
    window.moveTop();
  }
}

function hideGameOverlayWindow(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) {
    return;
  }

  window.setOpacity(1);
  window.setIgnoreMouseEvents(false);
  window.hide();
}

function suspendGameOverlayWindow(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed() || !window.isVisible()) {
    return;
  }

  // Keep the native window mapped while PoE is unfocused; hide/show causes a
  // visible remap flash when the game regains focus.
  window.setIgnoreMouseEvents(true);
  window.setOpacity(0);
}

function closeOverlayWindow(window: BrowserWindow | null): void {
  if (window && !window.isDestroyed()) {
    window.close();
  }
}

async function loadOverlayRenderer(
  window: BrowserWindow,
  hash: string,
): Promise<void> {
  if (
    typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined" &&
    MAIN_WINDOW_VITE_DEV_SERVER_URL
  ) {
    await window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${hash}`);
    return;
  }

  await window.loadFile(
    join(
      currentDir,
      `../renderer/${typeof MAIN_WINDOW_VITE_NAME !== "undefined" ? MAIN_WINDOW_VITE_NAME : "main_window"}/index.html`,
    ),
    {
      hash: hash.replace(/^#/, ""),
    },
  );
}

function isOverlayRendererWindow(window: BrowserWindow): boolean {
  const url = window.webContents.getURL();

  return OVERLAY_ROUTE_NAMES.some((routeName) => url.includes(routeName));
}

export {
  applyGameOverlayContentProtection,
  closeOverlayWindow,
  configureGameOverlayWindow,
  createOverlayWebPreferences,
  hideGameOverlayWindow,
  isOverlayRendererWindow,
  loadOverlayRenderer,
  showGameOverlayWindow,
  suspendGameOverlayWindow,
};
