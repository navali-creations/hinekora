import { BrowserWindow, globalShortcut, screen } from "electron";

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

import type { CropRegionSelection } from "../overlay-windows/OverlayWindows.dto";

const MIN_CROP_SIZE = 8;
const GRID_LINES_OVERLAY_SCOPE = "grid-lines-overlay";
const CROP_SELECTOR_OVERLAY_FOCUS_ID = "crop-selector-overlay";

class GridLinesOverlayService {
  private cropSelectorWindow: BrowserWindow | null = null;
  private cropSelectionEscapeRegistered = false;
  private cropSelectorOverlayFocusActive = false;
  private pendingCropSelection: {
    resolve: (selection: CropRegionSelection | null) => void;
  } | null = null;

  constructor(
    private readonly coordinator: GameOverlayCoordinator,
    private readonly getContentProtectionEnabled = () => false,
    private readonly onOverlayFocusRelease = () => {},
  ) {}

  async selectCropRegion(): Promise<CropRegionSelection | null> {
    this.cancelCropRegionSelection();

    await this.createWindow();

    return new Promise((resolveSelection) => {
      this.pendingCropSelection = { resolve: resolveSelection };
      this.registerCropSelectionShortcuts();
      this.setCropSelectorOverlayFocusActive(true);
      this.coordinator.showGameOverlayWindow(this.cropSelectorWindow);
      this.cropSelectorWindow?.focus();
    });
  }

  completeCropRegionSelection(selection: unknown): void {
    const parsedSelection = this.parseCropRegionSelection(selection);
    if (!parsedSelection || !this.pendingCropSelection) {
      return;
    }

    this.pendingCropSelection.resolve(
      this.withSelectionViewport(parsedSelection),
    );
    this.pendingCropSelection = null;
    this.closeWindow();
  }

  cancelCropRegionSelection(): void {
    this.pendingCropSelection?.resolve(null);
    this.pendingCropSelection = null;
    this.closeWindow();
  }

  destroy(): void {
    this.pendingCropSelection?.resolve(null);
    this.pendingCropSelection = null;
    this.unregisterCropSelectionShortcuts();
    this.setCropSelectorOverlayFocusActive(false, { startHandoff: false });
    const window = this.cropSelectorWindow;
    this.cropSelectorWindow = null;
    closeOverlayWindow(window);
  }

  setContentProtectionEnabled(enabled: boolean): void {
    applyGameOverlayContentProtection(this.cropSelectorWindow, enabled);
  }

  private async createWindow(): Promise<void> {
    if (this.cropSelectorWindow && !this.cropSelectorWindow.isDestroyed()) {
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;

    this.cropSelectorWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      minWidth: width,
      minHeight: height,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      show: false,
      webPreferences: createOverlayWebPreferences(),
    });

    const cropSelectorWindow = this.cropSelectorWindow;
    const cropSelectorWebContents = cropSelectorWindow.webContents;
    registerIpcWindowRole(
      cropSelectorWebContents,
      WindowName.CropSelectorOverlay,
    );
    configureGameOverlayWindow(cropSelectorWindow, {
      contentProtection: this.getContentProtectionEnabled(),
    });
    cropSelectorWindow.setFullScreenable(false);
    cropSelectorWindow.on("closed", () => {
      unregisterIpcWindowRole(cropSelectorWebContents);
      logInfo(GRID_LINES_OVERLAY_SCOPE, "Crop selector overlay closed");
      this.setCropSelectorOverlayFocusActive(false);
      if (this.cropSelectorWindow === cropSelectorWindow) {
        this.cropSelectorWindow = null;
      }
      this.pendingCropSelection?.resolve(null);
      this.pendingCropSelection = null;
      this.unregisterCropSelectionShortcuts();
    });

    await loadOverlayRenderer(
      cropSelectorWindow,
      `#/${WindowName.CropSelectorOverlay}`,
    );
    logInfo(GRID_LINES_OVERLAY_SCOPE, "Crop selector overlay opened");
  }

  private closeWindow(): void {
    this.unregisterCropSelectionShortcuts();
    this.setCropSelectorOverlayFocusActive(false);
    const window = this.cropSelectorWindow;
    this.cropSelectorWindow = null;
    closeOverlayWindow(window);
  }

  private setCropSelectorOverlayFocusActive(
    active: boolean,
    options: { startHandoff?: boolean } = {},
  ): void {
    if (this.cropSelectorOverlayFocusActive === active) {
      return;
    }

    if (!active && options.startHandoff !== false) {
      this.onOverlayFocusRelease();
    }

    this.cropSelectorOverlayFocusActive = active;
    this.coordinator.setOverlayFocusActive(
      CROP_SELECTOR_OVERLAY_FOCUS_ID,
      active,
    );
  }

  private registerCropSelectionShortcuts(): void {
    this.unregisterCropSelectionShortcuts();
    this.cropSelectionEscapeRegistered = globalShortcut.register(
      "Escape",
      () => {
        this.cancelCropRegionSelection();
      },
    );
  }

  private unregisterCropSelectionShortcuts(): void {
    if (!this.cropSelectionEscapeRegistered) {
      return;
    }

    globalShortcut.unregister("Escape");
    this.cropSelectionEscapeRegistered = false;
  }

  private parseCropRegionSelection(
    selection: unknown,
  ): CropRegionSelection | null {
    if (typeof selection !== "object" || selection === null) {
      return null;
    }

    const record = selection as Record<string, unknown>;
    const x = this.parseCoordinate(record.x);
    const y = this.parseCoordinate(record.y);
    const width = this.parseCoordinate(record.width);
    const height = this.parseCoordinate(record.height);

    if (
      x === null ||
      y === null ||
      width === null ||
      height === null ||
      width < MIN_CROP_SIZE ||
      height < MIN_CROP_SIZE
    ) {
      return null;
    }

    return { x, y, width, height };
  }

  private parseCoordinate(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    return Math.max(0, Math.min(100_000, Math.round(value)));
  }

  private withSelectionViewport(
    selection: CropRegionSelection,
  ): CropRegionSelection {
    const bounds = this.cropSelectorWindow?.getBounds();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      return selection;
    }

    return {
      ...selection,
      viewportWidth: Math.round(bounds.width),
      viewportHeight: Math.round(bounds.height),
    };
  }
}

export { GridLinesOverlayService };
