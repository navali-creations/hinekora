import { join } from "node:path";

import { BrowserWindow } from "electron";

import {
  createWindowRoleArgument,
  WindowName,
} from "~/main/modules/main-window/MainWindow.types";
import { logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { getIpcWindowRole } from "~/main/utils/ipc-window-roles";
import { registerRendererFailureDiagnostics } from "~/main/utils/renderer-diagnostics";
import { isCurrentRendererDocument } from "~/main/utils/renderer-navigation";

const currentDir = __dirname;
const OVERLAY_TOPMOST_LEVEL = 1;
const OVERLAY_WINDOWS_SCOPE = "overlay-windows";
const configuredOverlayWindows = new WeakSet<BrowserWindow>();
let overlayDevToolsEnabled: boolean | undefined;

interface GameOverlayWindowOptions {
  contentProtection?: boolean;
}

function createOverlayWebPreferences(
  windowName: Exclude<WindowName, WindowName.Main>,
): Electron.WebPreferences {
  return {
    additionalArguments: [createWindowRoleArgument(windowName)],
    preload: join(currentDir, "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    // The persisted troubleshooting toggle may attach after a packaged overlay
    // is created, so capability stays available while visibility is gated below.
    devTools: true,
    sandbox: true,
  };
}

function syncOverlayDevToolsForWindow(
  window: BrowserWindow,
  enabled: boolean,
): void {
  if (window.isDestroyed()) {
    return;
  }

  try {
    if (enabled) {
      if (!window.webContents.isDevToolsOpened()) {
        window.webContents.openDevTools({ activate: false, mode: "detach" });
      }
      return;
    }

    if (window.webContents.isDevToolsOpened()) {
      window.webContents.closeDevTools();
    }
  } catch (error) {
    logWarn(OVERLAY_WINDOWS_SCOPE, "Could not update overlay DevTools", {
      enabled,
      error: safeErrorMessage(error),
      window: getIpcWindowRole({ sender: window.webContents }) ?? "unknown",
    });
  }
}

function setOverlayDevToolsEnabled(enabled: boolean): void {
  if (overlayDevToolsEnabled === enabled) {
    return;
  }

  overlayDevToolsEnabled = enabled;

  for (const window of BrowserWindow.getAllWindows()) {
    if (configuredOverlayWindows.has(window)) {
      syncOverlayDevToolsForWindow(window, enabled);
    }
  }
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
  if (!configuredOverlayWindows.has(window)) {
    const windowRole = getIpcWindowRole({ sender: window.webContents });
    registerRendererFailureDiagnostics(window.webContents, {
      logScope: OVERLAY_WINDOWS_SCOPE,
      windowKind: windowRole ? `${windowRole} window` : "Overlay window",
    });
    window.webContents.on("will-navigate", (details) => {
      if (isCurrentRendererDocument(window.webContents, details.url)) {
        return;
      }

      details.preventDefault();
    });
    window.webContents.on("will-redirect", (event) => {
      event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  }
  configuredOverlayWindows.add(window);
  window.setAlwaysOnTop(true, "screen-saver", OVERLAY_TOPMOST_LEVEL);
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });
  window.setFullScreenable(false);
  if (options.contentProtection !== undefined) {
    applyGameOverlayContentProtection(window, options.contentProtection);
  }
  syncOverlayDevToolsForWindow(window, overlayDevToolsEnabled === true);
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
  const role = getIpcWindowRole({ sender: window.webContents });
  return role !== null && role !== WindowName.Main;
}

export {
  applyGameOverlayContentProtection,
  closeOverlayWindow,
  configureGameOverlayWindow,
  createOverlayWebPreferences,
  hideGameOverlayWindow,
  isOverlayRendererWindow,
  loadOverlayRenderer,
  setOverlayDevToolsEnabled,
  showGameOverlayWindow,
  suspendGameOverlayWindow,
};
