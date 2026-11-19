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
import { logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import {
  registerGuardedIpcHandler,
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { ReplayStatusOverlayChannel } from "./ReplayStatusOverlay.channels";
import type {
  ReplayStatusOverlayActiveStatus,
  ReplayStatusOverlayEvent,
  ReplayStatusOverlayFinalStatus,
} from "./ReplayStatusOverlay.dto";

const REPLAY_STATUS_OVERLAY_WIDTH = 420;
const REPLAY_STATUS_OVERLAY_HEIGHT = 260;
const REPLAY_STATUS_MINIMUM_ACTIVE_MS = 600;
const REPLAY_STATUS_SAVED_HOLD_MS = 3_000;
const REPLAY_STATUS_DISMISS_ANIMATION_MS = 420;
const REPLAY_STATUS_OVERLAY_SCOPE = "replay-status-overlay";

class ReplayStatusOverlayService {
  private activeStatus: ReplayStatusOverlayActiveStatus = "processing";
  private clipId: string | null = null;
  private dismissing = false;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private finalPublishTimer: ReturnType<typeof setTimeout> | null = null;
  private finalPublished = false;
  private finalStatus: ReplayStatusOverlayFinalStatus | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private statusPublishedAt: number | null = null;
  private requested = false;
  private window: BrowserWindow | null = null;
  private windowLoadPromise: Promise<void> | null = null;
  private windowLoaded = false;

  constructor(
    private readonly coordinator: GameOverlayCoordinator,
    private readonly createAnchorBounds: () => Electron.Rectangle,
    private readonly getContentProtectionEnabled = () => false,
  ) {
    this.coordinator.register(this);
    registerGuardedIpcHandler(
      ReplayStatusOverlayChannel.GetSnapshot,
      [WindowName.ReplayStatusOverlay],
      (event) =>
        event.sender === this.window?.webContents ? this.getSnapshot() : null,
    );
  }

  getSnapshot(): ReplayStatusOverlayEvent | null {
    if (
      !this.requested ||
      !this.clipId ||
      !this.window ||
      this.window.isDestroyed()
    ) {
      return null;
    }

    return {
      clipId: this.clipId,
      dismissing: this.dismissing,
      status:
        this.finalPublished && this.finalStatus
          ? this.finalStatus
          : this.activeStatus,
    };
  }

  showSaving(clipId: string): Promise<void> {
    return this.showStatus(clipId, "saving");
  }

  showProcessing(clipId: string): Promise<void> {
    return this.showStatus(clipId, "processing");
  }

  private async showStatus(
    clipId: string,
    status: ReplayStatusOverlayActiveStatus,
  ): Promise<void> {
    if (this.requested && this.clipId === clipId) {
      if (
        this.activeStatus === "saving" &&
        status === "processing" &&
        !this.finalStatus
      ) {
        this.activeStatus = status;
        this.setContentProtectionEnabled(this.getContentProtectionEnabled());
        this.publishActiveStatus();
      }
      return;
    }

    this.clearTimers();
    this.activeStatus = status;
    this.clipId = clipId;
    this.dismissing = false;
    this.finalPublished = false;
    this.finalStatus = null;
    this.statusPublishedAt = null;
    this.requested = true;

    const notificationWindow = this.getOrCreateWindow(clipId);
    this.setContentProtectionEnabled(this.getContentProtectionEnabled());

    try {
      await this.ensureWindowLoaded(notificationWindow);
    } catch (error) {
      if (this.window === notificationWindow && this.clipId === clipId) {
        logWarn(REPLAY_STATUS_OVERLAY_SCOPE, "Could not load replay status", {
          error: safeErrorMessage(error),
        });
        this.disposeWindow(notificationWindow);
      }
      return;
    }

    if (
      this.window !== notificationWindow ||
      notificationWindow.isDestroyed() ||
      !this.requested ||
      this.clipId !== clipId
    ) {
      return;
    }

    this.publishActiveStatus();
    this.showOrSuspendWindow(notificationWindow);
  }

  finish(clipId: string, status: ReplayStatusOverlayFinalStatus): void {
    if (!this.requested || this.clipId !== clipId || this.finalStatus) {
      return;
    }

    this.finalStatus = status;
    this.scheduleFinalStatusIfReady();
  }

  hide(clipId: string): void {
    if (this.clipId === clipId) {
      this.hideCurrentRequest();
    }
  }

  setContentProtectionEnabled(enabled: boolean): void {
    // Saving is shown before OBS finishes the clip, so it must stay excluded.
    applyGameOverlayContentProtection(
      this.window,
      enabled || this.activeStatus === "saving",
    );
  }

  suspendRequestedOverlay(): void {
    if (this.requested) {
      this.coordinator.suspendGameOverlayWindow(this.window);
    }
  }

  restoreRequestedOverlay(): void {
    if (this.requested && this.windowLoaded && this.window) {
      this.showOrSuspendWindow(this.window);
    }
  }

  destroy(): void {
    const notificationWindow = this.window;
    this.clearTimers();
    this.resetRequestState();
    this.window = null;
    this.windowLoaded = false;
    this.windowLoadPromise = null;
    closeOverlayWindow(notificationWindow);
  }

  private getOrCreateWindow(clipId: string): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setBounds(this.createWindowBounds(), false);
      return this.window;
    }

    const notificationWindow = new BrowserWindow({
      ...this.createWindowBounds(),
      alwaysOnTop: true,
      backgroundColor: "#00000000",
      focusable: false,
      frame: false,
      hasShadow: false,
      resizable: false,
      show: false,
      skipTaskbar: true,
      transparent: true,
      webPreferences: createOverlayWebPreferences(
        WindowName.ReplayStatusOverlay,
      ),
    });
    const webContents = notificationWindow.webContents;
    this.window = notificationWindow;
    this.windowLoaded = false;
    registerIpcWindowRole(webContents, WindowName.ReplayStatusOverlay);
    configureGameOverlayWindow(notificationWindow, {
      contentProtection:
        this.activeStatus === "saving" || this.getContentProtectionEnabled(),
    });
    this.windowLoadPromise = loadOverlayRenderer(
      notificationWindow,
      `#/${WindowName.ReplayStatusOverlay}?clipId=${encodeURIComponent(clipId)}`,
    ).then(() => {
      if (
        this.window === notificationWindow &&
        !notificationWindow.isDestroyed()
      ) {
        this.windowLoaded = true;
      }
    });

    notificationWindow.setIgnoreMouseEvents(true);
    notificationWindow.on("closed", () => {
      unregisterIpcWindowRole(webContents);
      if (this.window === notificationWindow) {
        this.clearTimers();
        this.resetRequestState();
        this.window = null;
        this.windowLoaded = false;
        this.windowLoadPromise = null;
      }
    });

    return notificationWindow;
  }

  private async ensureWindowLoaded(
    notificationWindow: BrowserWindow,
  ): Promise<void> {
    if (this.windowLoaded) {
      return;
    }

    await this.windowLoadPromise;
    if (this.window === notificationWindow) {
      this.windowLoadPromise = null;
    }
  }

  private createWindowBounds(): Electron.Rectangle {
    const display = screen.getDisplayMatching(this.createAnchorBounds());
    const width = Math.min(REPLAY_STATUS_OVERLAY_WIDTH, display.workArea.width);
    const height = Math.min(
      REPLAY_STATUS_OVERLAY_HEIGHT,
      display.workArea.height,
    );

    return {
      height,
      width,
      x: display.workArea.x + Math.round((display.workArea.width - width) / 2),
      y: display.workArea.y,
    };
  }

  private showOrSuspendWindow(notificationWindow: BrowserWindow): void {
    if (!this.coordinator.canShowGameOverlays(this)) {
      this.coordinator.suspendGameOverlayWindow(notificationWindow);
      return;
    }

    this.coordinator.showGameOverlayWindow(notificationWindow);
    notificationWindow.setIgnoreMouseEvents(true);
  }

  private scheduleFinalStatusIfReady(): void {
    if (
      !this.windowLoaded ||
      !this.finalStatus ||
      this.statusPublishedAt === null ||
      this.finalPublishTimer ||
      this.finalPublished
    ) {
      return;
    }

    const remainingActiveMs = Math.max(
      0,
      REPLAY_STATUS_MINIMUM_ACTIVE_MS - (Date.now() - this.statusPublishedAt),
    );
    const finalStatus = this.finalStatus;
    this.finalPublishTimer = setTimeout(() => {
      this.finalPublishTimer = null;
      this.finalPublished = true;
      this.publishStatus(finalStatus, false);
      this.scheduleDismissal(finalStatus);
    }, remainingActiveMs);
    this.finalPublishTimer.unref?.();
  }

  private scheduleDismissal(status: ReplayStatusOverlayFinalStatus): void {
    this.dismissTimer = setTimeout(() => {
      this.dismissTimer = null;
      this.publishStatus(status, true);
    }, REPLAY_STATUS_SAVED_HOLD_MS);
    this.dismissTimer.unref?.();

    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hideCurrentRequest();
    }, REPLAY_STATUS_SAVED_HOLD_MS + REPLAY_STATUS_DISMISS_ANIMATION_MS);
    this.hideTimer.unref?.();
  }

  private publishActiveStatus(): void {
    if (!this.windowLoaded) {
      return;
    }

    this.statusPublishedAt = Date.now();
    this.publishStatus(this.activeStatus, false);
    this.scheduleFinalStatusIfReady();
  }

  private publishStatus(
    status: ReplayStatusOverlayEvent["status"],
    dismissing: boolean,
  ): void {
    this.dismissing = dismissing;
    if (
      !this.clipId ||
      !this.window ||
      this.window.isDestroyed() ||
      !this.windowLoaded
    ) {
      return;
    }

    const event: ReplayStatusOverlayEvent = {
      clipId: this.clipId,
      dismissing,
      status,
    };
    this.window.webContents.send(
      ReplayStatusOverlayChannel.StatusChanged,
      event,
    );
  }

  private clearTimers(): void {
    for (const timer of [
      this.dismissTimer,
      this.finalPublishTimer,
      this.hideTimer,
    ]) {
      if (timer) {
        clearTimeout(timer);
      }
    }
    this.dismissTimer = null;
    this.finalPublishTimer = null;
    this.hideTimer = null;
  }

  private hideCurrentRequest(): void {
    const notificationWindow = this.window;
    this.clearTimers();
    this.resetRequestState();
    this.coordinator.hideGameOverlayWindow(notificationWindow);
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      notificationWindow.setIgnoreMouseEvents(true);
    }
  }

  private resetRequestState(): void {
    this.activeStatus = "processing";
    this.clipId = null;
    this.dismissing = false;
    this.finalPublished = false;
    this.finalStatus = null;
    this.statusPublishedAt = null;
    this.requested = false;
  }

  private disposeWindow(notificationWindow: BrowserWindow): void {
    this.clearTimers();
    this.resetRequestState();
    this.window = null;
    this.windowLoaded = false;
    this.windowLoadPromise = null;
    closeOverlayWindow(notificationWindow);
  }
}

export { ReplayStatusOverlayService };
