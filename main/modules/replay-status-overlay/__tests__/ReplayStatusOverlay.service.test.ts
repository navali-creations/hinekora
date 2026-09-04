import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import {
  createFakeBrowserWindow,
  type FakeBrowserWindowOptions,
} from "~/main/test/fake-browser-window";

import { ReplayStatusOverlayChannel } from "../ReplayStatusOverlay.channels";
import { ReplayStatusOverlayService } from "../ReplayStatusOverlay.service";

const electronMocks = vi.hoisted(() => {
  const browserWindowFactory = vi.fn();
  const BrowserWindow = vi.fn(function BrowserWindow(
    options: Electron.BrowserWindowConstructorOptions,
  ) {
    return browserWindowFactory(options);
  });

  return {
    BrowserWindow,
    browserWindowFactory,
    getDisplayMatching: vi.fn(),
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
    getDisplayMatching: electronMocks.getDisplayMatching,
  },
}));

function createFakeWindow(options: FakeBrowserWindowOptions = {}) {
  return createFakeBrowserWindow({
    bounds: { height: 260, width: 420, x: 750, y: 0 },
    url: `app://-/${WindowName.ReplayStatusOverlay}`,
    ...options,
  });
}

function createService(contentProtection?: boolean) {
  const coordinator = new GameOverlayCoordinator();
  const createAnchorBounds = () => ({
    height: 42,
    width: 216,
    x: 1684,
    y: 24,
  });
  const service =
    contentProtection === undefined
      ? new ReplayStatusOverlayService(coordinator, createAnchorBounds)
      : new ReplayStatusOverlayService(
          coordinator,
          createAnchorBounds,
          () => contentProtection,
        );
  coordinator.setGameRunningActive(true);
  coordinator.setPoeFocusActive(true);

  return { coordinator, service };
}

beforeEach(() => {
  electronMocks.getDisplayMatching.mockReturnValue({
    bounds: { height: 1080, width: 1920, x: 0, y: 0 },
    workArea: { height: 1040, width: 1920, x: 0, y: 0 },
  } as Electron.Display);
});

afterEach(() => {
  vi.useRealTimers();
  electronMocks.BrowserWindow.mockClear();
  electronMocks.browserWindowFactory.mockReset();
  electronMocks.getDisplayMatching.mockReset();
  electronMocks.isPackaged = true;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ReplayStatusOverlayService", () => {
  it("shows a centered click-through status, hides it, and reuses its window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-04T10:00:00.000Z");
    const notificationWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(notificationWindow);
    const { service } = createService(true);

    await service.showProcessing("manual-1");

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        focusable: false,
        height: 260,
        transparent: true,
        width: 420,
        x: 750,
        y: 0,
        webPreferences: expect.objectContaining({ sandbox: true }),
      }),
    );
    expect(notificationWindow.loadFile).toHaveBeenCalledWith(
      expect.any(String),
      {
        hash: `/${WindowName.ReplayStatusOverlay}?clipId=manual-1`,
      },
    );
    expect(notificationWindow.setContentProtection).toHaveBeenCalledWith(true);
    expect(notificationWindow.showInactive).toHaveBeenCalledTimes(1);
    expect(notificationWindow.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
      true,
    );
    expect(notificationWindow.webContents.send).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      {
        clipId: "manual-1",
        dismissing: false,
        status: "processing",
      },
    );

    service.finish("manual-1", "saved");
    await vi.advanceTimersByTimeAsync(599);
    expect(notificationWindow.webContents.send).not.toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      expect.objectContaining({ status: "saved" }),
    );

    await vi.advanceTimersByTimeAsync(1);
    expect(notificationWindow.webContents.send).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      {
        clipId: "manual-1",
        dismissing: false,
        status: "saved",
      },
    );

    await vi.advanceTimersByTimeAsync(3_000);
    expect(notificationWindow.webContents.send).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      {
        clipId: "manual-1",
        dismissing: true,
        status: "saved",
      },
    );
    expect(notificationWindow.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(420);
    expect(notificationWindow.hide).toHaveBeenCalledTimes(1);
    expect(notificationWindow.close).not.toHaveBeenCalled();

    electronMocks.getDisplayMatching.mockReturnValue({
      bounds: { height: 1440, width: 2560, x: 1920, y: 0 },
      workArea: { height: 1400, width: 2560, x: 1920, y: 40 },
    } as Electron.Display);
    await service.showProcessing("manual-2");

    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(notificationWindow.loadFile).toHaveBeenCalledTimes(1);
    expect(notificationWindow.setBounds).toHaveBeenCalledWith(
      { height: 260, width: 420, x: 2990, y: 40 },
      false,
    );
    expect(notificationWindow.webContents.send).toHaveBeenLastCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      {
        clipId: "manual-2",
        dismissing: false,
        status: "processing",
      },
    );

    service.setContentProtectionEnabled(false);
    expect(notificationWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    service.destroy();
    expect(notificationWindow.close).toHaveBeenCalledTimes(1);
  });

  it("keeps a pending result until load and replaces rapid requests", async () => {
    vi.useFakeTimers();
    let resolveLoad!: () => void;
    const loadPromise = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const notificationWindow = createFakeWindow();
    notificationWindow.loadFile.mockReturnValue(loadPromise);
    electronMocks.browserWindowFactory.mockReturnValue(notificationWindow);
    const { service } = createService();

    const firstShowing = service.showProcessing("manual-1");
    const secondShowing = service.showProcessing("manual-2");
    service.finish("manual-1", "failed");
    service.finish("manual-2", "failed");
    expect(notificationWindow.webContents.send).not.toHaveBeenCalled();

    resolveLoad();
    await Promise.all([firstShowing, secondShowing]);

    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(notificationWindow.loadFile).toHaveBeenCalledTimes(1);
    expect(notificationWindow.webContents.send).not.toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      expect.objectContaining({ clipId: "manual-1" }),
    );
    expect(notificationWindow.webContents.send).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      expect.objectContaining({
        clipId: "manual-2",
        status: "processing",
      }),
    );

    await vi.advanceTimersByTimeAsync(600);
    expect(notificationWindow.webContents.send).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      expect.objectContaining({
        clipId: "manual-2",
        status: "failed",
      }),
    );
    service.finish("manual-2", "saved");
    await vi.advanceTimersByTimeAsync(600);
    expect(notificationWindow.webContents.send).not.toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      expect.objectContaining({
        clipId: "manual-2",
        status: "saved",
      }),
    );
    service.destroy();
  });

  it("cleans up a failed load and redacts non-error failure details", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const failedWindow = createFakeWindow();
    failedWindow.loadFile.mockRejectedValue("private renderer failure");
    const recoveredWindow = createFakeWindow();
    electronMocks.browserWindowFactory
      .mockReturnValueOnce(failedWindow)
      .mockReturnValueOnce(recoveredWindow);
    const { service } = createService();

    const staleShowing = service.showProcessing("manual-stale-load");
    const failedShowing = service.showProcessing("manual-failed-load");
    await Promise.all([staleShowing, failedShowing]);

    expect(failedWindow.close).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("Could not load replay status"),
      { error: "Operation failed" },
    );

    await service.showProcessing("manual-recovered");
    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(2);
    expect(recoveredWindow.showInactive).toHaveBeenCalledTimes(1);
    const staleClosedListener = failedWindow.on.mock.calls.find(
      ([event]) => event === "closed",
    )?.[1] as (() => void) | undefined;
    staleClosedListener?.();
    service.restoreRequestedOverlay();
    expect(recoveredWindow.setOpacity).toHaveBeenLastCalledWith(1);
    service.destroy();
  });

  it("does not revive a window destroyed while its renderer loads", async () => {
    let resolveLoad!: () => void;
    const loadPromise = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const notificationWindow = createFakeWindow();
    notificationWindow.loadFile.mockReturnValue(loadPromise);
    electronMocks.browserWindowFactory.mockReturnValue(notificationWindow);
    const { service } = createService();

    const showing = service.showProcessing("manual-destroy-during-load");
    service.destroy();
    resolveLoad();
    await showing;

    expect(notificationWindow.close).toHaveBeenCalledTimes(1);
    expect(notificationWindow.webContents.send).not.toHaveBeenCalled();
  });

  it("suspends and restores only while a notification is requested", async () => {
    vi.useFakeTimers();
    const notificationWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(notificationWindow);
    const { service } = createService();

    service.setContentProtectionEnabled(true);
    service.suspendRequestedOverlay();
    service.restoreRequestedOverlay();
    await service.showProcessing("manual-focus");

    service.suspendRequestedOverlay();
    expect(notificationWindow.setOpacity).toHaveBeenLastCalledWith(0);

    service.restoreRequestedOverlay();
    expect(notificationWindow.setOpacity).toHaveBeenLastCalledWith(1);
    expect(notificationWindow.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
      true,
    );

    service.finish("manual-focus", "saved");
    await vi.advanceTimersByTimeAsync(4_020);
    const opacityCallCount = notificationWindow.setOpacity.mock.calls.length;
    service.suspendRequestedOverlay();
    service.restoreRequestedOverlay();
    expect(notificationWindow.setOpacity).toHaveBeenCalledTimes(
      opacityCallCount,
    );
    service.destroy();
  });

  it("clears live timers when its native window is closed", async () => {
    vi.useFakeTimers();
    const notificationWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(notificationWindow);
    const { service } = createService();

    await service.showProcessing("manual-closed");
    service.finish("manual-closed", "saved");
    const closedListener = notificationWindow.on.mock.calls.find(
      ([event]) => event === "closed",
    )?.[1] as (() => void) | undefined;
    closedListener?.();
    await vi.advanceTimersByTimeAsync(4_020);

    expect(notificationWindow.webContents.send).not.toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      expect.objectContaining({ status: "saved" }),
    );
    expect(notificationWindow.hide).not.toHaveBeenCalled();
    service.restoreRequestedOverlay();
    service.destroy();
  });

  it("constrains its window to a small display and ignores a destroyed load", async () => {
    electronMocks.getDisplayMatching.mockReturnValue({
      bounds: { height: 200, width: 300, x: -300, y: 40 },
      workArea: { height: 200, width: 300, x: -300, y: 40 },
    } as Electron.Display);
    const notificationWindow = createFakeWindow({ destroyed: true });
    electronMocks.browserWindowFactory.mockReturnValue(notificationWindow);
    const { service } = createService();

    await service.showProcessing("manual-destroyed");

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        height: 200,
        width: 300,
        x: -300,
        y: 40,
      }),
    );
    expect(notificationWindow.webContents.send).not.toHaveBeenCalled();
    service.destroy();
  });

  it("keeps the window suspended when focus is unavailable and tolerates destruction during timers", async () => {
    vi.useFakeTimers();
    const notificationWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(notificationWindow);
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(false);

    await service.showProcessing("manual-suspended");

    expect(notificationWindow.showInactive).not.toHaveBeenCalled();
    service.finish("manual-suspended", "saved");
    notificationWindow.isDestroyed.mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(4_020);

    expect(notificationWindow.webContents.send).not.toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      expect.objectContaining({ status: "saved" }),
    );
    expect(notificationWindow.hide).not.toHaveBeenCalled();
    service.destroy();
  });
});
