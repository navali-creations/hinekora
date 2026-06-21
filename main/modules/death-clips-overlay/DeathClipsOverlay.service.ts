import { BrowserWindow, screen } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import type { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import {
  closeOverlayWindow,
  configureGameOverlayWindow,
  createOverlayWebPreferences,
  loadOverlayRenderer,
} from "~/main/modules/overlay-windows/OverlayWindow.shared";
import {
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import type { ReplayClip } from "~/types";

const CLIP_PREVIEW_WIDTH = 560;
const CLIP_PREVIEW_HEIGHT = 396;
const CLIP_PREVIEW_GAP = 8;
const CLIP_PREVIEW_OVERLAY_FOCUS_ID = "clip-preview";

class DeathClipsOverlayService {
  private clipPreviewWindow: BrowserWindow | null = null;
  private clipPreviewOverlayRequested = false;

  constructor(
    private readonly coordinator: GameOverlayCoordinator,
    private readonly createAnchorBounds: () => Electron.Rectangle,
  ) {
    this.coordinator.register(this);
  }

  async showClip(clip: ReplayClip): Promise<void> {
    const clipPath = clip.processedClipPath ?? clip.originalObsPath;
    if (!clipPath) {
      return;
    }

    this.clipPreviewOverlayRequested = true;
    const bounds = this.createWindowBounds();
    if (!this.clipPreviewWindow || this.clipPreviewWindow.isDestroyed()) {
      await this.createWindow(bounds);
    } else {
      this.clipPreviewWindow.setBounds(bounds, false);
    }

    if (!this.clipPreviewWindow || this.clipPreviewWindow.isDestroyed()) {
      return;
    }

    await loadOverlayRenderer(
      this.clipPreviewWindow,
      `#/${WindowName.ClipPreviewOverlay}?clipId=${encodeURIComponent(clip.id)}`,
    );
    this.coordinator.showOrHideGameOverlayWindow(this.clipPreviewWindow);
  }

  hide(): void {
    const window = this.clipPreviewWindow;
    this.clipPreviewOverlayRequested = false;
    this.clipPreviewWindow = null;
    closeOverlayWindow(window);
  }

  suspendRequestedOverlay(): void {
    if (this.clipPreviewOverlayRequested) {
      this.coordinator.suspendGameOverlayWindow(this.clipPreviewWindow);
    }
  }

  restoreRequestedOverlay(): void {
    if (this.clipPreviewOverlayRequested) {
      this.coordinator.showGameOverlayWindow(this.clipPreviewWindow);
    }
  }

  destroy(): void {
    this.hide();
  }

  private async createWindow(bounds: Electron.Rectangle): Promise<void> {
    this.clipPreviewWindow = new BrowserWindow({
      ...bounds,
      minWidth: 320,
      minHeight: 220,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      show: false,
      webPreferences: createOverlayWebPreferences(),
    });

    const clipPreviewWindow = this.clipPreviewWindow;
    const clipPreviewWebContents = clipPreviewWindow.webContents;
    registerIpcWindowRole(
      clipPreviewWebContents,
      WindowName.ClipPreviewOverlay,
    );
    configureGameOverlayWindow(clipPreviewWindow);
    clipPreviewWindow.setContentProtection(true);
    clipPreviewWindow.on("focus", () => {
      this.coordinator.setOverlayFocusActive(
        CLIP_PREVIEW_OVERLAY_FOCUS_ID,
        true,
      );
    });
    clipPreviewWindow.on("blur", () => {
      this.coordinator.setOverlayFocusActive(
        CLIP_PREVIEW_OVERLAY_FOCUS_ID,
        false,
      );
    });
    clipPreviewWindow.on("closed", () => {
      this.coordinator.setOverlayFocusActive(
        CLIP_PREVIEW_OVERLAY_FOCUS_ID,
        false,
      );
      unregisterIpcWindowRole(clipPreviewWebContents);
      if (this.clipPreviewWindow === clipPreviewWindow) {
        this.clipPreviewWindow = null;
      }
    });
  }

  private createWindowBounds(): Electron.Rectangle {
    const anchorBounds = this.createAnchorBounds();
    const display = screen.getDisplayMatching(anchorBounds).workArea;
    const width = Math.min(CLIP_PREVIEW_WIDTH, display.width);
    const height = Math.min(CLIP_PREVIEW_HEIGHT, display.height);
    const belowY = anchorBounds.y + anchorBounds.height + CLIP_PREVIEW_GAP;
    const aboveY = anchorBounds.y - height - CLIP_PREVIEW_GAP;
    const hasSpaceBelow = belowY + height <= display.y + display.height;
    const y = hasSpaceBelow
      ? belowY
      : aboveY >= display.y
        ? aboveY
        : this.clamp(
            anchorBounds.y,
            display.y,
            display.y + display.height - height,
          );

    return {
      x: this.clamp(
        anchorBounds.x,
        display.x,
        display.x + display.width - width,
      ),
      y,
      width,
      height,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, Math.max(min, max)));
  }
}

export { DeathClipsOverlayService };
