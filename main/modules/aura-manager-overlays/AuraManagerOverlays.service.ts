import { BrowserWindow, screen } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import type { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import {
  closeOverlayWindow,
  configureGameOverlayWindow,
  createOverlayWebPreferences,
  loadOverlayRenderer,
} from "~/main/modules/overlay-windows/OverlayWindow.shared";
import { OverlayWindowsChannel } from "~/main/modules/overlay-windows/OverlayWindows.channels";
import type { ShowAuraOverlayOptions } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import { ProfilesService } from "~/main/modules/profiles";
import { logInfo } from "~/main/utils/app-log";
import {
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import type { OverlayPlacement, Profile } from "~/types";

const AURA_OVERLAY_SCOPE = "aura-manager-overlays";

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

  constructor(private readonly coordinator: GameOverlayCoordinator) {
    this.coordinator.register(this);
  }

  async show(
    profileId?: string,
    options: ShowAuraOverlayOptions = {},
  ): Promise<void> {
    this.auraOverlayRequested = true;
    this.auraOverlayProfileId = profileId;

    if (!this.gameRunningActive) {
      this.closeWindow();
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
      this.closeWindow();
      return;
    }

    void this.restoreRequestedOverlay();
  }

  previewPlacement(_profileId: string, _placement: OverlayPlacement): void {
    // Aura previews are rendered in a single full-display overlay now, so
    // placement-window bound previews are no longer needed.
  }

  hide(): void {
    this.auraOverlayRequested = false;
    this.auraOverlayProfileId = undefined;
    this.closeWindow();
  }

  setLocked(locked: boolean): void {
    this.auraOverlayLocked = locked;
    this.applyWindowInteractivity();
    this.publishLockState();
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
    if (!this.auraOverlayRequested || !this.gameRunningActive) {
      return;
    }

    const profile = this.resolveProfile(this.auraOverlayProfileId);
    if (profile) {
      await this.syncWindow(profile);
    }
  }

  suspendForSystem(): void {
    if (this.auraOverlayRequested) {
      this.closeWindow();
    }
  }

  destroy(): void {
    this.auraOverlayRequested = false;
    this.auraOverlayProfileId = undefined;
    this.closeWindow();
  }

  private async syncWindow(
    profile: Profile,
    options: ShowAuraOverlayOptions = {},
  ): Promise<void> {
    if (this.auraOverlayLocked && !this.hasRenderableAuraPlacements(profile)) {
      this.closeWindow();
      return;
    }

    const window = this.auraWindow ?? this.createWindow();
    this.updateWindowBounds(window);
    const loaded = await this.loadProfile(window, profile.id, options);
    if (!loaded) {
      return;
    }

    this.showOrSuspendWindow(window);
  }

  private hasRenderableAuraPlacements(profile: Profile): boolean {
    const cropRegionIds = new Set(profile.cropRegions.map((crop) => crop.id));

    return profile.overlayPlacements.some((placement) =>
      cropRegionIds.has(placement.cropRegionId),
    );
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
    configureGameOverlayWindow(window);
    window.on("closed", () => {
      unregisterIpcWindowRole(auraWebContents);
      logInfo(AURA_OVERLAY_SCOPE, "Aura overlay closed");
      if (this.auraWindow === window) {
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
    if (this.auraWindowProfileId === profileId && !startAddingAura) {
      return true;
    }

    try {
      const routeParams = new URLSearchParams({ profileId });
      if (startAddingAura) {
        routeParams.set("startAddingAura", "1");
        routeParams.set("addAuraRequestId", String(++this.addAuraRequestId));
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

  private showOrSuspendWindow(window: BrowserWindow): void {
    if (!this.coordinator.canShowGameOverlays()) {
      this.coordinator.suspendGameOverlayWindow(window);
      return;
    }

    this.coordinator.showGameOverlayWindow(window);
    logInfo(AURA_OVERLAY_SCOPE, "Aura overlay opened");
    this.applyWindowInteractivity();
  }

  private applyWindowInteractivity(): void {
    const window = this.auraWindow;
    if (!window || window.isDestroyed()) {
      return;
    }

    if (this.auraOverlayLocked || this.inputPassthroughActive) {
      window.setIgnoreMouseEvents(true);
      return;
    }

    window.setIgnoreMouseEvents(false);
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

  private closeWindow(): void {
    const window = this.auraWindow;
    this.auraWindow = null;
    this.auraWindowProfileId = undefined;
    closeOverlayWindow(window);
  }

  private resolveProfile(profileId?: string): Profile | null {
    const profiles = ProfilesService.getInstance().list();
    if (profileId) {
      return profiles.find((profile) => profile.id === profileId) ?? null;
    }

    return profiles[0] ?? null;
  }
}

export { AuraManagerOverlaysService };
