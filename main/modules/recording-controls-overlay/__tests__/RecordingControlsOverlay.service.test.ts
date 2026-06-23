import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import { OverlayWindowsChannel } from "~/main/modules/overlay-windows/OverlayWindows.channels";
import {
  createFakeBrowserWindow,
  type FakeBrowserWindowOptions,
} from "~/main/test/fake-browser-window";

import { RecordingControlsOverlayService } from "../RecordingControlsOverlay.service";

const electronMocks = vi.hoisted(() => {
  const getAllWindows = vi.fn();
  const browserWindowFactory = vi.fn();
  const BrowserWindow = vi.fn(function BrowserWindow(
    options: Electron.BrowserWindowConstructorOptions,
  ) {
    return browserWindowFactory(options);
  });
  Object.assign(BrowserWindow, { getAllWindows });

  return {
    BrowserWindow,
    browserWindowFactory,
    getAllWindows,
    getPrimaryDisplay: vi.fn(),
    isPackaged: true,
  };
});

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return electronMocks.isPackaged;
    },
  },
  BrowserWindow: electronMocks.BrowserWindow,
  screen: {
    getPrimaryDisplay: electronMocks.getPrimaryDisplay,
  },
}));

function createFakeWindow(options: FakeBrowserWindowOptions = {}) {
  return createFakeBrowserWindow({
    bounds: { x: 100, y: 100, width: 360, height: 86 },
    url: `app://-/${WindowName.RecorderOverlay}`,
    ...options,
  });
}

function mockPrimaryDisplay(): void {
  electronMocks.getPrimaryDisplay.mockReturnValue({
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  } as Electron.Display);
}

beforeEach(() => {
  electronMocks.getAllWindows.mockReturnValue([]);
  mockPrimaryDisplay();
});

afterEach(() => {
  electronMocks.BrowserWindow.mockClear();
  electronMocks.browserWindowFactory.mockReset();
  electronMocks.getAllWindows.mockReset();
  electronMocks.getPrimaryDisplay.mockReset();
  electronMocks.isPackaged = true;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RecordingControlsOverlayService", () => {
  it("creates, shows, toggles, and closes the recorder overlay", async () => {
    const recorderWindow = createFakeWindow();
    const destroyedWindow = createFakeWindow({ destroyed: true });
    const overlayWindow = createFakeWindow();
    const mainWindow = createFakeWindow({ url: "app://-/dashboard" });
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    electronMocks.getAllWindows.mockReturnValue([
      destroyedWindow as unknown as Electron.BrowserWindow,
      overlayWindow as unknown as Electron.BrowserWindow,
      mainWindow as unknown as Electron.BrowserWindow,
    ]);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);
    expect(service.isVisible()).toBe(false);

    await service.show();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 360,
        height: 86,
        focusable: false,
        x: 1540,
        y: 24,
        webPreferences: expect.objectContaining({ sandbox: true }),
      }),
    );
    expect(recorderWindow.loadFile).toHaveBeenCalledWith(expect.any(String), {
      hash: `/${WindowName.RecorderOverlay}`,
    });
    expect(recorderWindow.showInactive).toHaveBeenCalled();
    expect(service.getWindow()).toBe(recorderWindow);
    expect(service.createAnchorBounds()).toEqual({
      x: 100,
      y: 100,
      width: 360,
      height: 86,
    });
    expect(service.isVisible()).toBe(true);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      true,
    );
    expect(overlayWindow.webContents.send).not.toHaveBeenCalled();

    mainWindow.webContents.send.mockClear();
    await service.show();
    expect(mainWindow.webContents.send).not.toHaveBeenCalled();

    await service.toggle();
    expect(recorderWindow.hide).toHaveBeenCalled();
    expect(service.isVisible()).toBe(false);
    expect(mainWindow.webContents.send).toHaveBeenLastCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      false,
    );

    recorderWindow.isVisible.mockReturnValue(false);
    await service.toggle();
    expect(recorderWindow.showInactive).toHaveBeenCalled();

    const closedListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];
    const replacementWindow = createFakeWindow();
    Object.assign(service, {
      recorderOverlayRequested: false,
      recorderWindow: replacementWindow,
    });
    mainWindow.webContents.send.mockClear();
    closedListener?.();
    expect(service.getWindow()).toBe(replacementWindow);
    expect(mainWindow.webContents.send).not.toHaveBeenCalled();

    Object.assign(service, {
      recorderOverlayRequested: true,
      recorderWindow,
    });
    closedListener?.();
    expect(service.getWindow()).toBeNull();
    expect(mainWindow.webContents.send).toHaveBeenLastCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      false,
    );
  });

  it("resizes between expanded and minimized modes without moving the right edge", async () => {
    const recorderWindow = createFakeWindow();
    recorderWindow.getBounds.mockReturnValue({
      x: 1540,
      y: 24,
      width: 360,
      height: 86,
    });
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    await service.show();

    expect(service.getMode()).toBe("expanded");
    expect(service.setMode("expanded")).toBe("expanded");
    expect(recorderWindow.setBounds).not.toHaveBeenCalled();
    expect(service.setMode("minimized")).toBe("minimized");
    expect(recorderWindow.setBounds).toHaveBeenCalledWith({
      x: 1664,
      y: 24,
      width: 236,
      height: 42,
    });
    expect(recorderWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderModeChanged,
      "minimized",
    );

    recorderWindow.getBounds.mockReturnValue({
      x: 1664,
      y: 24,
      width: 236,
      height: 42,
    });

    expect(service.setMode("expanded")).toBe("expanded");
    expect(recorderWindow.setBounds).toHaveBeenLastCalledWith({
      x: 1540,
      y: 24,
      width: 360,
      height: 86,
    });
  });

  it("stores mode changes while no recorder window is available", () => {
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    expect(service.setMode("minimized")).toBe("minimized");
    expect(service.getMode()).toBe("minimized");
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
  });

  it("suspends requested recorder overlay while PoE focus is inactive", async () => {
    const recorderWindow = createFakeWindow({ visible: true });
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);

    await service.show();

    expect(recorderWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(recorderWindow.showInactive).not.toHaveBeenCalled();

    coordinator.setPoeFocusActive(true);

    expect(recorderWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(1);
  });

  it("does not participate in app focus when clicked", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();

    expect(recorderWindow.on).not.toHaveBeenCalledWith(
      "focus",
      expect.any(Function),
    );
    expect(recorderWindow.on).not.toHaveBeenCalledWith(
      "blur",
      expect.any(Function),
    );
  });

  it("recreates a requested recorder overlay after system suspend closes the native window", async () => {
    const firstRecorderWindow = createFakeWindow();
    const restoredRecorderWindow = createFakeWindow();
    const mainWindow = createFakeWindow({ url: "app://-/dashboard" });
    electronMocks.browserWindowFactory
      .mockReturnValueOnce(firstRecorderWindow)
      .mockReturnValueOnce(restoredRecorderWindow);
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow as unknown as Electron.BrowserWindow,
    ]);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();
    mainWindow.webContents.send.mockClear();
    service.suspendForSystem();
    const closedListener = firstRecorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];
    closedListener?.();

    expect(firstRecorderWindow.close).toHaveBeenCalled();
    expect(service.isVisible()).toBe(true);
    expect(service.getWindow()).toBeNull();
    expect(mainWindow.webContents.send).not.toHaveBeenCalled();

    await service.restoreRequestedOverlay();

    expect(restoredRecorderWindow.loadFile).toHaveBeenCalledWith(
      expect.any(String),
      { hash: `/${WindowName.RecorderOverlay}` },
    );
    expect(restoredRecorderWindow.showInactive).toHaveBeenCalled();
    expect(service.isVisible()).toBe(true);
  });

  it("ignores system suspend when the recorder overlay was not requested", () => {
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    service.suspendForSystem();

    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
    expect(service.getWindow()).toBeNull();
  });
});
