import { BrowserWindow, screen } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import type { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import {
  closeOverlayWindow,
  configureGameOverlayWindow,
  createOverlayWebPreferences,
  isOverlayRendererWindow,
  loadOverlayRenderer,
} from "~/main/modules/overlay-windows/OverlayWindow.shared";
import {
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { OverlayWindowsChannel } from "../overlay-windows/OverlayWindows.channels";

const RECORDER_OVERLAY_WIDTH = 420;
const RECORDER_OVERLAY_HEIGHT = 56;
const RECORDER_OVERLAY_RIGHT_MARGIN = 20;
const RECORDER_OVERLAY_TOP_MARGIN = 24;
const RECORDER_OVERLAY_FOCUS_ID = "recorder-controls";

class RecordingControlsOverlayService {
  private recorderWindow: BrowserWindow | null = null;
  private recorderOverlayRequested = false;
  private preserveRequestOnClose = false;

  constructor(private readonly coordinator: GameOverlayCoordinator) {
    this.coordinator.register(this);
  }

  async show(): Promise<void> {
    const wasVisible = this.isVisible();
    this.recorderOverlayRequested = true;
    if (!this.recorderWindow || this.recorderWindow.isDestroyed()) {
      await this.createWindow();
    }

    this.coordinator.showOrHideGameOverlayWindow(this.recorderWindow);
    if (!wasVisible) {
      this.publishVisibilityChanged(true);
    }
  }

  hide(): void {
    const wasVisible = this.isVisible();
    this.recorderOverlayRequested = false;
    this.coordinator.hideGameOverlayWindow(this.recorderWindow);
    if (wasVisible) {
      this.publishVisibilityChanged(false);
    }
  }

  async toggle(): Promise<void> {
    if (this.isVisible()) {
      this.hide();
      return;
    }

    await this.show();
  }

  isVisible(): boolean {
    return this.recorderOverlayRequested;
  }

  getWindow(): BrowserWindow | null {
    return this.recorderWindow;
  }

  createAnchorBounds(): Electron.Rectangle {
    if (this.recorderWindow && !this.recorderWindow.isDestroyed()) {
      return this.recorderWindow.getBounds();
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width } = primaryDisplay.workArea;

    return {
      width: RECORDER_OVERLAY_WIDTH,
      height: RECORDER_OVERLAY_HEIGHT,
      x: x + width - RECORDER_OVERLAY_WIDTH - RECORDER_OVERLAY_RIGHT_MARGIN,
      y: y + RECORDER_OVERLAY_TOP_MARGIN,
    };
  }

  suspendRequestedOverlay(): void {
    if (this.recorderOverlayRequested) {
      this.coordinator.suspendGameOverlayWindow(this.recorderWindow);
    }
  }

  async restoreRequestedOverlay(): Promise<void> {
    if (this.recorderOverlayRequested) {
      await this.show();
    }
  }

  suspendForSystem(): void {
    if (!this.recorderOverlayRequested) {
      return;
    }

    this.closeWindow({ preserveRequest: true });
  }

  destroy(): void {
    this.preserveRequestOnClose = false;
    this.recorderOverlayRequested = false;
    this.closeWindow({ preserveRequest: false });
  }

  private async createWindow(): Promise<void> {
    const anchorBounds = this.createAnchorBounds();

    this.recorderWindow = new BrowserWindow({
      ...anchorBounds,
      minWidth: 400,
      minHeight: 52,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      show: false,
      webPreferences: createOverlayWebPreferences(),
    });

    const recorderWindow = this.recorderWindow;
    const recorderWebContents = recorderWindow.webContents;
    registerIpcWindowRole(recorderWebContents, WindowName.RecorderOverlay);
    configureGameOverlayWindow(recorderWindow);
    recorderWindow.on("focus", () => {
      this.coordinator.setOverlayFocusActive(RECORDER_OVERLAY_FOCUS_ID, true);
    });
    recorderWindow.on("blur", () => {
      this.coordinator.setOverlayFocusActive(RECORDER_OVERLAY_FOCUS_ID, false);
    });
    recorderWindow.on("closed", () => {
      this.coordinator.setOverlayFocusActive(RECORDER_OVERLAY_FOCUS_ID, false);
      unregisterIpcWindowRole(recorderWebContents);
      const preserveRequest = this.preserveRequestOnClose;
      this.preserveRequestOnClose = false;
      const wasVisible = this.isVisible();
      if (!preserveRequest) {
        this.recorderOverlayRequested = false;
      }
      if (this.recorderWindow === recorderWindow) {
        this.recorderWindow = null;
      }
      if (wasVisible && !preserveRequest) {
        this.publishVisibilityChanged(false);
      }
    });

    await loadOverlayRenderer(
      recorderWindow,
      `#/${WindowName.RecorderOverlay}`,
    );
  }

  private publishVisibilityChanged(isVisible: boolean): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed() || isOverlayRendererWindow(window)) {
        continue;
      }

      window.webContents.send(
        OverlayWindowsChannel.RecorderVisibilityChanged,
        isVisible,
      );
    }
  }

  private closeWindow(input: { preserveRequest: boolean }): void {
    const window = this.recorderWindow;
    this.recorderWindow = null;
    if (input.preserveRequest && window && !window.isDestroyed()) {
      this.preserveRequestOnClose = true;
    }

    closeOverlayWindow(window);
  }
}

export { RecordingControlsOverlayService };
