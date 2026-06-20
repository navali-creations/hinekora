import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ProfilesService } from "~/main/modules/profiles";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import type { Profile, ReplayClip } from "~/types";
import { GameOverlayCoordinator } from "../GameOverlayCoordinator";
import {
  hideGameOverlayWindow,
  isOverlayRendererWindow,
  loadOverlayRenderer,
  showGameOverlayWindow,
  suspendGameOverlayWindow,
} from "../OverlayWindow.shared";
import { OverlayWindowsChannel } from "../OverlayWindows.channels";
import { OverlayWindowsService } from "../OverlayWindows.service";

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
    getDisplayMatching: vi.fn(),
    getPrimaryDisplay: vi.fn(),
    globalShortcutRegister: vi.fn(() => true),
    globalShortcutUnregister: vi.fn(),
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
  globalShortcut: {
    register: electronMocks.globalShortcutRegister,
    unregister: electronMocks.globalShortcutUnregister,
  },
  screen: {
    getDisplayMatching: electronMocks.getDisplayMatching,
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
    setBounds: vi.fn(),
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

function createDisplay() {
  return {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  } as Electron.Display;
}

function mockDisplay(display: Electron.Display = createDisplay()): void {
  electronMocks.getDisplayMatching.mockReturnValue(display);
  electronMocks.getPrimaryDisplay.mockReturnValue(display);
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

function createProfile(update: Partial<Profile> = {}): Profile {
  return {
    id: "profile-1",
    name: "Default PoE Profile",
    game: "poe1",
    targetFps: 30,
    captureTarget: null,
    cropRegions: [
      {
        id: "crop-1",
        label: "Life",
        x: 10,
        y: 20,
        width: 100,
        height: 40,
      },
    ],
    overlayPlacements: [
      {
        id: "placement-1",
        cropRegionId: "crop-1",
        x: 30,
        y: 40,
        scale: 1,
        opacity: 1,
      },
    ],
    createdAt: "2026-06-12T10:00:00.000Z",
    updatedAt: "2026-06-12T10:00:00.000Z",
    ...update,
  };
}

function getInternals(service: OverlayWindowsService) {
  return service as unknown as {
    coordinator: GameOverlayCoordinator;
    deathClipsOverlay: Record<string, unknown>;
    gridLinesOverlay: Record<string, unknown>;
    manualClipsOverlay: Record<string, unknown>;
    recordingControlsOverlay: Record<string, unknown>;
    auraManagerOverlays: Record<string, unknown>;
  };
}

async function flushTimers(): Promise<void> {
  await new Promise<void>((resolveFlush) => {
    setTimeout(resolveFlush, 0);
  });
}

function createIpcEvent(senderId: number): Electron.IpcMainInvokeEvent {
  return {
    sender: {
      id: senderId,
    },
  } as Electron.IpcMainInvokeEvent;
}

beforeEach(() => {
  electronMocks.getAllWindows.mockReturnValue([]);
  mockDisplay();
  vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
    list: () => [],
  } as unknown as ProfilesService);
});

afterEach(() => {
  clearIpcWindowRolesForTests();
  electronMocks.BrowserWindow.mockClear();
  electronMocks.browserWindowFactory.mockReset();
  electronMocks.getAllWindows.mockReset();
  electronMocks.getDisplayMatching.mockReset();
  electronMocks.getPrimaryDisplay.mockReset();
  electronMocks.globalShortcutRegister.mockReset();
  electronMocks.globalShortcutRegister.mockReturnValue(true);
  electronMocks.globalShortcutUnregister.mockReset();
  electronMocks.isPackaged = true;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OverlayWindowsService", () => {
  it("creates and reuses the singleton instance", () => {
    const singletonAccess = OverlayWindowsService as unknown as {
      instance: OverlayWindowsService | null;
    };
    singletonAccess.instance = null;

    const first = OverlayWindowsService.getInstance();
    const second = OverlayWindowsService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("delegates overlay facade calls to focused overlay modules", async () => {
    const service = new OverlayWindowsService();
    const recorderWindow = createFakeWindow();
    const clip = {} as ReplayClip;
    const internals = getInternals(service);
    const coordinator = internals.coordinator as {
      setGameRunningActive(active: boolean): void;
      setPoeFocusActive(active: boolean): void;
    };
    const recordingControlsOverlay = internals.recordingControlsOverlay as {
      getWindow(): Electron.BrowserWindow | null;
      hide(): void;
      isVisible(): boolean;
      show(): Promise<void>;
      toggle(): Promise<void>;
    };
    const deathClipsOverlay = internals.deathClipsOverlay as {
      hide(): void;
      showClip(clip: ReplayClip): Promise<void>;
    };
    const manualClipsOverlay = internals.manualClipsOverlay as {
      showClip(clip: ReplayClip): Promise<void>;
    };
    const auraManagerOverlays = internals.auraManagerOverlays as {
      isLocked(): boolean;
      setGameRunningActive(active: boolean): void;
      setLocked(locked: boolean): void;
      show(profileId?: string): Promise<void>;
    };
    vi.spyOn(recordingControlsOverlay, "show").mockResolvedValue(undefined);
    vi.spyOn(recordingControlsOverlay, "hide").mockImplementation(
      () => undefined,
    );
    vi.spyOn(recordingControlsOverlay, "toggle").mockResolvedValue(undefined);
    vi.spyOn(recordingControlsOverlay, "isVisible").mockReturnValue(true);
    vi.spyOn(recordingControlsOverlay, "getWindow").mockReturnValue(
      recorderWindow as unknown as Electron.BrowserWindow,
    );
    vi.spyOn(deathClipsOverlay, "showClip").mockResolvedValue(undefined);
    vi.spyOn(deathClipsOverlay, "hide").mockImplementation(() => undefined);
    vi.spyOn(manualClipsOverlay, "showClip").mockResolvedValue(undefined);
    vi.spyOn(auraManagerOverlays, "setGameRunningActive").mockImplementation(
      () => undefined,
    );
    vi.spyOn(auraManagerOverlays, "setLocked").mockImplementation(
      () => undefined,
    );
    vi.spyOn(auraManagerOverlays, "isLocked").mockReturnValue(false);
    vi.spyOn(auraManagerOverlays, "show").mockResolvedValue(undefined);
    const setGameRunningActive = vi.spyOn(coordinator, "setGameRunningActive");
    const setPoeFocusActive = vi.spyOn(coordinator, "setPoeFocusActive");

    await expect(service.showRecorderOverlay()).resolves.toBeUndefined();
    service.hideRecorderOverlay();
    await expect(service.toggleRecorderOverlay()).resolves.toBeUndefined();
    expect(service.isRecorderOverlayVisible()).toBe(true);
    service.setGameRunningActive(true);
    service.setPoeFocusActive(true);
    await expect(service.showClipPreviewOverlay(clip)).resolves.toBeUndefined();
    await expect(
      service.showDeathClipPreviewOverlay(clip),
    ).resolves.toBeUndefined();
    await expect(
      service.showManualClipPreviewOverlay(clip),
    ).resolves.toBeUndefined();
    await expect(service.showAuraOverlay("profile-1")).resolves.toBeUndefined();
    service.setAuraOverlayLocked(false);
    expect(service.isAuraOverlayLocked()).toBe(false);
    service.hideClipPreviewOverlay();

    expect(recordingControlsOverlay.show).toHaveBeenCalledTimes(1);
    expect(recordingControlsOverlay.hide).toHaveBeenCalledTimes(1);
    expect(recordingControlsOverlay.toggle).toHaveBeenCalledTimes(1);
    expect(recordingControlsOverlay.getWindow).not.toHaveBeenCalled();
    expect(service.getRecorderWindow()).toBe(recorderWindow);
    expect(setGameRunningActive).toHaveBeenCalledWith(true);
    expect(auraManagerOverlays.setGameRunningActive).toHaveBeenCalledWith(true);
    expect(auraManagerOverlays.setLocked).toHaveBeenCalledWith(false);
    expect(auraManagerOverlays.show).toHaveBeenCalledWith("profile-1");
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    expect(deathClipsOverlay.showClip).toHaveBeenCalledWith(clip);
    expect(deathClipsOverlay.showClip).toHaveBeenCalledTimes(2);
    expect(manualClipsOverlay.showClip).toHaveBeenCalledWith(clip);
    expect(deathClipsOverlay.hide).toHaveBeenCalledTimes(1);
  });

  it("requests persistent aura overlays when the game becomes running", () => {
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [createProfile()],
    } as unknown as ProfilesService);
    const service = new OverlayWindowsService();
    const auraManagerOverlays = getInternals(service).auraManagerOverlays as {
      setGameRunningActive(active: boolean): void;
      show(profileId?: string): Promise<void>;
    };
    vi.spyOn(auraManagerOverlays, "setGameRunningActive").mockImplementation(
      () => undefined,
    );
    vi.spyOn(auraManagerOverlays, "show").mockResolvedValue(undefined);

    service.setGameRunningActive(true);
    service.setGameRunningActive(true);

    expect(auraManagerOverlays.show).toHaveBeenCalledTimes(1);
    expect(auraManagerOverlays.show).toHaveBeenCalledWith("profile-1");
  });

  it("requests persistent aura overlays before the game is running", () => {
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [createProfile()],
    } as unknown as ProfilesService);
    const service = new OverlayWindowsService();
    const auraManagerOverlays = getInternals(service).auraManagerOverlays as {
      setGameRunningActive(active: boolean): void;
      show(profileId?: string): Promise<void>;
    };
    vi.spyOn(auraManagerOverlays, "setGameRunningActive").mockImplementation(
      () => undefined,
    );
    vi.spyOn(auraManagerOverlays, "show").mockResolvedValue(undefined);

    expect(service.requestPersistentAuraOverlay()).toBe(true);
    service.setGameRunningActive(true);

    expect(auraManagerOverlays.show).toHaveBeenCalledTimes(1);
    expect(auraManagerOverlays.show).toHaveBeenCalledWith("profile-1");
  });

  it("wires death clip preview anchor bounds to the recorder overlay", async () => {
    const clipWindow = createFakeWindow();
    const recorderWindow = createFakeWindow();
    recorderWindow.getBounds.mockReturnValue({
      x: 20,
      y: 30,
      width: 360,
      height: 96,
    });
    electronMocks.browserWindowFactory.mockReturnValue(clipWindow);
    const service = new OverlayWindowsService();
    Object.assign(getInternals(service).recordingControlsOverlay, {
      recorderWindow,
    });
    service.setPoeFocusActive(true);

    await service.showDeathClipPreviewOverlay(createClip());

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 20,
        y: 134,
        width: 560,
        height: 396,
      }),
    );
  });

  it("registers IPC handlers with validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    const service = new OverlayWindowsService();
    const showRecorderOverlay = vi
      .spyOn(service, "showRecorderOverlay")
      .mockResolvedValue(undefined);
    const hideRecorderOverlay = vi.spyOn(service, "hideRecorderOverlay");
    const toggleRecorderOverlay = vi
      .spyOn(service, "toggleRecorderOverlay")
      .mockResolvedValue(undefined);
    vi.spyOn(service, "isRecorderOverlayVisible").mockReturnValue(true);
    const hideClipPreviewOverlay = vi.spyOn(service, "hideClipPreviewOverlay");
    const showAuraOverlay = vi
      .spyOn(service, "showAuraOverlay")
      .mockResolvedValue(undefined);
    vi.spyOn(service, "isAuraOverlayLocked").mockReturnValue(false);
    const setAuraOverlayLocked = vi.spyOn(service, "setAuraOverlayLocked");
    const previewAuraPlacement = vi.spyOn(service, "previewAuraPlacement");
    const selectCropRegion = vi
      .spyOn(service, "selectCropRegion")
      .mockResolvedValue(null);
    const completeCropRegionSelection = vi.spyOn(
      service,
      "completeCropRegionSelection",
    );
    const cancelCropRegionSelection = vi.spyOn(
      service,
      "cancelCropRegionSelection",
    );
    registerIpcWindowRole({ id: 42 }, WindowName.AuraOverlay);
    const auraOverlayEvent = createIpcEvent(42);

    await handlers.get(OverlayWindowsChannel.ShowRecorder)?.({});
    handlers.get(OverlayWindowsChannel.HideRecorder)?.({});
    await handlers.get(OverlayWindowsChannel.ToggleRecorder)?.({});
    expect(
      await handlers.get(OverlayWindowsChannel.IsRecorderVisible)?.({}),
    ).toBe(true);
    handlers.get(OverlayWindowsChannel.HideClipPreview)?.({});
    await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, 123);
    await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, "profile-1");
    expect(await handlers.get(OverlayWindowsChannel.IsAuraLocked)?.({})).toBe(
      false,
    );
    handlers.get(OverlayWindowsChannel.SetAuraLocked)?.({}, false);
    handlers.get(OverlayWindowsChannel.SetAuraLocked)?.(auraOverlayEvent, true);
    await handlers.get(OverlayWindowsChannel.PreviewAuraPlacement)?.(
      {},
      "profile-1",
      {
        id: "placement-1",
        cropRegionId: "crop-1",
        x: 1,
        y: 2,
        scale: 1,
        opacity: 1,
      },
    );
    await handlers.get(OverlayWindowsChannel.SelectCropRegion)?.({});
    await handlers.get(OverlayWindowsChannel.SelectCropRegion)?.(
      auraOverlayEvent,
    );
    handlers.get(OverlayWindowsChannel.CompleteCropRegionSelection)?.(
      {},
      { x: 1, y: 2, width: 10, height: 10 },
    );
    handlers.get(OverlayWindowsChannel.CancelCropRegionSelection)?.({});

    expect(showRecorderOverlay).toHaveBeenCalled();
    expect(hideRecorderOverlay).toHaveBeenCalled();
    expect(toggleRecorderOverlay).toHaveBeenCalled();
    expect(hideClipPreviewOverlay).toHaveBeenCalled();
    expect(showAuraOverlay).toHaveBeenCalledWith(undefined);
    expect(showAuraOverlay).toHaveBeenCalledWith("profile-1");
    expect(setAuraOverlayLocked).toHaveBeenCalledWith(false);
    expect(setAuraOverlayLocked).toHaveBeenCalledWith(true);
    expect(previewAuraPlacement).toHaveBeenCalledWith(
      "profile-1",
      expect.objectContaining({ id: "placement-1" }),
    );
    expect(selectCropRegion).toHaveBeenCalledTimes(2);
    expect(completeCropRegionSelection).toHaveBeenCalled();
    expect(cancelCropRegionSelection).toHaveBeenCalled();

    expect(
      await handlers.get(OverlayWindowsChannel.PreviewAuraPlacement)?.(
        {},
        "",
        {},
      ),
    ).toEqual({
      ok: false,
      error: "profileId is too short",
    });
    expect(
      await handlers.get(OverlayWindowsChannel.SetAuraLocked)?.({}, "false"),
    ).toEqual({
      ok: false,
      error: "locked must be a boolean",
    });
  });

  it("destroys all focused overlay modules", async () => {
    const service = new OverlayWindowsService();
    const recorderWindow = createFakeWindow();
    const clipPreviewWindow = createFakeWindow();
    const cropSelectorWindow = createFakeWindow();
    const auraWindow = createFakeWindow();
    const cropSelection = new Promise<null>((resolve) => {
      Object.assign(getInternals(service).gridLinesOverlay, {
        pendingCropSelection: { resolve },
      });
    });

    Object.assign(getInternals(service).recordingControlsOverlay, {
      recorderOverlayRequested: true,
      recorderWindow,
    });
    Object.assign(getInternals(service).deathClipsOverlay, {
      clipPreviewOverlayRequested: true,
      clipPreviewWindow,
    });
    Object.assign(getInternals(service).gridLinesOverlay, {
      cropSelectorWindow,
    });
    Object.assign(getInternals(service).auraManagerOverlays, {
      auraOverlayRequested: true,
      auraOverlayProfileId: "profile-1",
      auraWindow,
    });

    service.destroyAll();

    await expect(cropSelection).resolves.toBeNull();
    expect(recorderWindow.close).toHaveBeenCalled();
    expect(clipPreviewWindow.close).toHaveBeenCalled();
    expect(cropSelectorWindow.close).toHaveBeenCalled();
    expect(auraWindow.close).toHaveBeenCalled();
  });

  it("uses non-destructive overlay cleanup for system suspend and restores requested overlays", async () => {
    const service = new OverlayWindowsService();
    const internals = getInternals(service);
    const recordingControlsOverlay = internals.recordingControlsOverlay as {
      suspendForSystem(): void;
    };
    const deathClipsOverlay = internals.deathClipsOverlay as {
      destroy(): void;
    };
    const gridLinesOverlay = internals.gridLinesOverlay as {
      destroy(): void;
    };
    const auraManagerOverlays = internals.auraManagerOverlays as {
      suspendForSystem(): void;
    };
    const coordinator = internals.coordinator as {
      applyFocusGateToGameOverlays(): Promise<void>;
    };
    vi.spyOn(recordingControlsOverlay, "suspendForSystem").mockImplementation(
      () => undefined,
    );
    vi.spyOn(deathClipsOverlay, "destroy").mockImplementation(() => undefined);
    vi.spyOn(gridLinesOverlay, "destroy").mockImplementation(() => undefined);
    vi.spyOn(auraManagerOverlays, "suspendForSystem").mockImplementation(
      () => undefined,
    );
    vi.spyOn(coordinator, "applyFocusGateToGameOverlays").mockResolvedValue(
      undefined,
    );

    service.suspendForSystem();
    await service.restoreRequestedOverlays();

    expect(recordingControlsOverlay.suspendForSystem).toHaveBeenCalledTimes(1);
    expect(deathClipsOverlay.destroy).toHaveBeenCalledTimes(1);
    expect(gridLinesOverlay.destroy).toHaveBeenCalledTimes(1);
    expect(auraManagerOverlays.suspendForSystem).toHaveBeenCalledTimes(1);
    expect(coordinator.applyFocusGateToGameOverlays).toHaveBeenCalledTimes(1);
  });
});

describe("GridLinesOverlayService", () => {
  it("resolves, cancels, and validates crop selector selections", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();
    const setPoeFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setPoeFocusActive",
    );

    const selection = service.selectCropRegion();
    await flushTimers();
    vi.useFakeTimers();
    service.completeCropRegionSelection({
      x: 12.2,
      y: -5,
      width: 100.7,
      height: 80.1,
    });

    await expect(selection).resolves.toEqual({
      x: 12,
      y: 0,
      width: 101,
      height: 80,
      viewportWidth: 360,
      viewportHeight: 96,
    });
    expect(electronMocks.globalShortcutRegister).toHaveBeenCalledWith(
      "Escape",
      expect.any(Function),
    );
    expect(electronMocks.globalShortcutUnregister).toHaveBeenCalledWith(
      "Escape",
    );
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    expect(cropWindow.close).toHaveBeenCalled();

    setPoeFocusActive.mockClear();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    vi.useRealTimers();

    setPoeFocusActive.mockClear();
    const invalidSelection = service.selectCropRegion();
    await flushTimers();
    service.completeCropRegionSelection({
      x: "bad",
      y: 0,
      width: 100,
      height: 80,
    });
    service.completeCropRegionSelection({
      x: 0,
      y: 0,
      width: 7,
      height: 80,
    });
    service.completeCropRegionSelection(null);
    service.cancelCropRegionSelection();
    await expect(invalidSelection).resolves.toBeNull();
    expect(setPoeFocusActive).not.toHaveBeenCalled();
  });

  it("clears pending crop focus restore timers and omits invalid viewport sizes", async () => {
    const cropWindow = createFakeWindow();
    cropWindow.getBounds.mockReturnValue({
      x: 0,
      y: 0,
      width: 0,
      height: 96,
    });
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();
    const setPoeFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setPoeFocusActive",
    );

    const selection = service.selectCropRegion();
    await flushTimers();
    vi.useFakeTimers();
    service.completeCropRegionSelection({
      x: 12,
      y: 14,
      width: 100,
      height: 80,
    });

    await expect(selection).resolves.toEqual({
      x: 12,
      y: 14,
      width: 100,
      height: 80,
    });
    expect(setPoeFocusActive).toHaveBeenCalledTimes(1);

    service.destroyAll();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(setPoeFocusActive).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("cancels crop selector selection from the temporary Escape shortcut", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();

    const selection = service.selectCropRegion();
    await flushTimers();
    const shortcutCalls = electronMocks.globalShortcutRegister.mock
      .calls as unknown as [string, () => void][];
    const escapeHandler = shortcutCalls.find(
      ([accelerator]) => accelerator === "Escape",
    )?.[1];
    escapeHandler?.();

    await expect(selection).resolves.toBeNull();
    expect(cropWindow.close).toHaveBeenCalled();
    expect(electronMocks.globalShortcutUnregister).toHaveBeenCalledWith(
      "Escape",
    );
  });

  it("reuses crop selector windows and resolves pending selections on close", async () => {
    const service = new OverlayWindowsService();
    const existingCropWindow = createFakeWindow();
    const gridLinesOverlay = getInternals(service).gridLinesOverlay as {
      createWindow(): Promise<void>;
      cropSelectorWindow: unknown;
    };
    Object.assign(gridLinesOverlay, {
      cropSelectorWindow: existingCropWindow,
    });

    await gridLinesOverlay.createWindow();
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();

    const newCropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(newCropWindow);
    const canceled = service.selectCropRegion();
    await flushTimers();
    service.cancelCropRegionSelection();
    await expect(canceled).resolves.toBeNull();

    const closingCropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(closingCropWindow);
    const selection = service.selectCropRegion();
    await flushTimers();
    const closedListener = closingCropWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];
    closedListener?.();

    await expect(selection).resolves.toBeNull();
    closedListener?.();
    expect(
      getInternals(service).gridLinesOverlay.cropSelectorWindow,
    ).toBeNull();
  });
});

describe("GameOverlayCoordinator", () => {
  it("ignores duplicate participants and unrequested overlay focus changes", async () => {
    const coordinator = new GameOverlayCoordinator();
    coordinator.setGameRunningActive(true);
    coordinator.setGameRunningActive(true);
    const participant = {
      restoreRequestedOverlay: vi.fn(),
      suspendRequestedOverlay: vi.fn(),
    };
    coordinator.register(participant);
    coordinator.register(participant);

    coordinator.setPoeFocusActive(true);
    await flushTimers();
    coordinator.setPoeFocusActive(false);

    expect(participant.restoreRequestedOverlay).toHaveBeenCalledTimes(1);
    expect(participant.suspendRequestedOverlay).toHaveBeenCalledTimes(1);

    const service = new OverlayWindowsService();
    service.setPoeFocusActive(true);
    await flushTimers();
    service.setPoeFocusActive(false);
    await flushTimers();

    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
  });

  it("suspends and restores all requested game overlays", async () => {
    const recorderWindow = createFakeWindow({ visible: true });
    const clipPreviewWindow = createFakeWindow({ visible: true });
    const service = new OverlayWindowsService();
    service.setGameRunningActive(true);
    Object.assign(getInternals(service).recordingControlsOverlay, {
      recorderOverlayRequested: true,
      recorderWindow,
    });
    Object.assign(getInternals(service).deathClipsOverlay, {
      clipPreviewOverlayRequested: true,
      clipPreviewWindow,
    });

    service.setPoeFocusActive(true);
    await flushTimers();

    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(1);
    expect(clipPreviewWindow.setOpacity).toHaveBeenCalledWith(1);

    service.setPoeFocusActive(false);
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(clipPreviewWindow.setOpacity).toHaveBeenCalledWith(0);

    service.setPoeFocusActive(false);
    expect(recorderWindow.setOpacity).toHaveBeenCalledTimes(2);
  });

  it("does not run overlapping restore passes", async () => {
    const coordinator = new GameOverlayCoordinator();
    coordinator.setGameRunningActive(true);
    let releaseRestore!: () => void;
    const restore = vi.fn(
      () =>
        new Promise<void>((resolveRestore) => {
          releaseRestore = resolveRestore;
        }),
    );
    coordinator.register({
      restoreRequestedOverlay: restore,
      suspendRequestedOverlay: vi.fn(),
    });

    coordinator.setPoeFocusActive(true);
    await Promise.resolve();
    await coordinator.applyFocusGateToGameOverlays();
    expect(restore).toHaveBeenCalledTimes(1);
    releaseRestore();
    await Promise.resolve();
  });
});

describe("OverlayWindow shared helpers", () => {
  it("shows, hides, and suspends overlay windows without changing destroyed windows", () => {
    const window = createFakeWindow();
    const destroyedWindow = createFakeWindow({ destroyed: true });

    showGameOverlayWindow(window as unknown as Electron.BrowserWindow);
    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true, "screen-saver", 1);
    expect(window.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(window.showInactive).toHaveBeenCalled();
    expect(window.moveTop).toHaveBeenCalled();

    hideGameOverlayWindow(window as unknown as Electron.BrowserWindow);
    expect(window.setOpacity).toHaveBeenCalledWith(1);
    expect(window.hide).toHaveBeenCalled();

    const hiddenWindow = createFakeWindow({ visible: false });
    const visibleWindow = createFakeWindow({ visible: true });
    suspendGameOverlayWindow(null);
    suspendGameOverlayWindow(
      destroyedWindow as unknown as Electron.BrowserWindow,
    );
    suspendGameOverlayWindow(hiddenWindow as unknown as Electron.BrowserWindow);
    suspendGameOverlayWindow(
      visibleWindow as unknown as Electron.BrowserWindow,
    );
    expect(hiddenWindow.setOpacity).not.toHaveBeenCalled();
    expect(visibleWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(visibleWindow.setOpacity).toHaveBeenCalledWith(0);

    showGameOverlayWindow(destroyedWindow as unknown as Electron.BrowserWindow);
    expect(destroyedWindow.setAlwaysOnTop).not.toHaveBeenCalled();
  });

  it("recognizes overlay routes", () => {
    const overlayWindow = createFakeWindow();
    const mainWindow = createFakeWindow({ url: "app://-/dashboard" });

    expect(
      isOverlayRendererWindow(
        overlayWindow as unknown as Electron.BrowserWindow,
      ),
    ).toBe(true);
    expect(
      isOverlayRendererWindow(mainWindow as unknown as Electron.BrowserWindow),
    ).toBe(false);
  });

  it("loads renderer URLs and files", async () => {
    electronMocks.isPackaged = false;
    const window = createFakeWindow();

    vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", "http://localhost:5173");
    await loadOverlayRenderer(
      window as unknown as Electron.BrowserWindow,
      `#/${WindowName.RecorderOverlay}`,
    );
    expect(window.loadURL).toHaveBeenCalledWith(
      `http://localhost:5173#/${WindowName.RecorderOverlay}`,
    );

    vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", "");
    vi.stubGlobal("MAIN_WINDOW_VITE_NAME", "test_window");
    await loadOverlayRenderer(
      window as unknown as Electron.BrowserWindow,
      `#/${WindowName.AuraOverlay}`,
    );
    expect(window.loadFile).toHaveBeenCalledWith(
      expect.stringContaining("test_window"),
      { hash: `/${WindowName.AuraOverlay}` },
    );

    vi.unstubAllGlobals();
    vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", "");
    await loadOverlayRenderer(
      window as unknown as Electron.BrowserWindow,
      `#/${WindowName.ClipPreviewOverlay}`,
    );
    expect(window.loadFile).toHaveBeenLastCalledWith(
      expect.stringContaining("main_window"),
      { hash: `/${WindowName.ClipPreviewOverlay}` },
    );

    expect(window.webContents.openDevTools).not.toHaveBeenCalled();
  });
});
