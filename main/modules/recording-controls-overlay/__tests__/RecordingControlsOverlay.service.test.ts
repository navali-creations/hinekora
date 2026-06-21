import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import { OverlayWindowsChannel } from "~/main/modules/overlay-windows/OverlayWindows.channels";

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

function createFakeWindow(
  options: { visible?: boolean; destroyed?: boolean; url?: string } = {},
) {
  return {
    close: vi.fn(),
    getBounds: vi.fn(() => ({ x: 100, y: 100, width: 360, height: 96 })),
    getNativeWindowHandle: vi.fn(() => {
      const buffer = Buffer.alloc(8);
      buffer.writeBigUInt64LE(1234n);
      return buffer;
    }),
    hide: vi.fn(),
    isDestroyed: vi.fn(() => options.destroyed ?? false),
    isVisible: vi.fn(() => options.visible ?? false),
    loadFile: vi.fn().mockResolvedValue(undefined),
    loadURL: vi.fn().mockResolvedValue(undefined),
    moveTop: vi.fn(),
    on: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setContentProtection: vi.fn(),
    setFullScreenable: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setOpacity: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    showInactive: vi.fn(),
    webContents: {
      getURL: vi.fn(
        () => options.url ?? `app://-/${WindowName.RecorderOverlay}`,
      ),
      isDevToolsOpened: vi.fn(() => false),
      openDevTools: vi.fn(),
      send: vi.fn(),
    },
  };
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
        height: 96,
        focusable: true,
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
      height: 96,
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

  it("keeps the recorder overlay visible while its window is focused", async () => {
    const recorderWindow = createFakeWindow({ visible: true });
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();
    const focusListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "focus",
    )?.[1];
    const blurListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "blur",
    )?.[1];

    focusListener?.();
    recorderWindow.setOpacity.mockClear();
    recorderWindow.setIgnoreMouseEvents.mockClear();

    coordinator.setPoeFocusActive(false);
    expect(recorderWindow.setOpacity).not.toHaveBeenCalledWith(0);
    expect(recorderWindow.setIgnoreMouseEvents).not.toHaveBeenCalledWith(true);

    blurListener?.();
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(recorderWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
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
