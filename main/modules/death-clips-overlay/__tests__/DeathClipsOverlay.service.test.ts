import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";

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
    setBounds: vi.fn(),
    setContentProtection: vi.fn(),
    setFullScreenable: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setOpacity: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    showInactive: vi.fn(),
    webContents: {
      getURL: vi.fn(
        () => options.url ?? `app://-/${WindowName.ClipPreviewOverlay}`,
      ),
      isDevToolsOpened: vi.fn(() => false),
      openDevTools: vi.fn(),
      send: vi.fn(),
    },
  };
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

  it("handles clip preview guard paths and existing preview windows", async () => {
    const { coordinator, service } = createService();
    coordinator.setPoeFocusActive(true);

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
