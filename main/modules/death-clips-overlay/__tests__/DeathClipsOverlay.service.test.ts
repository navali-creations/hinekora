import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import {
  createFakeBrowserWindow,
  type FakeBrowserWindowOptions,
} from "~/main/test/fake-browser-window";

import type { ReplayClip } from "~/types";
import { DeathClipsOverlayService } from "../DeathClipsOverlay.service";

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
    bounds: { x: 100, y: 100, width: 360, height: 96 },
    url: `app://-/${WindowName.ClipPreviewOverlay}`,
    ...options,
  });
}

function createDisplay(width = 1920, height = 1080): Electron.Display {
  return {
    bounds: { x: 0, y: 0, width, height },
    workArea: { x: 0, y: 0, width, height },
  } as Electron.Display;
}

function mockDisplay(display: Electron.Display = createDisplay()): void {
  electronMocks.getDisplayMatching.mockReturnValue(display);
}

function createClip(update: Partial<ReplayClip> = {}): ReplayClip {
  return {
    id: "clip-1",
    kind: "death",
    status: "ready",
    sourceGame: "poe1",
    sourceLeague: "Standard",
    deathTimestamp: "2026-06-12T10:00:00.000Z",
    triggerLineHash: "hash",
    originalObsPath: "clip.mp4",
    processedClipPath: "clip.mp4",
    targetDurationSeconds: 10,
    sizeBytes: 0,
    error: null,
    createdAt: "2026-06-12T10:00:00.000Z",
    updatedAt: "2026-06-12T10:00:00.000Z",
    ...update,
  };
}

function createService(
  anchorBounds: Electron.Rectangle = {
    x: 100,
    y: 100,
    width: 360,
    height: 96,
  },
) {
  const coordinator = new GameOverlayCoordinator();
  const service = new DeathClipsOverlayService(coordinator, () => anchorBounds);
  coordinator.setGameRunningActive(true);

  return { coordinator, service };
}

beforeEach(() => {
  mockDisplay();
});

afterEach(() => {
  electronMocks.BrowserWindow.mockClear();
  electronMocks.browserWindowFactory.mockReset();
  electronMocks.getDisplayMatching.mockReset();
  electronMocks.isPackaged = true;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DeathClipsOverlayService", () => {
  it("creates a clip preview overlay using recorder anchor bounds", async () => {
    const clipWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(clipWindow);
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(true);

    await service.showClip(createClip());

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 560,
        height: 396,
        webPreferences: expect.objectContaining({ sandbox: true }),
      }),
    );
    expect(clipWindow.loadFile).toHaveBeenCalledWith(expect.any(String), {
      hash: `/${WindowName.ClipPreviewOverlay}?clipId=clip-1`,
    });
    expect(clipWindow.showInactive).toHaveBeenCalled();

    const closedListener = clipWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];
    Object.assign(service, {
      clipPreviewWindow: createFakeWindow(),
    });
    closedListener?.();
    expect(
      (service as unknown as { clipPreviewWindow: unknown }).clipPreviewWindow,
    ).not.toBeNull();
    Object.assign(service, {
      clipPreviewWindow: clipWindow,
    });
    closedListener?.();
    expect(
      (service as unknown as { clipPreviewWindow: unknown }).clipPreviewWindow,
    ).toBeNull();
  });

  it("logs clip preview overlay open and close events", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const clipWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(clipWindow);
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(true);

    await service.showClip(createClip({ id: "clip-log", kind: "manual" }));
    expect(service.hide()).toBe(true);

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Replay clip overlay opened"),
      { clipId: "clip-log", kind: "manual" },
    );
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Replay clip overlay closed"),
      { reason: "hide-requested" },
    );
  });

  it("handles clip preview guard paths and existing preview windows", async () => {
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(true);

    expect(service.hide()).toBe(false);
    await service.showClip(
      createClip({ originalObsPath: null, processedClipPath: null }),
    );
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();

    const existingPreviewWindow = createFakeWindow();
    Object.assign(service, {
      clipPreviewWindow: existingPreviewWindow,
    });
    await service.showClip(
      createClip({
        id: "clip-existing",
        originalObsPath: "clip.mp4",
        processedClipPath: null,
      }),
    );
    expect(existingPreviewWindow.setBounds).toHaveBeenCalled();
    expect(existingPreviewWindow.loadFile).toHaveBeenCalledWith(
      expect.any(String),
      { hash: `/${WindowName.ClipPreviewOverlay}?clipId=clip-existing` },
    );

    service.hide();
    expect(existingPreviewWindow.close).toHaveBeenCalled();

    const destroyedPreviewWindow = createFakeWindow({ destroyed: true });
    electronMocks.browserWindowFactory.mockReturnValue(destroyedPreviewWindow);
    await service.showClip(
      createClip({
        id: "clip-destroyed",
        originalObsPath: "clip.mp4",
        processedClipPath: null,
      }),
    );
    expect(destroyedPreviewWindow.loadFile).not.toHaveBeenCalled();
  });

  it("cleans up newly requested clip preview windows when renderer load fails", async () => {
    const clipWindow = createFakeWindow();
    clipWindow.loadFile.mockRejectedValue(new Error("load failed"));
    electronMocks.browserWindowFactory.mockReturnValue(clipWindow);
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(true);

    await expect(service.showClip(createClip())).rejects.toThrow("load failed");

    expect(clipWindow.close).toHaveBeenCalled();
    expect(
      (service as unknown as { clipPreviewOverlayRequested: boolean })
        .clipPreviewOverlayRequested,
    ).toBe(false);
    expect(
      (service as unknown as { clipPreviewWindow: unknown }).clipPreviewWindow,
    ).toBeNull();
  });

  it("keeps already requested clip preview windows when renderer reload fails", async () => {
    const clipWindow = createFakeWindow();
    clipWindow.loadFile.mockRejectedValue(new Error("load failed"));
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(true);
    Object.assign(service, {
      clipPreviewOverlayRequested: true,
      clipPreviewWindow: clipWindow,
    });

    await expect(service.showClip(createClip())).rejects.toThrow("load failed");

    expect(clipWindow.close).not.toHaveBeenCalled();
    expect(
      (service as unknown as { clipPreviewOverlayRequested: boolean })
        .clipPreviewOverlayRequested,
    ).toBe(true);
    expect(
      (service as unknown as { clipPreviewWindow: unknown }).clipPreviewWindow,
    ).toBe(clipWindow);
  });

  it("does not request a clip preview after its window is destroyed during load", async () => {
    const clipWindow = createFakeWindow();
    clipWindow.loadFile.mockImplementation(async () => {
      clipWindow.isDestroyed.mockReturnValue(true);
    });
    electronMocks.browserWindowFactory.mockReturnValue(clipWindow);
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(true);

    await service.showClip(createClip());

    expect(clipWindow.showInactive).not.toHaveBeenCalled();
    expect(
      (service as unknown as { clipPreviewOverlayRequested: boolean })
        .clipPreviewOverlayRequested,
    ).toBe(false);
  });

  it("keeps the clip preview overlay visible while its window is focused", async () => {
    const clipWindow = createFakeWindow({ visible: true });
    electronMocks.browserWindowFactory.mockReturnValue(clipWindow);
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(true);

    await service.showClip(createClip());
    const focusListener = clipWindow.on.mock.calls.find(
      ([eventName]) => eventName === "focus",
    )?.[1];
    const blurListener = clipWindow.on.mock.calls.find(
      ([eventName]) => eventName === "blur",
    )?.[1];

    focusListener?.();
    clipWindow.setOpacity.mockClear();
    clipWindow.setIgnoreMouseEvents.mockClear();

    coordinator.setPoeFocusActive(false);
    expect(clipWindow.setOpacity).not.toHaveBeenCalledWith(0);
    expect(clipWindow.setIgnoreMouseEvents).not.toHaveBeenCalledWith(true);

    blurListener?.();
    expect(clipWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(clipWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
  });

  it("positions clip preview above, below, or inside the active display", async () => {
    let anchorBounds = {
      x: 10,
      y: 500,
      width: 360,
      height: 96,
    };
    const coordinator = new GameOverlayCoordinator();
    const service = new DeathClipsOverlayService(
      coordinator,
      () => anchorBounds,
    );
    coordinator.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);
    mockDisplay(createDisplay(800, 600));

    const aboveWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValueOnce(aboveWindow);
    await service.showClip(createClip({ id: "above" }));
    expect(electronMocks.BrowserWindow).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 10, y: 96, width: 560, height: 396 }),
    );

    service.hide();
    anchorBounds = {
      x: 900,
      y: 250,
      width: 360,
      height: 96,
    };
    const clampedWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValueOnce(clampedWindow);
    await service.showClip(createClip({ id: "clamped" }));
    expect(electronMocks.BrowserWindow).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 240, y: 204, width: 560, height: 396 }),
    );
  });
});
