import { AuraManagerOverlaysService } from "~/main/modules/aura-manager-overlays";
import { DeathClipsOverlayService } from "~/main/modules/death-clips-overlay";
import { GridLinesOverlayService } from "~/main/modules/grid-lines-overlay";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManualClipsOverlayService } from "~/main/modules/manual-clips-overlay";
import { ProfilesService } from "~/main/modules/profiles";
import { RecordingControlsOverlayService } from "~/main/modules/recording-controls-overlay";
import {
  assertObject,
  assertOptionalBoolean,
  assertString,
  handleValidationError,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import type { ReplayClip } from "~/types";
import {
  type OverlayPlacement,
  OverlayPlacementSchema,
  type Profile,
} from "~/types";
import { GameOverlayCoordinator } from "./GameOverlayCoordinator";
import { OverlayWindowsChannel } from "./OverlayWindows.channels";
import type {
  CropRegionSelection,
  ShowAuraOverlayOptions,
} from "./OverlayWindows.dto";

class OverlayWindowsService {
  private static instance: OverlayWindowsService | null = null;

  private readonly coordinator = new GameOverlayCoordinator();
  private readonly recordingControlsOverlay =
    new RecordingControlsOverlayService(this.coordinator);
  private readonly deathClipsOverlay = new DeathClipsOverlayService(
    this.coordinator,
    () => this.recordingControlsOverlay.createAnchorBounds(),
  );
  private readonly manualClipsOverlay = new ManualClipsOverlayService(
    this.deathClipsOverlay,
  );
  private readonly gridLinesOverlay = new GridLinesOverlayService(
    this.coordinator,
  );
  private readonly auraManagerOverlays = new AuraManagerOverlaysService(
    this.coordinator,
  );
  private gameRunningActive = false;
  private persistentAuraOverlayRequested = false;

  static getInstance(): OverlayWindowsService {
    if (!OverlayWindowsService.instance) {
      OverlayWindowsService.instance = new OverlayWindowsService();
    }

    return OverlayWindowsService.instance;
  }

  constructor() {
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

  setPoeFocusActive(active: boolean): void {
    this.coordinator.setPoeFocusActive(active);
  }

  setGameRunningActive(active: boolean): void {
    const wasActive = this.gameRunningActive;
    this.gameRunningActive = active;
    this.coordinator.setGameRunningActive(active);
    this.auraManagerOverlays.setGameRunningActive(active);

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
    this.deathClipsOverlay.hide();
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

  previewAuraPlacement(profileId: string, placement: OverlayPlacement): void {
    this.auraManagerOverlays.previewPlacement(profileId, placement);
  }

  isAuraOverlayLocked(): boolean {
    return this.auraManagerOverlays.isLocked();
  }

  setAuraOverlayLocked(locked: boolean): void {
    this.auraManagerOverlays.setLocked(locked);
  }

  getRecorderWindow(): Electron.BrowserWindow | null {
    return this.recordingControlsOverlay.getWindow();
  }

  destroyAll(): void {
    this.recordingControlsOverlay.destroy();
    this.deathClipsOverlay.destroy();
    this.gridLinesOverlay.destroy();
    this.auraManagerOverlays.destroy();
  }

  suspendForSystem(): void {
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
      OverlayWindowsChannel.PreviewAuraPlacement,
      [WindowName.Main, WindowName.AuraOverlay],
      (_event, profileId, placement) => {
        try {
          assertString(
            profileId,
            "profileId",
            OverlayWindowsChannel.PreviewAuraPlacement,
            { min: 1, max: 128 },
          );

          this.previewAuraPlacement(
            profileId,
            OverlayPlacementSchema.parse(placement),
          );
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

export { OverlayWindowsService };
