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
import { OverlayWindowsChannel } from "~/main/modules/overlay-windows/OverlayWindows.channels";
import type { ShowAuraOverlayOptions } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import {
  hasRenderableAuraPlacements,
  ProfilesService,
  resolveProfileForGame,
} from "~/main/modules/profiles";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { logInfo } from "~/main/utils/app-log";
import {
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import type { Profile } from "~/types";

const AURA_OVERLAY_SCOPE = "aura-manager-overlays";
const AURA_OVERLAY_FOCUS_ID = "aura-overlay";

type AuraOverlayCloseReason =
  | "clip-preview"
  | "destroy"
  | "game-not-running"
  | "game-stopped"
  | "hide-requested"
  | "no-renderable-placements"
  | "system-suspend"
  | "window-closed";

function isNavigationAbortedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("ERR_ABORTED") || error.message.includes("-3"))
  );
}

class AuraManagerOverlaysService {
  private auraWindow: BrowserWindow | null = null;
  private auraWindowProfileId: string | undefined;
  private auraOverlayRequested = false;
  private auraOverlayProfileId: string | undefined;
  private auraOverlayLocked = true;
  private gameRunningActive = false;
  private addAuraRequestId = 0;
  private inputPassthroughActive = false;
  private auraOverlayFocused = false;
  private clipPreviewSuspended = false;

  constructor(
    private readonly coordinator: GameOverlayCoordinator,
    private readonly getContentProtectionEnabled = () => false,
    private readonly onEditingActiveChange = (_active: boolean) => {},
  ) {
    this.coordinator.register(this);
  }

  async show(
    profileId?: string,
    options: ShowAuraOverlayOptions = {},
  ): Promise<void> {
    this.auraOverlayRequested = true;
    this.auraOverlayProfileId = profileId;

    if (this.clipPreviewSuspended) {
      this.closeWindow("clip-preview");
      return;
    }

    if (!this.gameRunningActive) {
      this.closeWindow("game-not-running");
      return;
    }

    const profile = this.resolveProfile(profileId);
    if (!profile) {
      this.hide();
      return;
    }

    await this.syncWindow(profile, options);
  }

  setGameRunningActive(active: boolean): void {
    if (this.gameRunningActive === active) {
      return;
    }

    this.gameRunningActive = active;
    if (!active) {
      this.closeWindow("game-stopped");
      return;
    }

    void this.restoreRequestedOverlay();
  }

  hide(): void {
    this.auraOverlayRequested = false;
    this.auraOverlayProfileId = undefined;
    this.closeWindow("hide-requested");
  }

  setLocked(locked: boolean): void {
    const previousLocked = this.auraOverlayLocked;
    this.auraOverlayLocked = locked;
    if (previousLocked !== locked) {
      logInfo(
        AURA_OVERLAY_SCOPE,
        locked ? "Aura overlay locked" : "Aura overlay unlocked",
        { locked },
      );
    }
    this.applyWindowInteractivity();
    this.publishLockState();
    this.publishEditingActiveState();
  }

  isLocked(): boolean {
    return this.auraOverlayLocked;
  }

  setInputPassthrough(active: boolean): void {
    if (this.inputPassthroughActive === active) {
      return;
    }

    this.inputPassthroughActive = active;
    this.applyWindowInteractivity();
  }

  suspendRequestedOverlay(): void {
    if (!this.auraOverlayRequested) {
      return;
    }

    this.coordinator.suspendGameOverlayWindow(this.auraWindow);
  }

  async restoreRequestedOverlay(): Promise<void> {
    if (
      this.clipPreviewSuspended ||
      !this.auraOverlayRequested ||
      !this.gameRunningActive
    ) {
      return;
    }

    const profile = this.resolveProfile(this.auraOverlayProfileId);
    if (profile) {
      await this.syncWindow(profile);
    }
  }

  suspendForSystem(): void {
    if (this.auraOverlayRequested) {
      this.closeWindow("system-suspend");
    }
  }

  setClipPreviewSuspended(suspended: boolean): void {
    if (this.clipPreviewSuspended === suspended) {
      return;
    }

    this.clipPreviewSuspended = suspended;
    if (suspended) {
      this.closeWindow("clip-preview");
    }
  }

  destroy(): void {
    this.auraOverlayRequested = false;
    this.auraOverlayProfileId = undefined;
    this.closeWindow("destroy");
  }

  setContentProtectionEnabled(enabled: boolean): void {
    applyGameOverlayContentProtection(this.auraWindow, enabled);
  }

  private async syncWindow(
    profile: Profile,
    options: ShowAuraOverlayOptions = {},
  ): Promise<void> {
    const startAddingAura = options.startAddingAura === true;
    const addAuraShape = options.addAuraShape ?? "rect";
    if (
      this.auraOverlayLocked &&
      !startAddingAura &&
      !hasRenderableAuraPlacements(profile)
    ) {
      this.closeWindow("no-renderable-placements");
      return;
    }

    const window = this.auraWindow ?? this.createWindow();
    const canDispatchAddAuraRequest =
      startAddingAura &&
      this.auraWindowProfileId === profile.id &&
      !window.isDestroyed();
    this.updateWindowBounds(window);
    const loaded = await this.loadProfile(
      window,
      profile.id,
      canDispatchAddAuraRequest ? {} : options,
    );
    if (!loaded) {
      return;
    }

    this.showOrSuspendWindow(window);
    if (canDispatchAddAuraRequest) {
      this.sendAddAuraRequest(window, addAuraShape);
    }
  }

  private createWindow(): BrowserWindow {
    const bounds = this.createWindowBounds();

    const window = new BrowserWindow({
      ...bounds,
      title: "Hinekora Aura Overlay",
      minWidth: bounds.width,
      minHeight: bounds.height,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      webPreferences: createOverlayWebPreferences(),
    });

    const auraWebContents = window.webContents;
    registerIpcWindowRole(auraWebContents, WindowName.AuraOverlay);
    configureGameOverlayWindow(window, {
      contentProtection: this.getContentProtectionEnabled(),
    });
    window.on("focus", () => {
      this.auraOverlayFocused = true;
      this.updateOverlayFocusState();
    });
    window.on("blur", () => {
      this.auraOverlayFocused = false;
      this.updateOverlayFocusState();
    });
    window.on("closed", () => {
      this.auraOverlayFocused = false;
      this.coordinator.setOverlayFocusActive(AURA_OVERLAY_FOCUS_ID, false);
      this.onEditingActiveChange(false);
      unregisterIpcWindowRole(auraWebContents);
      if (this.auraWindow === window) {
        if (this.lockClosedOverlay()) {
          this.forgetRequestedOverlay();
        }
        logInfo(AURA_OVERLAY_SCOPE, "Aura overlay closed", {
          reason: "window-closed",
        });
        this.auraWindow = null;
        this.auraWindowProfileId = undefined;
      }
    });

    this.auraWindow = window;
    this.applyWindowInteractivity();

    return window;
  }

  private createWindowBounds(): Electron.Rectangle {
    const primaryDisplay = screen.getPrimaryDisplay();

    return primaryDisplay.bounds;
  }

  private updateWindowBounds(window: BrowserWindow): void {
    const nextBounds = this.createWindowBounds();
    const currentBounds = window.getBounds();
    if (
      currentBounds.x === nextBounds.x &&
      currentBounds.y === nextBounds.y &&
      currentBounds.width === nextBounds.width &&
      currentBounds.height === nextBounds.height
    ) {
      return;
    }

    window.setBounds(nextBounds, false);
  }

  private async loadProfile(
    window: BrowserWindow,
    profileId: string,
    options: ShowAuraOverlayOptions = {},
  ): Promise<boolean> {
    const startAddingAura = options.startAddingAura === true;
    if (this.auraWindowProfileId === profileId) {
      return true;
    }

    try {
      const routeParams = new URLSearchParams({ profileId });
      if (startAddingAura) {
        routeParams.set("startAddingAura", "1");
        routeParams.set("addAuraRequestId", String(++this.addAuraRequestId));
        routeParams.set("addAuraShape", options.addAuraShape ?? "rect");
      }

      await loadOverlayRenderer(
        window,
        `#/${WindowName.AuraOverlay}?${routeParams.toString()}`,
      );
    } catch (error) {
      if (window.isDestroyed() || this.auraWindow !== window) {
        return false;
      }

      if (isNavigationAbortedError(error)) {
        return false;
      }

      throw error;
    }

    if (window.isDestroyed() || this.auraWindow !== window) {
      return false;
    }

    this.auraWindowProfileId = profileId;
    this.publishLockState();
    return true;
  }

  private sendAddAuraRequest(
    window: BrowserWindow,
    shape: ShowAuraOverlayOptions["addAuraShape"] = "rect",
  ): void {
    window.webContents.send(OverlayWindowsChannel.AuraAddRequested, {
      requestId: String(++this.addAuraRequestId),
      shape,
    });
  }

  private showOrSuspendWindow(window: BrowserWindow): void {
    if (!this.coordinator.canShowGameOverlays()) {
      this.coordinator.suspendGameOverlayWindow(window);
      return;
    }

    const wasVisible = window.isVisible();
    this.coordinator.showGameOverlayWindow(window);
    if (!wasVisible) {
      logInfo(AURA_OVERLAY_SCOPE, "Aura overlay opened");
    }
    this.publishEditingActiveState();
    this.applyWindowInteractivity();
  }

  private applyWindowInteractivity(): void {
    const window = this.auraWindow;
    if (!window || window.isDestroyed()) {
      return;
    }

    if (this.auraOverlayLocked || this.inputPassthroughActive) {
      window.setIgnoreMouseEvents(true);
      window.setFocusable(false);
      this.updateOverlayFocusState();
      return;
    }

    window.setFocusable(true);
    window.setIgnoreMouseEvents(false);
    this.updateOverlayFocusState();
  }

  private canOwnOverlayFocus(): boolean {
    return !this.auraOverlayLocked && !this.inputPassthroughActive;
  }

  private updateOverlayFocusState(): void {
    const windowFocused =
      this.auraOverlayFocused ||
      (this.auraWindow !== null &&
        !this.auraWindow.isDestroyed() &&
        this.auraWindow.isFocused());
    this.coordinator.setOverlayFocusActive(
      AURA_OVERLAY_FOCUS_ID,
      windowFocused && this.canOwnOverlayFocus(),
    );
  }

  private publishLockState(): void {
    const windows = new Set(BrowserWindow.getAllWindows());
    if (this.auraWindow) {
      windows.add(this.auraWindow);
    }

    for (const window of windows) {
      if (window.isDestroyed()) {
        continue;
      }

      window.webContents.send(
        OverlayWindowsChannel.AuraLockChanged,
        this.auraOverlayLocked,
      );
    }
  }

  private closeWindow(reason: AuraOverlayCloseReason): void {
    const wasUnlocked = this.lockClosedOverlay();
    if (reason === "game-stopped" && wasUnlocked) {
      this.forgetRequestedOverlay();
    }

    const window = this.auraWindow;
    this.auraWindow = null;
    this.auraWindowProfileId = undefined;
    this.auraOverlayFocused = false;
    this.coordinator.setOverlayFocusActive(AURA_OVERLAY_FOCUS_ID, false);
    this.onEditingActiveChange(false);
    if (window && !window.isDestroyed()) {
      logInfo(AURA_OVERLAY_SCOPE, "Aura overlay closed", { reason });
    }
    closeOverlayWindow(window);
  }

  private lockClosedOverlay(): boolean {
    if (this.auraOverlayLocked) {
      return false;
    }

    this.setLocked(true);
    return true;
  }

  private forgetRequestedOverlay(): void {
    this.auraOverlayRequested = false;
    this.auraOverlayProfileId = undefined;
  }

  private publishEditingActiveState(): void {
    this.onEditingActiveChange(
      !!this.auraWindow &&
        !this.auraWindow.isDestroyed() &&
        !this.auraOverlayLocked,
    );
  }

  private resolveProfile(profileId?: string): Profile | null {
    return resolveProfileForGame(
      ProfilesService.getInstance().list(),
      profileId,
      SettingsStoreService.getInstance().get().activeGame,
    );
  }
}

export { AuraManagerOverlaysService };
