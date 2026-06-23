import { AuraManagerOverlaysService } from "~/main/modules/aura-manager-overlays";
import { DeathClipsOverlayService } from "~/main/modules/death-clips-overlay";
import { GridLinesOverlayService } from "~/main/modules/grid-lines-overlay";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManualClipsOverlayService } from "~/main/modules/manual-clips-overlay";
import { ProfilesService } from "~/main/modules/profiles";
import { RecordingControlsOverlayService } from "~/main/modules/recording-controls-overlay";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { logInfo } from "~/main/utils/app-log";
import {
  assertObject,
  assertOptionalBoolean,
  assertString,
  handleValidationError,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import type { Profile, ReplayClip } from "~/types";
import { GameOverlayCoordinator } from "./GameOverlayCoordinator";
import { OverlayWindowsChannel } from "./OverlayWindows.channels";
import type {
  CropRegionSelection,
  RecorderOverlayMode,
  ShowAuraOverlayOptions,
} from "./OverlayWindows.dto";

const OVERLAY_WINDOWS_SCOPE = "overlay-windows";
const ACTIVE_GAME_FOCUS_HANDOFF_ID = "active-game-focus-handoff";
const ACTIVE_GAME_FOCUS_HANDOFF_GRACE_MS = 2_500;

type ActiveGameFocusRestoreReason = "aura-locked" | "clip-preview-hidden";
type ActiveGameFocusHandoffEndReason =
  | "destroy"
  | "game-focused"
  | "game-stopped"
  | "grace-expired"
  | "restart"
  | "system-suspend";

class OverlayWindowsService {
  private static instance: OverlayWindowsService | null = null;

  private overlayCaptureProtectionEnabled = false;
  private readonly getOverlayCaptureProtectionEnabled = () =>
    this.overlayCaptureProtectionEnabled;
  private settingsChangeUnsubscribe: (() => void) | null = null;
  private readonly coordinator = new GameOverlayCoordinator();
  private readonly recordingControlsOverlay =
    new RecordingControlsOverlayService(
      this.coordinator,
      this.getOverlayCaptureProtectionEnabled,
    );
  private readonly deathClipsOverlay = new DeathClipsOverlayService(
    this.coordinator,
    () => this.recordingControlsOverlay.createAnchorBounds(),
    this.getOverlayCaptureProtectionEnabled,
  );
  private readonly manualClipsOverlay = new ManualClipsOverlayService(
    this.deathClipsOverlay,
  );
  private readonly gridLinesOverlay = new GridLinesOverlayService(
    this.coordinator,
    this.getOverlayCaptureProtectionEnabled,
  );
  private readonly auraManagerOverlays = new AuraManagerOverlaysService(
    this.coordinator,
    this.getOverlayCaptureProtectionEnabled,
  );
  private gameRunningActive = false;
  private persistentAuraOverlayRequested = false;
  private activeGameFocusHandoffTimer: NodeJS.Timeout | null = null;

  static getInstance(): OverlayWindowsService {
    if (!OverlayWindowsService.instance) {
      OverlayWindowsService.instance = new OverlayWindowsService();
    }

    return OverlayWindowsService.instance;
  }

  constructor() {
    const settingsStore = SettingsStoreService.getInstance();
    this.setOverlayCaptureProtectionEnabled(
      settingsStore.get().recordingHideOverlaysFromCapture === true,
    );
    this.settingsChangeUnsubscribe = settingsStore.onDidChange((settings) => {
      this.setOverlayCaptureProtectionEnabled(
        settings.recordingHideOverlaysFromCapture === true,
      );
    });
    this.setupHandlers();
  }

  showRecorderOverlay(): Promise<void> {
    return this.recordingControlsOverlay.show();
  }

  hideRecorderOverlay(): void {
    this.recordingControlsOverlay.hide();
  }

  toggleRecorderOverlay(): Promise<void> {
    return this.recordingControlsOverlay.toggle();
  }

  isRecorderOverlayVisible(): boolean {
    return this.recordingControlsOverlay.isVisible();
  }

  getRecorderOverlayMode(): RecorderOverlayMode {
    return this.recordingControlsOverlay.getMode();
  }

  setRecorderOverlayMode(mode: RecorderOverlayMode): RecorderOverlayMode {
    return this.recordingControlsOverlay.setMode(mode);
  }

  setPoeFocusActive(active: boolean): void {
    if (active) {
      this.endActiveGameFocusHandoff("game-focused");
    }
    this.coordinator.setPoeFocusActive(active);
  }

  setGameRunningActive(active: boolean): void {
    const wasActive = this.gameRunningActive;
    this.gameRunningActive = active;
    this.coordinator.setGameRunningActive(active);
    this.auraManagerOverlays.setGameRunningActive(active);
    if (!active) {
      this.endActiveGameFocusHandoff("game-stopped");
    }

    if (active && !wasActive) {
      logInfo(OVERLAY_WINDOWS_SCOPE, "Active game focus assumed from running", {
        active,
      });
      this.setPoeFocusActive(true);
    }

    if (active && !wasActive && !this.persistentAuraOverlayRequested) {
      this.requestPersistentAuraOverlay();
    }
  }

  showClipPreviewOverlay(clip: ReplayClip): Promise<void> {
    return this.showDeathClipPreviewOverlay(clip);
  }

  showDeathClipPreviewOverlay(clip: ReplayClip): Promise<void> {
    return this.deathClipsOverlay.showClip(clip);
  }

  showManualClipPreviewOverlay(clip: ReplayClip): Promise<void> {
    return this.manualClipsOverlay.showClip(clip);
  }

  hideClipPreviewOverlay(): void {
    if (this.deathClipsOverlay.hide()) {
      this.startActiveGameFocusHandoff("clip-preview-hidden");
    }
  }

  showAuraOverlay(
    profileId?: string,
    options?: ShowAuraOverlayOptions,
  ): Promise<void> {
    this.persistentAuraOverlayRequested = true;
    return options === undefined
      ? this.auraManagerOverlays.show(profileId)
      : this.auraManagerOverlays.show(profileId, options);
  }

  requestPersistentAuraOverlay(): boolean {
    const profile = this.resolveRenderableAuraProfile();
    if (!profile) {
      return false;
    }

    void this.showAuraOverlay(profile.id);
    return true;
  }

  isAuraOverlayLocked(): boolean {
    return this.auraManagerOverlays.isLocked();
  }

  setAuraOverlayLocked(locked: boolean): void {
    this.auraManagerOverlays.setLocked(locked);
    if (locked) {
      this.startActiveGameFocusHandoff("aura-locked");
    }
  }

  getRecorderWindow(): Electron.BrowserWindow | null {
    return this.recordingControlsOverlay.getWindow();
  }

  destroyAll(): void {
    this.settingsChangeUnsubscribe?.();
    this.settingsChangeUnsubscribe = null;
    this.endActiveGameFocusHandoff("destroy");
    this.recordingControlsOverlay.destroy();
    this.deathClipsOverlay.destroy();
    this.gridLinesOverlay.destroy();
    this.auraManagerOverlays.destroy();
  }

  suspendForSystem(): void {
    this.endActiveGameFocusHandoff("system-suspend");
    this.recordingControlsOverlay.suspendForSystem();
    this.deathClipsOverlay.destroy();
    this.gridLinesOverlay.destroy();
    this.auraManagerOverlays.suspendForSystem();
  }

  restoreRequestedOverlays(): Promise<void> {
    return this.coordinator.applyFocusGateToGameOverlays();
  }

  selectCropRegion(): Promise<CropRegionSelection | null> {
    this.auraManagerOverlays.setInputPassthrough(true);

    return this.gridLinesOverlay.selectCropRegion().finally(() => {
      this.auraManagerOverlays.setInputPassthrough(false);
    });
  }

  completeCropRegionSelection(selection: unknown): void {
    this.gridLinesOverlay.completeCropRegionSelection(selection);
  }

  cancelCropRegionSelection(): void {
    this.gridLinesOverlay.cancelCropRegionSelection();
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      OverlayWindowsChannel.ShowRecorder,
      [WindowName.Main],
      () => this.showRecorderOverlay(),
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.HideRecorder,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.hideRecorderOverlay(),
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.ToggleRecorder,
      [WindowName.Main],
      () => this.toggleRecorderOverlay(),
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.IsRecorderVisible,
      [WindowName.Main],
      () => this.isRecorderOverlayVisible(),
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.GetRecorderMode,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.getRecorderOverlayMode(),
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.SetRecorderMode,
      [WindowName.Main, WindowName.RecorderOverlay],
      (_event, mode) => {
        try {
          return this.setRecorderOverlayMode(parseRecorderOverlayMode(mode));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.HideClipPreview,
      [WindowName.Main, WindowName.ClipPreviewOverlay],
      () => this.hideClipPreviewOverlay(),
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.ShowAura,
      [WindowName.Main, WindowName.AuraOverlay, WindowName.RecorderOverlay],
      (_event, profileId, options) => {
        try {
          const normalizedProfileId = parseOptionalShowAuraProfileId(profileId);
          const parsedOptions = parseShowAuraOverlayOptions(options);

          return parsedOptions === undefined
            ? this.showAuraOverlay(normalizedProfileId)
            : this.showAuraOverlay(normalizedProfileId, parsedOptions);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.IsAuraLocked,
      [WindowName.Main, WindowName.AuraOverlay, WindowName.RecorderOverlay],
      () => this.isAuraOverlayLocked(),
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.SetAuraLocked,
      [WindowName.Main, WindowName.AuraOverlay, WindowName.RecorderOverlay],
      (_event, locked) => {
        try {
          if (typeof locked !== "boolean") {
            throw new Error("locked must be a boolean");
          }

          this.setAuraOverlayLocked(locked);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.SelectCropRegion,
      [WindowName.Main, WindowName.AuraOverlay],
      () => this.selectCropRegion(),
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.CompleteCropRegionSelection,
      [WindowName.Main, WindowName.CropSelectorOverlay],
      (_event, selection: unknown) => {
        this.completeCropRegionSelection(selection);
      },
    );
    registerGuardedIpcHandler(
      OverlayWindowsChannel.CancelCropRegionSelection,
      [WindowName.Main, WindowName.CropSelectorOverlay],
      () => {
        this.cancelCropRegionSelection();
      },
    );
  }

  private resolveRenderableAuraProfile(): Profile | null {
    return (
      ProfilesService.getInstance()
        .list()
        .find((profile) => hasRenderableAuraPlacements(profile)) ?? null
    );
  }

  private startActiveGameFocusHandoff(
    reason: ActiveGameFocusRestoreReason,
  ): void {
    if (!this.gameRunningActive) {
      return;
    }

    this.endActiveGameFocusHandoff("restart");
    const { activeGame } = SettingsStoreService.getInstance().get();
    this.coordinator.setOverlayFocusActive(ACTIVE_GAME_FOCUS_HANDOFF_ID, true);
    logInfo(OVERLAY_WINDOWS_SCOPE, "Active game focus handoff started", {
      activeGame,
      graceMs: ACTIVE_GAME_FOCUS_HANDOFF_GRACE_MS,
      reason,
    });
    this.activeGameFocusHandoffTimer = setTimeout(() => {
      this.endActiveGameFocusHandoff("grace-expired");
    }, ACTIVE_GAME_FOCUS_HANDOFF_GRACE_MS);
    this.activeGameFocusHandoffTimer.unref?.();
  }

  private endActiveGameFocusHandoff(
    reason: ActiveGameFocusHandoffEndReason,
  ): void {
    if (!this.activeGameFocusHandoffTimer) {
      return;
    }

    clearTimeout(this.activeGameFocusHandoffTimer);
    this.activeGameFocusHandoffTimer = null;
    this.coordinator.setOverlayFocusActive(ACTIVE_GAME_FOCUS_HANDOFF_ID, false);
    logInfo(OVERLAY_WINDOWS_SCOPE, "Active game focus handoff ended", {
      reason,
    });
  }

  private setOverlayCaptureProtectionEnabled(enabled: boolean): void {
    this.overlayCaptureProtectionEnabled = enabled;
    this.recordingControlsOverlay.setContentProtectionEnabled(enabled);
    this.deathClipsOverlay.setContentProtectionEnabled(enabled);
    this.gridLinesOverlay.setContentProtectionEnabled(enabled);
    this.auraManagerOverlays.setContentProtectionEnabled(enabled);
  }
}

function hasRenderableAuraPlacements(profile: Profile): boolean {
  const cropRegionIds = new Set(profile.cropRegions.map((crop) => crop.id));

  return profile.overlayPlacements.some((placement) =>
    cropRegionIds.has(placement.cropRegionId),
  );
}

function parseOptionalShowAuraProfileId(
  profileId: unknown,
): string | undefined {
  if (profileId === undefined) {
    return undefined;
  }

  assertString(profileId, "profileId", OverlayWindowsChannel.ShowAura, {
    min: 1,
    max: 128,
  });

  return profileId;
}

function parseShowAuraOverlayOptions(
  options: unknown,
): ShowAuraOverlayOptions | undefined {
  if (options === undefined) {
    return undefined;
  }

  assertObject(options, "show aura options", OverlayWindowsChannel.ShowAura);
  assertOptionalBoolean(
    options.startAddingAura,
    "startAddingAura",
    OverlayWindowsChannel.ShowAura,
  );

  return options.startAddingAura === true ? { startAddingAura: true } : {};
}

function parseRecorderOverlayMode(mode: unknown): RecorderOverlayMode {
  assertString(mode, "mode", OverlayWindowsChannel.SetRecorderMode, {
    min: 1,
    max: 16,
  });

  if (mode !== "expanded" && mode !== "minimized") {
    throw new Error("mode must be expanded or minimized");
  }

  return mode;
}

export { OverlayWindowsService };
