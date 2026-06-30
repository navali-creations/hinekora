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
import { SettingsStoreService } from "~/main/modules/settings-store";
import { logInfo, logWarn } from "~/main/utils/app-log";
import { validateBoundsOnDisplays } from "~/main/utils/display-geometry";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
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
  expanded: { width: 216, height: 200 },
  minimized: { width: 236, height: 42 },
};
const RECORDER_OVERLAY_RIGHT_MARGIN = 20;
const RECORDER_OVERLAY_TOP_MARGIN = 24;
const RECORDER_OVERLAY_BOUNDS_MIN_OVERLAP = 20;
const RECORDER_OVERLAY_BOUNDS_SAVE_DEBOUNCE_MS = 500;
const RECORDER_OVERLAY_LOG_SCOPE = "recording-controls-overlay";

type RecorderOverlayCloseReason =
  | "destroy"
  | "system-suspend"
  | "window-closed";
type RecorderOverlayHiddenReason =
  | "focus-gate"
  | "hide-requested"
  | "overlay-suppressed";
type RecorderOverlayShownReason = "focus-gate-restored" | "request";
interface RecorderOverlayBoundsListeners {
  movedHandler: () => void;
  resizedHandler: () => void;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

class RecordingControlsOverlayService {
  private recorderWindow: BrowserWindow | null = null;
  private recorderOverlayRequested = false;
  private recorderOverlaySuspended = false;
  private preserveRequestOnClose = false;
  private recorderOverlayMode: RecorderOverlayMode = "expanded";
  private readonly boundsListenersByWindow = new WeakMap<
    BrowserWindow,
    RecorderOverlayBoundsListeners
  >();
  private readonly boundsSavedForClosingWindows = new WeakSet<BrowserWindow>();

  constructor(
    private readonly coordinator: GameOverlayCoordinator,
    private readonly getContentProtectionEnabled = () => false,
    private readonly canShowRecorderOverlay = () => true,
  ) {
    this.coordinator.register(this);
  }

  async show(): Promise<void> {
    const wasVisible = this.isVisible();
    this.recorderOverlayRequested = true;
    const recorderWindow =
      !this.recorderWindow || this.recorderWindow.isDestroyed()
        ? await this.createWindow()
        : this.recorderWindow;

    this.showOrSuspendWindow(recorderWindow, "request");
    this.publishVisibilityChangedIfNeeded(wasVisible);
  }

  hide(): void {
    const wasVisible = this.isVisible();
    this.recorderOverlayRequested = false;
    this.recorderOverlaySuspended = false;
    this.saveRecorderOverlayBoundsImmediate();
    this.coordinator.hideGameOverlayWindow(this.recorderWindow);
    if (wasVisible) {
      this.logHidden("hide-requested");
    }
    this.publishVisibilityChangedIfNeeded(wasVisible);
  }

  async toggle(): Promise<void> {
    if (this.isVisible()) {
      this.hide();
      return;
    }

    await this.show();
  }

  isVisible(): boolean {
    return (
      this.recorderOverlayRequested &&
      !this.recorderOverlaySuspended &&
      !!this.recorderWindow &&
      !this.recorderWindow.isDestroyed() &&
      this.recorderWindow.isVisible()
    );
  }

  isRequested(): boolean {
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

    return this.createInitialBounds(this.recorderOverlayMode);
  }

  setContentProtectionEnabled(enabled: boolean): void {
    applyGameOverlayContentProtection(this.recorderWindow, enabled);
  }

  private createInitialBounds(mode: RecorderOverlayMode): Electron.Rectangle {
    const restoredBounds = this.getRestoredRecorderOverlayBounds(mode);

    return restoredBounds ?? this.createDefaultBounds(mode);
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

  private getRestoredRecorderOverlayBounds(
    mode: RecorderOverlayMode,
  ): Electron.Rectangle | null {
    try {
      const restoredBounds = validateBoundsOnDisplays(
        SettingsStoreService.getInstance().get().recorderOverlayBounds,
        screen.getAllDisplays(),
        RECORDER_OVERLAY_BOUNDS_MIN_OVERLAP,
      );
      if (!restoredBounds) {
        return null;
      }

      return this.createModeBoundsFromAnchor(restoredBounds, mode);
    } catch (error) {
      logWarn(
        RECORDER_OVERLAY_LOG_SCOPE,
        "Failed to restore recorder overlay bounds",
        {
          error: safeErrorMessage(error),
        },
      );
      return null;
    }
  }

  suspendRequestedOverlay(
    reason: RecorderOverlayHiddenReason = "focus-gate",
  ): void {
    if (this.recorderOverlayRequested) {
      const wasVisible = this.isVisible();
      const nativeWasVisible = this.recorderWindow?.isVisible() ?? false;
      this.coordinator.suspendGameOverlayWindow(this.recorderWindow);
      if (nativeWasVisible && !this.recorderOverlaySuspended) {
        this.logHidden(reason);
      }
      this.recorderOverlaySuspended =
        nativeWasVisible || this.recorderOverlaySuspended;
      this.publishVisibilityChangedIfNeeded(wasVisible);
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

    this.closeWindow({ preserveRequest: true, reason: "system-suspend" });
  }

  destroy(): void {
    this.preserveRequestOnClose = false;
    this.closeWindow({ preserveRequest: false, reason: "destroy" });
  }

  private async createWindow(): Promise<BrowserWindow> {
    const anchorBounds = this.createInitialBounds(this.recorderOverlayMode);

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
    this.attachBoundsListeners(recorderWindow);
    recorderWindow.on("close", () => {
      this.saveRecorderOverlayBoundsForClose(recorderWindow);
    });
    recorderWindow.on("closed", () => {
      this.removeBoundsListeners(recorderWindow);
      unregisterIpcWindowRole(recorderWebContents);
      const preserveRequest = this.preserveRequestOnClose;
      this.preserveRequestOnClose = false;
      const wasVisible = this.isVisible();
      if (!preserveRequest) {
        this.recorderOverlayRequested = false;
        this.recorderOverlaySuspended = false;
      }
      if (this.recorderWindow === recorderWindow) {
        logInfo(RECORDER_OVERLAY_LOG_SCOPE, "Recorder overlay closed", {
          mode: this.recorderOverlayMode,
          reason: "window-closed",
        });
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

    return recorderWindow;
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

  private publishVisibilityChangedIfNeeded(wasVisible: boolean): void {
    const isVisible = this.isVisible();
    if (wasVisible !== isVisible) {
      this.publishVisibilityChanged(isVisible);
    }
  }

  private applyModeBounds(): void {
    const window = this.recorderWindow;
    if (!window || window.isDestroyed()) {
      return;
    }

    const currentBounds = window.getBounds();
    const nextBounds = this.createModeBoundsFromAnchor(
      currentBounds,
      this.recorderOverlayMode,
    );
    window.setBounds(nextBounds);
    this.saveRecorderOverlayBoundsImmediate(window);
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

  private createModeBoundsFromAnchor(
    currentBounds: Electron.Rectangle,
    mode: RecorderOverlayMode,
  ): Electron.Rectangle {
    const nextBounds = RECORDER_OVERLAY_BOUNDS[mode];

    return {
      ...currentBounds,
      ...nextBounds,
      x: currentBounds.x + currentBounds.width - nextBounds.width,
    };
  }

  private showOrSuspendWindow(
    window: BrowserWindow,
    reason: RecorderOverlayShownReason,
  ): void {
    const recorderAllowed = this.canShowRecorderOverlay();
    if (!recorderAllowed || !this.coordinator.canShowGameOverlays()) {
      const wasVisible = window.isVisible();
      this.coordinator.suspendGameOverlayWindow(window);
      if (wasVisible && !this.recorderOverlaySuspended) {
        this.logHidden(recorderAllowed ? "focus-gate" : "overlay-suppressed");
      }
      this.recorderOverlaySuspended =
        wasVisible || this.recorderOverlaySuspended;
      return;
    }

    const wasVisible = window.isVisible();
    const wasSuspended = this.recorderOverlaySuspended;
    this.coordinator.showGameOverlayWindow(window);
    this.recorderOverlaySuspended = false;
    if (!wasVisible || wasSuspended) {
      this.logShown(wasSuspended ? "focus-gate-restored" : reason);
    }
  }

  private attachBoundsListeners(recorderWindow: BrowserWindow): void {
    const listeners: RecorderOverlayBoundsListeners = {
      movedHandler: () => debouncedSaveBounds(),
      resizedHandler: () => debouncedSaveBounds(),
      saveTimer: null,
    };

    const debouncedSaveBounds = () => {
      if (listeners.saveTimer) {
        clearTimeout(listeners.saveTimer);
      }

      listeners.saveTimer = setTimeout(() => {
        this.saveRecorderOverlayBoundsImmediate(recorderWindow);
        listeners.saveTimer = null;
      }, RECORDER_OVERLAY_BOUNDS_SAVE_DEBOUNCE_MS);
    };

    this.boundsListenersByWindow.set(recorderWindow, listeners);
    recorderWindow.on("moved", listeners.movedHandler);
    recorderWindow.on("resized", listeners.resizedHandler);
  }

  private removeBoundsListeners(recorderWindow: BrowserWindow | null): void {
    if (!recorderWindow) {
      return;
    }

    const listeners = this.boundsListenersByWindow.get(recorderWindow);
    if (!listeners) {
      return;
    }

    if (listeners.saveTimer) {
      clearTimeout(listeners.saveTimer);
      listeners.saveTimer = null;
    }

    if (!recorderWindow.isDestroyed()) {
      recorderWindow.removeListener("moved", listeners.movedHandler);
      recorderWindow.removeListener("resized", listeners.resizedHandler);
    }

    this.boundsListenersByWindow.delete(recorderWindow);
  }

  private saveRecorderOverlayBoundsImmediate(
    recorderWindow: BrowserWindow | null = this.recorderWindow,
  ): void {
    if (!recorderWindow || recorderWindow.isDestroyed()) {
      return;
    }

    try {
      SettingsStoreService.getInstance().update({
        recorderOverlayBounds: recorderWindow.getBounds(),
      });
    } catch (error) {
      logWarn(
        RECORDER_OVERLAY_LOG_SCOPE,
        "Failed to save recorder overlay bounds",
        {
          error: safeErrorMessage(error),
        },
      );
    }
  }

  private saveRecorderOverlayBoundsForClose(
    recorderWindow: BrowserWindow | null,
  ): void {
    if (
      !recorderWindow ||
      this.boundsSavedForClosingWindows.has(recorderWindow)
    ) {
      return;
    }

    this.boundsSavedForClosingWindows.add(recorderWindow);
    this.saveRecorderOverlayBoundsImmediate(recorderWindow);
  }

  private logShown(reason: RecorderOverlayShownReason): void {
    logInfo(RECORDER_OVERLAY_LOG_SCOPE, "Recorder overlay shown", {
      mode: this.recorderOverlayMode,
      reason,
    });
  }

  private logHidden(reason: RecorderOverlayHiddenReason): void {
    logInfo(RECORDER_OVERLAY_LOG_SCOPE, "Recorder overlay hidden", {
      mode: this.recorderOverlayMode,
      reason,
    });
  }

  private closeWindow(input: {
    preserveRequest: boolean;
    reason: RecorderOverlayCloseReason;
  }): void {
    const wasVisible = this.isVisible();
    const window = this.recorderWindow;
    this.recorderWindow = null;
    this.recorderOverlaySuspended = false;
    if (!input.preserveRequest) {
      this.recorderOverlayRequested = false;
    }
    this.saveRecorderOverlayBoundsForClose(window);
    this.removeBoundsListeners(window);
    if (input.preserveRequest && window && !window.isDestroyed()) {
      this.preserveRequestOnClose = true;
    }

    if (window && !window.isDestroyed()) {
      logInfo(RECORDER_OVERLAY_LOG_SCOPE, "Recorder overlay closed", {
        mode: this.recorderOverlayMode,
        reason: input.reason,
      });
    }
    closeOverlayWindow(window);
    this.publishVisibilityChangedIfNeeded(wasVisible);
  }
}

export { RecordingControlsOverlayService };
