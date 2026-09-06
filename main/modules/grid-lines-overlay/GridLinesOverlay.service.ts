import { BrowserWindow, globalShortcut, screen } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import type {
  GameOverlayCoordinator,
  GameOverlayParticipant,
} from "~/main/modules/overlay-windows/GameOverlayCoordinator";
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

import { AuraPointPlacementSettings } from "~/types";
import type {
  CropRegionArcSelection,
  CropRegionPointSelection,
  CropRegionSelection,
  CropRegionSelectionShape,
  SelectCropRegionOptions,
} from "../overlay-windows/OverlayWindows.dto";

const MIN_CROP_SIZE = 8;
const MIN_ARC_THICKNESS = 4;
const GRID_LINES_OVERLAY_SCOPE = "grid-lines-overlay";
const CROP_SELECTOR_OVERLAY_FOCUS_ID = "crop-selector-overlay";

class GridLinesOverlayService implements GameOverlayParticipant {
  private cropSelectorWindow: BrowserWindow | null = null;
  private cropSelectionEscapeRegistered = false;
  private cropSelectorOverlayFocusActive = false;
  private pendingCropSelection: {
    resolve: (selection: CropRegionSelection | null) => void;
  } | null = null;
  private cropSelectorShape: CropRegionSelectionShape = "rect";

  constructor(
    private readonly coordinator: GameOverlayCoordinator,
    private readonly getContentProtectionEnabled = () => false,
    private readonly onOverlayFocusRelease = () => {},
    ignorePoeFocus = () => false,
  ) {
    this.coordinator.register(this, { ignorePoeFocus });
  }

  async selectCropRegion(
    options: SelectCropRegionOptions = {},
    activateWhenReady: () => boolean = () => true,
  ): Promise<CropRegionSelection | null> {
    this.cancelCropRegionSelection();
    this.cropSelectorShape = options.shape ?? "rect";

    await this.createWindow();
    if (!activateWhenReady()) {
      return null;
    }

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

  suspendRequestedOverlay(): void {
    if (!this.pendingCropSelection) {
      return;
    }

    this.coordinator.suspendGameOverlayWindow(this.cropSelectorWindow);
  }

  restoreRequestedOverlay(): void {
    if (!this.pendingCropSelection) {
      return;
    }

    const shouldFocus = !this.cropSelectorOverlayFocusActive;
    const canShow = this.coordinator.canShowGameOverlays(this);
    this.coordinator.showOrHideGameOverlayWindow(this.cropSelectorWindow, this);
    if (canShow && shouldFocus) {
      this.cropSelectorWindow?.focus();
    }
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
    cropSelectorWindow.on("focus", () => {
      if (this.cropSelectorWindow !== cropSelectorWindow) {
        return;
      }
      this.setCropSelectorOverlayFocusActive(true);
    });
    cropSelectorWindow.on("blur", () => {
      if (this.cropSelectorWindow !== cropSelectorWindow) {
        return;
      }
      this.setCropSelectorOverlayFocusActive(false, { startHandoff: false });
    });
    cropSelectorWindow.on("closed", () => {
      unregisterIpcWindowRole(cropSelectorWebContents);
      logInfo(GRID_LINES_OVERLAY_SCOPE, "Crop selector overlay closed");
      if (this.cropSelectorWindow !== cropSelectorWindow) {
        return;
      }

      this.setCropSelectorOverlayFocusActive(false);
      this.cropSelectorWindow = null;
      this.pendingCropSelection?.resolve(null);
      this.pendingCropSelection = null;
      this.unregisterCropSelectionShortcuts();
    });

    await loadOverlayRenderer(
      cropSelectorWindow,
      `#/${WindowName.CropSelectorOverlay}?shape=${this.cropSelectorShape}`,
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

    if (record.shape === "arc") {
      const arc = this.parseCropRegionArcSelection(record.arc, width, height);
      if (!arc) {
        return null;
      }

      return { shape: "arc", x, y, width, height, arc };
    }

    if (record.shape === "points") {
      const points = this.parseCropRegionPointSelection(
        record.points,
        width,
        height,
      );
      if (!points) {
        return null;
      }

      return { shape: "points", x, y, width, height, points };
    }

    if (record.shape !== undefined && record.shape !== "rect") {
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

  private parseCropRegionArcSelection(
    value: unknown,
    width: number,
    height: number,
  ): CropRegionArcSelection | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const startX = this.parseCoordinateWithinBounds(record.startX, width);
    const startY = this.parseCoordinateWithinBounds(record.startY, height);
    const endX = this.parseCoordinateWithinBounds(record.endX, width);
    const endY = this.parseCoordinateWithinBounds(record.endY, height);
    const controlX = this.parseCoordinateWithinBounds(record.controlX, width);
    const controlY = this.parseCoordinateWithinBounds(record.controlY, height);
    const thickness = this.parseCoordinate(record.thickness);

    if (
      startX === null ||
      startY === null ||
      endX === null ||
      endY === null ||
      controlX === null ||
      controlY === null ||
      thickness === null ||
      thickness < MIN_ARC_THICKNESS
    ) {
      return null;
    }

    return { startX, startY, endX, endY, controlX, controlY, thickness };
  }

  private parseCropRegionPointSelection(
    value: unknown,
    width: number,
    height: number,
  ): CropRegionPointSelection[] | null {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > AuraPointPlacementSettings.maxPoints
    ) {
      return null;
    }

    const points = value.map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const x = this.parseCoordinateWithinBounds(record.x, width);
      const y = this.parseCoordinateWithinBounds(record.y, height);

      return x === null || y === null ? null : { x, y };
    });

    return points.every((point) => point !== null)
      ? (points as CropRegionPointSelection[])
      : null;
  }

  private parseCoordinateWithinBounds(
    value: unknown,
    max: number,
  ): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    const coordinate = Math.round(value);
    return coordinate >= 0 && coordinate <= max ? coordinate : null;
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
