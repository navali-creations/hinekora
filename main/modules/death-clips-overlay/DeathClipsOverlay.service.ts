import { BrowserWindow, screen } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import type { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import {
  applyGameOverlayContentProtection,
  closeOverlayWindow,
  configureGameOverlayWindow,
  createOverlayWebPreferences,
  loadOverlayRenderer,
} from "~/main/modules/overlay-windows/OverlayWindow.shared";
import { logInfo } from "~/main/utils/app-log";
import {
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import type { ReplayClip } from "~/types";

const CLIP_PREVIEW_WIDTH = 560;
const CLIP_PREVIEW_HEIGHT = 520;
const CLIP_PREVIEW_GAP = 8;
const CLIP_PREVIEW_OVERLAY_FOCUS_ID = "clip-preview";
const CLIP_PREVIEW_OVERLAY_SCOPE = "death-clips-overlay";

function createClipPreviewRoute(clipId: string): string {
  const diagnosticsQuery =
    process.env.HINEKORA_CLIP_PREVIEW_DIAGNOSTICS === "1"
      ? "&diagnostics=1"
      : "";
  return `#/${WindowName.ClipPreviewOverlay}?clipId=${encodeURIComponent(
    clipId,
  )}${diagnosticsQuery}`;
}

type ClipPreviewOverlayCloseReason =
  | "destroy"
  | "hide-requested"
  | "window-closed";

class DeathClipsOverlayService {
  private clipPreviewWindow: BrowserWindow | null = null;
  private clipPreviewOverlayRequested = false;

  constructor(
    private readonly coordinator: GameOverlayCoordinator,
    private readonly createAnchorBounds: () => Electron.Rectangle,
    private readonly getContentProtectionEnabled = () => false,
    private readonly onClosed = () => {},
  ) {
    this.coordinator.register(this);
  }

  async showClip(clip: ReplayClip): Promise<void> {
    const showStartedAt = Date.now();
    const wasRequested = this.clipPreviewOverlayRequested;
    const bounds = this.createWindowBounds();
    const reusedWindow = Boolean(
      this.clipPreviewWindow && !this.clipPreviewWindow.isDestroyed(),
    );
    logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip overlay requested", {
      clipId: clip.id,
      kind: clip.kind,
      reusedWindow,
      status: clip.status,
      wasRequested,
    });
    if (!this.clipPreviewWindow || this.clipPreviewWindow.isDestroyed()) {
      await this.createWindow(bounds);
    } else {
      this.clipPreviewWindow.setBounds(bounds, false);
    }

    if (!this.clipPreviewWindow || this.clipPreviewWindow.isDestroyed()) {
      return;
    }

    try {
      await loadOverlayRenderer(
        this.clipPreviewWindow,
        createClipPreviewRoute(clip.id),
      );
      logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip renderer loaded", {
        clipId: clip.id,
        elapsedMs: Date.now() - showStartedAt,
        reusedWindow,
      });
    } catch (error) {
      if (!wasRequested) {
        this.closeWindow("hide-requested");
      }
      throw error;
    }

    if (!this.clipPreviewWindow || this.clipPreviewWindow.isDestroyed()) {
      return;
    }

    this.clipPreviewOverlayRequested = true;
    this.coordinator.showOrHideGameOverlayWindow(this.clipPreviewWindow);
    logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip overlay presented", {
      canShowGameOverlays: this.coordinator.canShowGameOverlays(),
      clipId: clip.id,
      elapsedMs: Date.now() - showStartedAt,
    });
    if (!wasRequested && this.coordinator.canShowGameOverlays()) {
      logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip overlay opened", {
        clipId: clip.id,
        kind: clip.kind,
      });
    }
  }

  hide(): boolean {
    return this.closeWindow("hide-requested");
  }

  isRequested(): boolean {
    return this.clipPreviewOverlayRequested;
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

  setContentProtectionEnabled(enabled: boolean): void {
    applyGameOverlayContentProtection(this.clipPreviewWindow, enabled);
  }

  destroy(): void {
    this.closeWindow("destroy");
  }

  private async createWindow(bounds: Electron.Rectangle): Promise<void> {
    const contentProtection = this.getContentProtectionEnabled();
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
      webPreferences: {
        ...createOverlayWebPreferences(),
        backgroundThrottling: false,
      },
    });

    const clipPreviewWindow = this.clipPreviewWindow;
    const clipPreviewWebContents = clipPreviewWindow.webContents;
    registerIpcWindowRole(
      clipPreviewWebContents,
      WindowName.ClipPreviewOverlay,
    );
    configureGameOverlayWindow(clipPreviewWindow, {
      contentProtection,
    });
    logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip window created", {
      contentProtection,
      height: bounds.height,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    });
    clipPreviewWindow.on("focus", () => {
      logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip window focus changed", {
        focused: true,
      });
      this.coordinator.setOverlayFocusActive(
        CLIP_PREVIEW_OVERLAY_FOCUS_ID,
        true,
      );
    });
    clipPreviewWindow.on("blur", () => {
      logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip window focus changed", {
        focused: false,
      });
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
        logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip overlay closed", {
          reason: "window-closed",
        });
        this.clipPreviewOverlayRequested = false;
        this.clipPreviewWindow = null;
        this.onClosed();
      }
    });
  }

  private closeWindow(reason: ClipPreviewOverlayCloseReason): boolean {
    const window = this.clipPreviewWindow;
    const hadOpenWindow = Boolean(window && !window.isDestroyed());
    const wasRequested = this.clipPreviewOverlayRequested;
    const didCloseRequestedWindow =
      Boolean(window && !window.isDestroyed()) && wasRequested;
    this.clipPreviewOverlayRequested = false;
    this.clipPreviewWindow = null;
    this.coordinator.setOverlayFocusActive(
      CLIP_PREVIEW_OVERLAY_FOCUS_ID,
      false,
    );
    if (didCloseRequestedWindow) {
      logInfo(CLIP_PREVIEW_OVERLAY_SCOPE, "Replay clip overlay closed", {
        reason,
      });
    }
    closeOverlayWindow(window);
    if (hadOpenWindow) {
      this.onClosed();
    }

    return didCloseRequestedWindow;
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
