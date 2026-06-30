import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import { OverlayWindowsChannel } from "~/main/modules/overlay-windows/OverlayWindows.channels";
import {
  createFakeBrowserWindow,
  type FakeBrowserWindowOptions,
} from "~/main/test/fake-browser-window";

import { createDefaultSettings } from "~/types";
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
    getAllDisplays: vi.fn(),
    getAllWindows,
    getPrimaryDisplay: vi.fn(),
    isPackaged: true,
  };
});
const settingsStoreMocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return electronMocks.isPackaged;
    },
  },
  BrowserWindow: electronMocks.BrowserWindow,
  screen: {
    getAllDisplays: electronMocks.getAllDisplays,
    getPrimaryDisplay: electronMocks.getPrimaryDisplay,
  },
}));
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: () => ({
      get: settingsStoreMocks.get,
      update: settingsStoreMocks.update,
    }),
  },
}));

function createFakeWindow(options: FakeBrowserWindowOptions = {}) {
  return createFakeBrowserWindow({
    bounds: { x: 100, y: 100, width: 216, height: 200 },
    url: `app://-/${WindowName.RecorderOverlay}`,
    ...options,
  });
}

function mockPrimaryDisplay(): void {
  const primaryDisplay = {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  } as Electron.Display;
  electronMocks.getPrimaryDisplay.mockReturnValue(primaryDisplay);
  electronMocks.getAllDisplays.mockReturnValue([primaryDisplay]);
}

beforeEach(() => {
  electronMocks.getAllWindows.mockReturnValue([]);
  mockPrimaryDisplay();
  settingsStoreMocks.get.mockReturnValue({
    ...createDefaultSettings(),
    recorderOverlayBounds: null,
  });
  settingsStoreMocks.update.mockImplementation((input) => ({
    ...createDefaultSettings(),
    ...input,
  }));
});

afterEach(() => {
  electronMocks.BrowserWindow.mockClear();
  electronMocks.browserWindowFactory.mockReset();
  electronMocks.getAllDisplays.mockReset();
  electronMocks.getAllWindows.mockReset();
  electronMocks.getPrimaryDisplay.mockReset();
  electronMocks.isPackaged = true;
  settingsStoreMocks.get.mockReset();
  settingsStoreMocks.update.mockReset();
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
        width: 216,
        height: 200,
        focusable: false,
        x: 1684,
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
      width: 216,
      height: 200,
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

    await service.toggle();
    expect(recorderWindow.showInactive).toHaveBeenCalled();

    const closedListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];
    mainWindow.webContents.send.mockClear();
    closedListener?.();
    expect(service.getWindow()).toBeNull();
    expect(mainWindow.webContents.send).toHaveBeenLastCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      false,
    );
  });

  it("keeps a replacement recorder overlay when an old suspended window closes", async () => {
    const recorderWindow = createFakeWindow();
    const replacementWindow = createFakeWindow();
    electronMocks.browserWindowFactory
      .mockReturnValueOnce(recorderWindow)
      .mockReturnValueOnce(replacementWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();
    const closedListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];

    service.suspendForSystem();
    await service.restoreRequestedOverlay();
    replacementWindow.removeListener.mockClear();
    closedListener?.();

    expect(service.getWindow()).toBe(replacementWindow);
    expect(replacementWindow.removeListener).not.toHaveBeenCalled();

    service.destroy();

    expect(replacementWindow.removeListener).toHaveBeenCalledWith(
      "moved",
      expect.any(Function),
    );
    expect(replacementWindow.removeListener).toHaveBeenCalledWith(
      "resized",
      expect.any(Function),
    );
  });

  it("restores saved recorder overlay bounds when they overlap a current display", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    settingsStoreMocks.get.mockReturnValue({
      ...createDefaultSettings(),
      recorderOverlayBounds: { x: 1200, y: 64, width: 236, height: 42 },
    });
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);
    service.setMode("minimized");

    await service.show();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 1200,
        y: 64,
        width: 236,
        height: 42,
      }),
    );
  });

  it("falls back to default recorder overlay bounds when saved bounds are off-screen", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    settingsStoreMocks.get.mockReturnValue({
      ...createDefaultSettings(),
      recorderOverlayBounds: { x: 5000, y: 5000, width: 216, height: 200 },
    });
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    await service.show();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 1684,
        y: 24,
        width: 216,
        height: 200,
      }),
    );
  });

  it("falls back to default recorder overlay bounds when saved bounds cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    settingsStoreMocks.get.mockImplementation(() => {
      throw new Error("settings unavailable");
    });
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    await service.show();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 1684,
        y: 24,
        width: 216,
        height: 200,
      }),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to restore recorder overlay bounds"),
      expect.objectContaining({ error: "settings unavailable" }),
    );
  });

  it("saves recorder overlay bounds on debounced move and resize events", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    await service.show();
    settingsStoreMocks.update.mockClear();

    const movedListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "moved",
    )?.[1];
    const resizedListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "resized",
    )?.[1];

    vi.useFakeTimers();
    try {
      recorderWindow.getBounds.mockReturnValue({
        x: 32,
        y: 48,
        width: 330,
        height: 230,
      });
      movedListener?.();
      recorderWindow.getBounds.mockReturnValue({
        x: 48,
        y: 64,
        width: 330,
        height: 230,
      });
      resizedListener?.();
      vi.advanceTimersByTime(499);
      expect(settingsStoreMocks.update).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(settingsStoreMocks.update).toHaveBeenLastCalledWith({
        recorderOverlayBounds: { x: 48, y: 64, width: 330, height: 230 },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears pending recorder bounds saves when the recorder overlay is destroyed", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    await service.show();
    settingsStoreMocks.update.mockClear();

    const movedListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "moved",
    )?.[1];

    vi.useFakeTimers();
    try {
      movedListener?.();
      service.destroy();

      expect(settingsStoreMocks.update).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500);

      expect(settingsStoreMocks.update).toHaveBeenCalledTimes(1);
      expect(recorderWindow.removeListener).toHaveBeenCalledWith(
        "moved",
        expect.any(Function),
      );
      expect(recorderWindow.removeListener).toHaveBeenCalledWith(
        "resized",
        expect.any(Function),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips removing recorder bounds listeners from an already destroyed native window", async () => {
    const recorderWindow = createFakeWindow({ destroyed: true });
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    await service.show();

    const closedListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];
    closedListener?.();

    expect(recorderWindow.removeListener).not.toHaveBeenCalled();
  });

  it("saves recorder overlay bounds when the native close event fires", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    await service.show();
    settingsStoreMocks.update.mockClear();
    recorderWindow.getBounds.mockReturnValue({
      x: 72,
      y: 96,
      width: 330,
      height: 230,
    });

    const closeListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "close",
    )?.[1];
    closeListener?.();

    expect(settingsStoreMocks.update).toHaveBeenCalledWith({
      recorderOverlayBounds: { x: 72, y: 96, width: 330, height: 230 },
    });
  });

  it("saves recorder overlay bounds once when service shutdown triggers native close", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    await service.show();
    settingsStoreMocks.update.mockClear();
    recorderWindow.getBounds.mockReturnValue({
      x: 88,
      y: 112,
      width: 330,
      height: 230,
    });

    service.destroy();
    const closeListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "close",
    )?.[1];
    closeListener?.();

    expect(settingsStoreMocks.update).toHaveBeenCalledTimes(1);
    expect(settingsStoreMocks.update).toHaveBeenCalledWith({
      recorderOverlayBounds: { x: 88, y: 112, width: 330, height: 230 },
    });
  });

  it("logs recorder overlay show and hide reasons", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Recorder overlay shown"),
      expect.objectContaining({ mode: "expanded", reason: "request" }),
    );

    service.hide();

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Recorder overlay hidden"),
      expect.objectContaining({
        mode: "expanded",
        reason: "hide-requested",
      }),
    );
  });

  it("logs recorder overlay focus-gate hide and restore reasons", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const recorderWindow = createFakeWindow();
    const mainWindow = createFakeWindow({ url: "app://-/dashboard" });
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow as unknown as Electron.BrowserWindow,
    ]);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();
    info.mockClear();
    mainWindow.webContents.send.mockClear();

    service.suspendRequestedOverlay();

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Recorder overlay hidden"),
      expect.objectContaining({ mode: "expanded", reason: "focus-gate" }),
    );
    expect(service.isVisible()).toBe(false);
    expect(service.isRequested()).toBe(true);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      false,
    );

    mainWindow.webContents.send.mockClear();
    await service.restoreRequestedOverlay();

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Recorder overlay shown"),
      expect.objectContaining({
        mode: "expanded",
        reason: "focus-gate-restored",
      }),
    );
    expect(service.isVisible()).toBe(true);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      true,
    );
  });

  it("logs overlay-suppressed when recorder overlay display is blocked", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    let recorderAllowed = true;
    const service = new RecordingControlsOverlayService(
      coordinator,
      undefined,
      () => recorderAllowed,
    );
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();
    info.mockClear();
    recorderAllowed = false;

    await service.show();

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Recorder overlay hidden"),
      expect.objectContaining({
        mode: "expanded",
        reason: "overlay-suppressed",
      }),
    );
  });

  it("handles requested focus-gate suspension without a live recorder window", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();
    const closedListener = recorderWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];

    service.suspendForSystem();
    closedListener?.();

    service.suspendRequestedOverlay();

    expect(service.getWindow()).toBeNull();
    expect(service.isVisible()).toBe(false);
    expect(service.isRequested()).toBe(true);
  });

  it("does not duplicate focus-gate hide logs while already suspended", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();
    service.suspendRequestedOverlay();
    info.mockClear();

    service.suspendRequestedOverlay();

    expect(info).not.toHaveBeenCalledWith(
      expect.stringContaining("Recorder overlay hidden"),
      expect.any(Object),
    );
  });

  it("keeps an existing suspended state when focus-gate runs without a visible window", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();
    service.suspendRequestedOverlay();
    recorderWindow.setOpacity.mockClear();
    recorderWindow.isVisible.mockReturnValue(false);

    service.suspendRequestedOverlay();

    expect(recorderWindow.setOpacity).not.toHaveBeenCalled();
  });

  it("resizes between expanded and minimized modes without moving the right edge", async () => {
    const recorderWindow = createFakeWindow();
    recorderWindow.getBounds.mockReturnValue({
      x: 1684,
      y: 24,
      width: 216,
      height: 200,
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
      x: 1684,
      y: 24,
      width: 216,
      height: 200,
    });
  });

  it("stores mode changes while no recorder window is available", () => {
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    expect(service.setMode("minimized")).toBe("minimized");
    expect(service.getMode()).toBe("minimized");
    expect(service.createAnchorBounds()).toEqual({
      x: 1664,
      y: 24,
      width: 236,
      height: 42,
    });
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
  });

  it("suspends requested recorder overlay while PoE focus is inactive", async () => {
    const recorderWindow = createFakeWindow({ visible: true });
    const mainWindow = createFakeWindow({ url: "app://-/dashboard" });
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow as unknown as Electron.BrowserWindow,
    ]);
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);
    coordinator.setGameRunningActive(true);

    await service.show();

    expect(recorderWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(recorderWindow.showInactive).not.toHaveBeenCalled();
    expect(service.isVisible()).toBe(false);
    expect(service.isRequested()).toBe(true);
    expect(mainWindow.webContents.send).not.toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      true,
    );

    mainWindow.webContents.send.mockClear();
    coordinator.setPoeFocusActive(true);

    expect(recorderWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(1);
    await vi.waitFor(() => {
      expect(service.isVisible()).toBe(true);
    });
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      true,
    );
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
    expect(service.isVisible()).toBe(false);
    expect(service.isRequested()).toBe(true);
    expect(service.getWindow()).toBeNull();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      false,
    );

    mainWindow.webContents.send.mockClear();
    await service.restoreRequestedOverlay();

    expect(restoredRecorderWindow.loadFile).toHaveBeenCalledWith(
      expect.any(String),
      { hash: `/${WindowName.RecorderOverlay}` },
    );
    expect(restoredRecorderWindow.showInactive).toHaveBeenCalled();
    expect(service.isVisible()).toBe(true);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      true,
    );
  });

  it("ignores system suspend when the recorder overlay was not requested", () => {
    const coordinator = new GameOverlayCoordinator();
    const service = new RecordingControlsOverlayService(coordinator);

    service.suspendForSystem();

    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
    expect(service.getWindow()).toBeNull();
  });
});
