import { BrowserWindow, screen } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import type { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import {
  applyGameOverlayContentProtection,
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
import type { RecorderOverlayMode } from "../overlay-windows/OverlayWindows.dto";

const RECORDER_OVERLAY_BOUNDS: Record<
  RecorderOverlayMode,
  Pick<Electron.Rectangle, "width" | "height">
> = {
  expanded: { width: 360, height: 86 },
  minimized: { width: 236, height: 42 },
};
const RECORDER_OVERLAY_RIGHT_MARGIN = 20;
const RECORDER_OVERLAY_TOP_MARGIN = 24;

class RecordingControlsOverlayService {
  private recorderWindow: BrowserWindow | null = null;
  private recorderOverlayRequested = false;
  private preserveRequestOnClose = false;
  private recorderOverlayMode: RecorderOverlayMode = "expanded";

  constructor(
    private readonly coordinator: GameOverlayCoordinator,
    private readonly getContentProtectionEnabled = () => false,
  ) {
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

  getMode(): RecorderOverlayMode {
    return this.recorderOverlayMode;
  }

  setMode(mode: RecorderOverlayMode): RecorderOverlayMode {
    if (this.recorderOverlayMode === mode) {
      return this.recorderOverlayMode;
    }

    this.recorderOverlayMode = mode;
    this.applyModeBounds();
    this.publishModeChanged(mode);

    return this.recorderOverlayMode;
  }

  createAnchorBounds(): Electron.Rectangle {
    if (this.recorderWindow && !this.recorderWindow.isDestroyed()) {
      return this.recorderWindow.getBounds();
    }

    return this.createDefaultBounds(this.recorderOverlayMode);
  }

  setContentProtectionEnabled(enabled: boolean): void {
    applyGameOverlayContentProtection(this.recorderWindow, enabled);
  }

  private createDefaultBounds(mode: RecorderOverlayMode): Electron.Rectangle {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width } = primaryDisplay.workArea;
    const bounds = RECORDER_OVERLAY_BOUNDS[mode];

    return {
      ...bounds,
      x: x + width - bounds.width - RECORDER_OVERLAY_RIGHT_MARGIN,
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
      minWidth: RECORDER_OVERLAY_BOUNDS.minimized.width,
      minHeight: RECORDER_OVERLAY_BOUNDS.minimized.height,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      webPreferences: createOverlayWebPreferences(),
    });

    const recorderWindow = this.recorderWindow;
    const recorderWebContents = recorderWindow.webContents;
    registerIpcWindowRole(recorderWebContents, WindowName.RecorderOverlay);
    configureGameOverlayWindow(recorderWindow, {
      contentProtection: this.getContentProtectionEnabled(),
    });
    recorderWindow.on("closed", () => {
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

  private applyModeBounds(): void {
    const window = this.recorderWindow;
    if (!window || window.isDestroyed()) {
      return;
    }

    const currentBounds = window.getBounds();
    const nextBounds = RECORDER_OVERLAY_BOUNDS[this.recorderOverlayMode];
    window.setBounds({
      ...currentBounds,
      ...nextBounds,
      x: currentBounds.x + currentBounds.width - nextBounds.width,
    });
  }

  private publishModeChanged(mode: RecorderOverlayMode): void {
    if (!this.recorderWindow || this.recorderWindow.isDestroyed()) {
      return;
    }

    this.recorderWindow.webContents.send(
      OverlayWindowsChannel.RecorderModeChanged,
      mode,
    );
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
