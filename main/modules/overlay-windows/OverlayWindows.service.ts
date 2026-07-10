import { AuraManagerOverlaysService } from "~/main/modules/aura-manager-overlays";
import { DeathClipsOverlayService } from "~/main/modules/death-clips-overlay";
import { GridLinesOverlayService } from "~/main/modules/grid-lines-overlay";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import {
  type ManagedRecorderChangeSnapshot,
  ManagedRecorderService,
} from "~/main/modules/managed-recorder";
import type {
  ManagedRecorderCaptureMode,
  ManagedRecorderStatus,
} from "~/main/modules/managed-recorder/ManagedRecorder.dto";
import {
  ProfilesService,
  resolveRenderableProfileForGame,
} from "~/main/modules/profiles";
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

import type { AppSettings, ReplayClip } from "~/types";
import { GameOverlayCoordinator } from "./GameOverlayCoordinator";
import { OverlayWindowsChannel } from "./OverlayWindows.channels";
import type {
  CropRegionSelection,
  CropRegionSelectionShape,
  RecorderOverlayMode,
  SelectCropRegionOptions,
  ShowAuraOverlayOptions,
} from "./OverlayWindows.dto";

const OVERLAY_WINDOWS_SCOPE = "overlay-windows";
const ACTIVE_GAME_FOCUS_HANDOFF_ID = "active-game-focus-handoff";
const ACTIVE_GAME_FOCUS_HANDOFF_GRACE_MS = 2_500;
const RECORDER_SUPPRESSION_AURA_OVERLAY = "aura-overlay";
const RECORDER_SUPPRESSION_CROP_SELECTOR = "crop-selector";

function resolveOverlayCaptureProtectionEnabled(
  settings: Pick<
    AppSettings,
    "recordingHideOverlaysFromRecording" | "recordingHideOverlaysFromRewind"
  >,
  recorderState: {
    captureMode: ManagedRecorderCaptureMode;
    status: Pick<ManagedRecorderStatus, "bufferActive" | "runRecordingActive">;
  },
): boolean {
  const activeCaptureMode = recorderState.status.runRecordingActive
    ? "session"
    : recorderState.status.bufferActive
      ? "rewind"
      : recorderState.captureMode;

  return activeCaptureMode === "session"
    ? settings.recordingHideOverlaysFromRecording === true
    : settings.recordingHideOverlaysFromRewind === true;
}

type ActiveGameFocusRestoreReason =
  | "aura-locked"
  | "crop-selector-hidden"
  | "clip-preview-hidden"
  | "recorder-overlay-shown";
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
  private overlayCaptureProtectionSettings: Pick<
    AppSettings,
    "recordingHideOverlaysFromRecording" | "recordingHideOverlaysFromRewind"
  > = {
    recordingHideOverlaysFromRecording: true,
    recordingHideOverlaysFromRewind: true,
  };
  private recorderCaptureMode: ManagedRecorderCaptureMode = "rewind";
  private recorderStatus: Pick<
    ManagedRecorderStatus,
    "bufferActive" | "runRecordingActive"
  > = {
    bufferActive: false,
    runRecordingActive: false,
  };
  private readonly getOverlayCaptureProtectionEnabled = () =>
    this.overlayCaptureProtectionEnabled;
  private managedRecorderChangeUnsubscribe: (() => void) | null = null;
  private settingsChangeUnsubscribe: (() => void) | null = null;
  private readonly coordinator = new GameOverlayCoordinator();
  private readonly recorderOverlaySuppressionIds = new Set<string>();
  private readonly recordingControlsOverlay =
    new RecordingControlsOverlayService(
      this.coordinator,
      this.getOverlayCaptureProtectionEnabled,
      () => !this.isRecorderOverlaySuppressed(),
    );
  private readonly deathClipsOverlay = new DeathClipsOverlayService(
    this.coordinator,
    () => this.recordingControlsOverlay.createAnchorBounds(),
    this.getOverlayCaptureProtectionEnabled,
    () => this.restoreClipPreviewResources(),
  );
  private readonly gridLinesOverlay = new GridLinesOverlayService(
    this.coordinator,
    this.getOverlayCaptureProtectionEnabled,
    () => this.startActiveGameFocusHandoff("crop-selector-hidden"),
  );
  private readonly auraManagerOverlays = new AuraManagerOverlaysService(
    this.coordinator,
    this.getOverlayCaptureProtectionEnabled,
    (active) =>
      this.setRecorderOverlaySuppressed(
        RECORDER_SUPPRESSION_AURA_OVERLAY,
        active,
      ),
  );
  private gameRunningActive = false;
  private persistentAuraOverlayRequested = false;
  private clipPreviewResourcesSuspended = false;
  private clipPreviewResourceRestoreEnabled = true;
  private activeGameFocusHandoffTimer: NodeJS.Timeout | null = null;

  static getInstance(): OverlayWindowsService {
    if (!OverlayWindowsService.instance) {
      OverlayWindowsService.instance = new OverlayWindowsService();
    }

    return OverlayWindowsService.instance;
  }

  constructor() {
    const settingsStore = SettingsStoreService.getInstance();
    const managedRecorder = ManagedRecorderService.getInstance();
    this.overlayCaptureProtectionSettings = settingsStore.get();
    this.updateManagedRecorderSnapshot({
      captureMode: managedRecorder.getCaptureMode(),
      status: managedRecorder.getStatus(),
    });
    this.applyOverlayCaptureProtection();
    this.settingsChangeUnsubscribe = settingsStore.onDidChange((settings) => {
      this.overlayCaptureProtectionSettings = settings;
      this.applyOverlayCaptureProtection();
    });
    this.managedRecorderChangeUnsubscribe = managedRecorder.onDidChange(
      (snapshot) => {
        this.updateManagedRecorderSnapshot(snapshot);
        this.applyOverlayCaptureProtection();
      },
    );
    this.setupHandlers();
  }

  showRecorderOverlay(): Promise<void> {
    this.startActiveGameFocusHandoff("recorder-overlay-shown");
    return this.recordingControlsOverlay.show();
  }

  hideRecorderOverlay(): void {
    this.recordingControlsOverlay.hide();
  }

  toggleRecorderOverlay(): Promise<void> {
    if (!this.recordingControlsOverlay.isVisible()) {
      this.startActiveGameFocusHandoff("recorder-overlay-shown");
    }

    return this.recordingControlsOverlay.toggle();
  }

  isRecorderOverlayVisible(): boolean {
    return this.recordingControlsOverlay.isVisible();
  }

  isRecorderOverlayRequested(): boolean {
    return this.recordingControlsOverlay.isRequested();
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

    if (active && !wasActive && !this.persistentAuraOverlayRequested) {
      this.requestPersistentAuraOverlay();
    }
  }

  async showClipPreviewOverlay(clip: ReplayClip): Promise<void> {
    this.suspendClipPreviewResources();
    try {
      await this.deathClipsOverlay.showClip(clip);
    } catch (error) {
      this.restoreClipPreviewResources();
      throw error;
    }
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
    this.managedRecorderChangeUnsubscribe?.();
    this.managedRecorderChangeUnsubscribe = null;
    this.endActiveGameFocusHandoff("destroy");
    this.clipPreviewResourceRestoreEnabled = false;
    this.recordingControlsOverlay.destroy();
    this.deathClipsOverlay.destroy();
    this.gridLinesOverlay.destroy();
    this.auraManagerOverlays.setClipPreviewSuspended(false);
    this.auraManagerOverlays.destroy();
  }

  suspendForSystem(): void {
    this.setPoeFocusActive(false);
    this.endActiveGameFocusHandoff("system-suspend");
    this.clipPreviewResourceRestoreEnabled = false;
    this.recordingControlsOverlay.suspendForSystem();
    this.deathClipsOverlay.destroy();
    this.gridLinesOverlay.destroy();
    this.auraManagerOverlays.setClipPreviewSuspended(false);
    this.auraManagerOverlays.suspendForSystem();
    this.clipPreviewResourceRestoreEnabled = true;
  }

  restoreRequestedOverlays(): Promise<void> {
    return this.coordinator.applyFocusGateToGameOverlays();
  }

  private suspendClipPreviewResources(): void {
    if (this.clipPreviewResourcesSuspended) {
      return;
    }

    this.clipPreviewResourcesSuspended = true;
    this.auraManagerOverlays.setClipPreviewSuspended(true);
    logInfo(OVERLAY_WINDOWS_SCOPE, "Clip preview resources suspended", {
      auraCaptureSuspended: true,
    });
  }

  private restoreClipPreviewResources(): void {
    if (!this.clipPreviewResourcesSuspended) {
      return;
    }

    this.clipPreviewResourcesSuspended = false;
    this.auraManagerOverlays.setClipPreviewSuspended(false);
    if (!this.clipPreviewResourceRestoreEnabled) {
      return;
    }

    logInfo(OVERLAY_WINDOWS_SCOPE, "Clip preview resources restored", {
      auraCaptureSuspended: false,
    });
    void this.auraManagerOverlays.restoreRequestedOverlay();
  }

  selectCropRegion(
    options: SelectCropRegionOptions = {},
  ): Promise<CropRegionSelection | null> {
    this.auraManagerOverlays.setInputPassthrough(true);
    this.setRecorderOverlaySuppressed(RECORDER_SUPPRESSION_CROP_SELECTOR, true);

    return this.gridLinesOverlay.selectCropRegion(options).finally(() => {
      this.auraManagerOverlays.setInputPassthrough(false);
      this.setRecorderOverlaySuppressed(
        RECORDER_SUPPRESSION_CROP_SELECTOR,
        false,
      );
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
      OverlayWindowsChannel.IsRecorderRequested,
      [WindowName.Main],
      () => this.isRecorderOverlayRequested(),
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
      (_event, options: unknown) => {
        try {
          return this.selectCropRegion(parseSelectCropRegionOptions(options));
        } catch (error) {
          return handleValidationError(error);
        }
      },
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

  private resolveRenderableAuraProfile() {
    const { activeGame } = SettingsStoreService.getInstance().get();

    return resolveRenderableProfileForGame(
      ProfilesService.getInstance().list(),
      activeGame,
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

  private updateManagedRecorderSnapshot(
    snapshot: ManagedRecorderChangeSnapshot,
  ): void {
    this.recorderCaptureMode = snapshot.captureMode;
    this.recorderStatus = {
      bufferActive: snapshot.status.bufferActive,
      runRecordingActive: snapshot.status.runRecordingActive,
    };
  }

  private applyOverlayCaptureProtection(): void {
    this.setOverlayCaptureProtectionEnabled(
      resolveOverlayCaptureProtectionEnabled(
        this.overlayCaptureProtectionSettings,
        {
          captureMode: this.recorderCaptureMode,
          status: this.recorderStatus,
        },
      ),
    );
  }

  private isRecorderOverlaySuppressed(): boolean {
    return this.recorderOverlaySuppressionIds.size > 0;
  }

  private setRecorderOverlaySuppressed(
    suppressionId: string,
    active: boolean,
  ): void {
    const wasSuppressed = this.isRecorderOverlaySuppressed();
    if (active) {
      this.recorderOverlaySuppressionIds.add(suppressionId);
    } else {
      this.recorderOverlaySuppressionIds.delete(suppressionId);
    }

    if (wasSuppressed === this.isRecorderOverlaySuppressed()) {
      return;
    }

    if (this.isRecorderOverlaySuppressed()) {
      this.recordingControlsOverlay.suspendRequestedOverlay(
        "overlay-suppressed",
      );
      return;
    }

    void this.recordingControlsOverlay.restoreRequestedOverlay();
  }
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
  const addAuraShape = parseOptionalCropRegionSelectionShape(
    options.addAuraShape,
    OverlayWindowsChannel.ShowAura,
  );

  return {
    ...(options.startAddingAura === true ? { startAddingAura: true } : {}),
    ...(addAuraShape ? { addAuraShape } : {}),
  };
}

function parseSelectCropRegionOptions(
  options: unknown,
): SelectCropRegionOptions {
  if (options === undefined) {
    return {};
  }

  assertObject(
    options,
    "crop selector options",
    OverlayWindowsChannel.SelectCropRegion,
  );
  const shape = parseOptionalCropRegionSelectionShape(
    options.shape,
    OverlayWindowsChannel.SelectCropRegion,
  );

  return shape ? { shape } : {};
}

function parseOptionalCropRegionSelectionShape(
  shape: unknown,
  channel: OverlayWindowsChannel,
): CropRegionSelectionShape | undefined {
  if (shape === undefined) {
    return undefined;
  }

  assertString(shape, "shape", channel, {
    min: 3,
    max: 6,
  });

  if (shape !== "rect" && shape !== "arc" && shape !== "points") {
    throw new Error("shape must be rect, arc, or points");
  }

  return shape;
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
