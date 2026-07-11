import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GridLinesOverlayService } from "~/main/modules/grid-lines-overlay";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ProfilesService } from "~/main/modules/profiles";
import {
  createFakeBrowserWindow,
  type FakeBrowserWindowOptions,
} from "~/main/test/fake-browser-window";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import {
  AuraPointPlacementSettings,
  type Profile,
  type ReplayClip,
} from "~/types";
import { GameOverlayCoordinator } from "../GameOverlayCoordinator";
import {
  hideGameOverlayWindow,
  isOverlayRendererWindow,
  loadOverlayRenderer,
  showGameOverlayWindow,
  suspendGameOverlayWindow,
} from "../OverlayWindow.shared";
import { OverlayWindowsChannel } from "../OverlayWindows.channels";
import type {
  RecorderOverlayMode,
  ShowAuraOverlayOptions,
} from "../OverlayWindows.dto";
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

const settingsStoreMocks = vi.hoisted(() => ({
  get: vi.fn(),
  onDidChange: vi.fn(),
}));

const managedRecorderMocks = vi.hoisted(() => ({
  captureMode: "rewind" as "session" | "rewind",
  getCaptureMode: vi.fn(),
  getStatus: vi.fn(),
  onDidChange: vi.fn(),
  status: {
    bufferActive: false,
    runRecordingActive: false,
  },
}));

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

vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: () => ({
      get: settingsStoreMocks.get,
      onDidChange: settingsStoreMocks.onDidChange,
    }),
  },
}));

vi.mock("~/main/modules/managed-recorder", () => ({
  ManagedRecorderService: {
    getInstance: () => ({
      getCaptureMode: managedRecorderMocks.getCaptureMode,
      getStatus: managedRecorderMocks.getStatus,
      onDidChange: managedRecorderMocks.onDidChange,
    }),
  },
}));

function createFakeWindow(options: FakeBrowserWindowOptions = {}) {
  return createFakeBrowserWindow({
    bounds: { x: 100, y: 100, width: 360, height: 96 },
    url: `app://-/${WindowName.RecorderOverlay}`,
    ...options,
  });
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
    durationSeconds: null,
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
    name: "Default Aura Profile",
    game: null,
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
    recordingControlsOverlay: Record<string, unknown>;
    auraManagerOverlays: Record<string, unknown>;
  };
}

async function flushTimers(): Promise<void> {
  await new Promise<void>((resolveFlush) => {
    setTimeout(resolveFlush, 0);
  });
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function createIpcEvent(senderId: number): Electron.IpcMainInvokeEvent {
  return {
    sender: {
      id: senderId,
    },
  } as Electron.IpcMainInvokeEvent;
}

beforeEach(() => {
  settingsStoreMocks.get.mockReset();
  settingsStoreMocks.get.mockReturnValue({
    activeGame: "poe2",
    recordingHideOverlaysFromRecording: true,
    recordingHideOverlaysFromRewind: true,
  });
  settingsStoreMocks.onDidChange.mockReset();
  settingsStoreMocks.onDidChange.mockReturnValue(vi.fn());
  managedRecorderMocks.captureMode = "rewind";
  managedRecorderMocks.status = {
    bufferActive: false,
    runRecordingActive: false,
  };
  managedRecorderMocks.getCaptureMode.mockReset();
  managedRecorderMocks.getCaptureMode.mockImplementation(
    () => managedRecorderMocks.captureMode,
  );
  managedRecorderMocks.getStatus.mockReset();
  managedRecorderMocks.getStatus.mockImplementation(
    () => managedRecorderMocks.status,
  );
  managedRecorderMocks.onDidChange.mockReset();
  managedRecorderMocks.onDidChange.mockReturnValue(vi.fn());
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
      getMode(): RecorderOverlayMode;
      isRequested(): boolean;
      hide(): void;
      isVisible(): boolean;
      setMode(mode: RecorderOverlayMode): RecorderOverlayMode;
      show(): Promise<void>;
      toggle(): Promise<void>;
    };
    const deathClipsOverlay = internals.deathClipsOverlay as {
      hide(): boolean;
      showClip(clip: ReplayClip): Promise<void>;
    };
    const auraManagerOverlays = internals.auraManagerOverlays as {
      hide(): void;
      isLocked(): boolean;
      restoreRequestedOverlay(): Promise<void>;
      setClipPreviewSuspended(suspended: boolean): void;
      setGameRunningActive(active: boolean): void;
      setLocked(locked: boolean): void;
      show(profileId?: string, options?: ShowAuraOverlayOptions): Promise<void>;
    };
    vi.spyOn(recordingControlsOverlay, "show").mockResolvedValue(undefined);
    vi.spyOn(recordingControlsOverlay, "hide").mockImplementation(
      () => undefined,
    );
    vi.spyOn(recordingControlsOverlay, "toggle").mockResolvedValue(undefined);
    vi.spyOn(recordingControlsOverlay, "isVisible").mockReturnValue(true);
    vi.spyOn(recordingControlsOverlay, "isRequested").mockReturnValue(true);
    vi.spyOn(recordingControlsOverlay, "getWindow").mockReturnValue(
      recorderWindow as unknown as Electron.BrowserWindow,
    );
    vi.spyOn(recordingControlsOverlay, "getMode").mockReturnValue("expanded");
    vi.spyOn(recordingControlsOverlay, "setMode").mockReturnValue("minimized");
    vi.spyOn(deathClipsOverlay, "showClip").mockResolvedValue(undefined);
    vi.spyOn(deathClipsOverlay, "hide").mockReturnValue(true);
    vi.spyOn(auraManagerOverlays, "restoreRequestedOverlay").mockResolvedValue(
      undefined,
    );
    vi.spyOn(auraManagerOverlays, "setClipPreviewSuspended").mockImplementation(
      () => undefined,
    );
    vi.spyOn(auraManagerOverlays, "setGameRunningActive").mockImplementation(
      () => undefined,
    );
    vi.spyOn(auraManagerOverlays, "setLocked").mockImplementation(
      () => undefined,
    );
    vi.spyOn(auraManagerOverlays, "isLocked").mockReturnValue(false);
    vi.spyOn(auraManagerOverlays, "show").mockResolvedValue(undefined);
    vi.spyOn(auraManagerOverlays, "hide").mockImplementation(() => undefined);
    const setGameRunningActive = vi.spyOn(coordinator, "setGameRunningActive");
    const setPoeFocusActive = vi.spyOn(coordinator, "setPoeFocusActive");

    await expect(service.showRecorderOverlay()).resolves.toBeUndefined();
    service.hideRecorderOverlay();
    await expect(service.toggleRecorderOverlay()).resolves.toBeUndefined();
    expect(service.isRecorderOverlayVisible()).toBe(true);
    expect(service.isRecorderOverlayRequested()).toBe(true);
    expect(service.getRecorderOverlayMode()).toBe("expanded");
    expect(service.setRecorderOverlayMode("minimized")).toBe("minimized");
    service.setGameRunningActive(true);
    service.setPoeFocusActive(true);
    await expect(service.showClipPreviewOverlay(clip)).resolves.toBeUndefined();
    await expect(service.showAuraOverlay("profile-1")).resolves.toBeUndefined();
    await expect(
      service.showAuraOverlay("profile-1", { startAddingAura: true }),
    ).resolves.toBeUndefined();
    service.setAuraOverlayLocked(false);
    expect(service.isAuraOverlayLocked()).toBe(false);
    service.hideClipPreviewOverlay();
    service.setGameRunningActive(false);

    expect(recordingControlsOverlay.show).toHaveBeenCalledTimes(1);
    expect(recordingControlsOverlay.hide).toHaveBeenCalledTimes(1);
    expect(recordingControlsOverlay.toggle).toHaveBeenCalledTimes(1);
    expect(recordingControlsOverlay.getMode).toHaveBeenCalledTimes(1);
    expect(recordingControlsOverlay.setMode).toHaveBeenCalledWith("minimized");
    expect(recordingControlsOverlay.getWindow).not.toHaveBeenCalled();
    expect(service.getRecorderWindow()).toBe(recorderWindow);
    expect(setGameRunningActive).toHaveBeenCalledWith(true);
    expect(auraManagerOverlays.setGameRunningActive).toHaveBeenCalledWith(true);
    expect(auraManagerOverlays.setLocked).toHaveBeenCalledWith(false);
    expect(auraManagerOverlays.show).toHaveBeenCalledWith("profile-1");
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    expect(deathClipsOverlay.showClip).toHaveBeenCalledWith(clip);
    expect(deathClipsOverlay.showClip).toHaveBeenCalledTimes(1);
    expect(auraManagerOverlays.setClipPreviewSuspended).toHaveBeenCalledWith(
      true,
    );
    expect(auraManagerOverlays.show).toHaveBeenCalledWith("profile-1", {
      startAddingAura: true,
    });
    expect(deathClipsOverlay.hide).toHaveBeenCalledTimes(1);
  });

  it("restores clip preview resources after failures and guards repeated transitions", async () => {
    const service = new OverlayWindowsService();
    const internals = service as unknown as {
      auraManagerOverlays: {
        restoreRequestedOverlay(): Promise<void>;
        setClipPreviewSuspended(suspended: boolean): void;
      };
      clipPreviewResourceRestoreEnabled: boolean;
      deathClipsOverlay: {
        isRequested(): boolean;
        showClip(clip: ReplayClip): Promise<void>;
      };
      restoreClipPreviewResources(): void;
      suspendClipPreviewResources(): void;
    };
    const setClipPreviewSuspended = vi
      .spyOn(internals.auraManagerOverlays, "setClipPreviewSuspended")
      .mockImplementation(() => undefined);
    const restoreRequestedOverlay = vi
      .spyOn(internals.auraManagerOverlays, "restoreRequestedOverlay")
      .mockResolvedValue(undefined);
    vi.spyOn(internals.deathClipsOverlay, "showClip").mockRejectedValue(
      new Error("preview failed"),
    );

    await expect(
      service.showClipPreviewOverlay({} as ReplayClip),
    ).rejects.toThrow("preview failed");
    expect(setClipPreviewSuspended).toHaveBeenNthCalledWith(1, true);
    expect(setClipPreviewSuspended).toHaveBeenNthCalledWith(2, false);
    expect(restoreRequestedOverlay).toHaveBeenCalledTimes(1);

    setClipPreviewSuspended.mockClear();
    restoreRequestedOverlay.mockClear();
    vi.spyOn(internals.deathClipsOverlay, "isRequested").mockReturnValue(true);
    await expect(
      service.showClipPreviewOverlay({} as ReplayClip),
    ).rejects.toThrow("preview failed");
    expect(setClipPreviewSuspended).toHaveBeenCalledOnce();
    expect(setClipPreviewSuspended).toHaveBeenCalledWith(true);
    expect(restoreRequestedOverlay).not.toHaveBeenCalled();
    internals.restoreClipPreviewResources();

    setClipPreviewSuspended.mockClear();
    restoreRequestedOverlay.mockClear();
    internals.suspendClipPreviewResources();
    internals.suspendClipPreviewResources();
    expect(setClipPreviewSuspended).toHaveBeenCalledTimes(1);
    expect(setClipPreviewSuspended).toHaveBeenCalledWith(true);

    internals.clipPreviewResourceRestoreEnabled = false;
    internals.restoreClipPreviewResources();
    internals.restoreClipPreviewResources();
    expect(setClipPreviewSuspended).toHaveBeenCalledTimes(2);
    expect(setClipPreviewSuspended).toHaveBeenLastCalledWith(false);
    expect(restoreRequestedOverlay).not.toHaveBeenCalled();
  });

  it("applies the overlay capture protection setting to open overlay windows", async () => {
    let handleSettingsChange:
      | ((settings: {
          recordingHideOverlaysFromRecording: boolean;
          recordingHideOverlaysFromRewind: boolean;
        }) => void)
      | null = null;
    let handleRecorderChange:
      | ((snapshot: {
          captureMode: "session" | "rewind";
          status: { bufferActive: boolean; runRecordingActive: boolean };
        }) => void)
      | null = null;
    settingsStoreMocks.get.mockReturnValue({
      activeGame: "poe2",
      recordingHideOverlaysFromRecording: false,
      recordingHideOverlaysFromRewind: false,
    });
    settingsStoreMocks.onDidChange.mockImplementation((listener) => {
      handleSettingsChange = listener;
      return vi.fn();
    });
    managedRecorderMocks.onDidChange.mockImplementation((listener) => {
      handleRecorderChange = listener;
      return vi.fn();
    });
    const recorderWindow = createFakeWindow();
    const clipPreviewWindow = createFakeWindow();
    const cropSelectorWindow = createFakeWindow();
    const auraWindow = createFakeWindow();
    const service = new OverlayWindowsService();
    Object.assign(getInternals(service).recordingControlsOverlay, {
      recorderWindow,
    });
    Object.assign(getInternals(service).deathClipsOverlay, {
      clipPreviewWindow,
    });
    Object.assign(getInternals(service).gridLinesOverlay, {
      cropSelectorWindow,
    });
    Object.assign(getInternals(service).auraManagerOverlays, {
      auraWindow,
    });

    expect(handleSettingsChange).not.toBeNull();
    expect(handleRecorderChange).not.toBeNull();
    const notifySettingsChange = handleSettingsChange as unknown as (settings: {
      recordingHideOverlaysFromRecording: boolean;
      recordingHideOverlaysFromRewind: boolean;
    }) => void;
    const notifyRecorderChange = handleRecorderChange as unknown as (snapshot: {
      captureMode: "session" | "rewind";
      status: { bufferActive: boolean; runRecordingActive: boolean };
    }) => void;

    notifySettingsChange({
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: false,
    });

    expect(recorderWindow.setContentProtection).toHaveBeenLastCalledWith(false);
    expect(clipPreviewWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    expect(cropSelectorWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    expect(auraWindow.setContentProtection).toHaveBeenLastCalledWith(false);

    notifySettingsChange({
      recordingHideOverlaysFromRecording: false,
      recordingHideOverlaysFromRewind: true,
    });

    expect(recorderWindow.setContentProtection).toHaveBeenLastCalledWith(true);
    expect(clipPreviewWindow.setContentProtection).toHaveBeenLastCalledWith(
      true,
    );
    expect(cropSelectorWindow.setContentProtection).toHaveBeenLastCalledWith(
      true,
    );
    expect(auraWindow.setContentProtection).toHaveBeenLastCalledWith(true);

    notifyRecorderChange({
      captureMode: "rewind",
      status: { bufferActive: false, runRecordingActive: true },
    });

    expect(recorderWindow.setContentProtection).toHaveBeenLastCalledWith(false);
    expect(clipPreviewWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    expect(cropSelectorWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    expect(auraWindow.setContentProtection).toHaveBeenLastCalledWith(false);

    notifySettingsChange({
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: false,
    });

    expect(recorderWindow.setContentProtection).toHaveBeenLastCalledWith(true);
    expect(clipPreviewWindow.setContentProtection).toHaveBeenLastCalledWith(
      true,
    );
    expect(cropSelectorWindow.setContentProtection).toHaveBeenLastCalledWith(
      true,
    );
    expect(auraWindow.setContentProtection).toHaveBeenLastCalledWith(true);

    notifyRecorderChange({
      captureMode: "rewind",
      status: { bufferActive: true, runRecordingActive: false },
    });

    expect(recorderWindow.setContentProtection).toHaveBeenLastCalledWith(false);
    expect(clipPreviewWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    expect(cropSelectorWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    expect(auraWindow.setContentProtection).toHaveBeenLastCalledWith(false);

    notifySettingsChange({
      recordingHideOverlaysFromRecording: false,
      recordingHideOverlaysFromRewind: false,
    });

    expect(recorderWindow.setContentProtection).toHaveBeenLastCalledWith(false);
    expect(clipPreviewWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    expect(cropSelectorWindow.setContentProtection).toHaveBeenLastCalledWith(
      false,
    );
    expect(auraWindow.setContentProtection).toHaveBeenLastCalledWith(false);
  });

  it("uses a focus handoff when toggling the recorder overlay from the appbar", async () => {
    const recorderWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(recorderWindow);
    const service = new OverlayWindowsService();

    service.setGameRunningActive(true);
    service.setPoeFocusActive(false);

    await service.toggleRecorderOverlay();

    expect(recorderWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(1);
    expect(recorderWindow.showInactive).toHaveBeenCalled();
  });

  it("requests persistent aura overlays without assuming game focus when the game becomes running", () => {
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
    const setPoeFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setPoeFocusActive",
    );

    service.setGameRunningActive(true);
    service.setGameRunningActive(true);

    expect(setPoeFocusActive).not.toHaveBeenCalled();
    expect(auraManagerOverlays.show).toHaveBeenCalledTimes(1);
    expect(auraManagerOverlays.show).toHaveBeenCalledWith("profile-1");
  });

  it("does not assume game focus from the running process after focus is lost", () => {
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
    const setPoeFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setPoeFocusActive",
    );

    service.setPoeFocusActive(false);
    service.setGameRunningActive(true);

    expect(setPoeFocusActive).toHaveBeenCalledWith(false);
    expect(setPoeFocusActive).not.toHaveBeenCalledWith(true);
  });

  it("does not assume game focus from the running process after system suspend", () => {
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
      setGameRunningActive(active: boolean): void;
      suspendForSystem(): void;
    };
    vi.spyOn(recordingControlsOverlay, "suspendForSystem").mockImplementation(
      () => undefined,
    );
    vi.spyOn(deathClipsOverlay, "destroy").mockImplementation(() => undefined);
    vi.spyOn(gridLinesOverlay, "destroy").mockImplementation(() => undefined);
    vi.spyOn(auraManagerOverlays, "setGameRunningActive").mockImplementation(
      () => undefined,
    );
    vi.spyOn(auraManagerOverlays, "suspendForSystem").mockImplementation(
      () => undefined,
    );
    const setPoeFocusActive = vi.spyOn(
      internals.coordinator,
      "setPoeFocusActive",
    );

    service.suspendForSystem();
    expect(setPoeFocusActive).toHaveBeenCalledWith(false);
    setPoeFocusActive.mockClear();

    service.setGameRunningActive(false);
    service.setGameRunningActive(true);

    expect(setPoeFocusActive).not.toHaveBeenCalledWith(true);

    service.setPoeFocusActive(true);
    setPoeFocusActive.mockClear();
    service.setGameRunningActive(false);
    service.setGameRunningActive(true);

    expect(setPoeFocusActive).not.toHaveBeenCalled();
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

  it("does not reopen an editable aura overlay after the game restarts", async () => {
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [createProfile()],
    } as unknown as ProfilesService);
    const firstWindow = createFakeWindow({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      url: `app://-/${WindowName.AuraOverlay}`,
    });
    const restoredWindow = createFakeWindow({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      url: `app://-/${WindowName.AuraOverlay}`,
    });
    electronMocks.browserWindowFactory
      .mockReturnValueOnce(firstWindow)
      .mockReturnValueOnce(restoredWindow);
    const service = new OverlayWindowsService();

    await service.showAuraOverlay("profile-1");
    service.setGameRunningActive(true);
    await flushTimers();

    service.setAuraOverlayLocked(false);
    service.setGameRunningActive(false);
    service.setGameRunningActive(true);
    await flushTimers();

    expect(service.isAuraOverlayLocked()).toBe(true);
    expect(firstWindow.close).toHaveBeenCalledTimes(1);
    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(restoredWindow.loadFile).not.toHaveBeenCalled();
  });

  it("keeps overlays eligible during aura focus handoff grace", async () => {
    vi.useFakeTimers();
    const service = new OverlayWindowsService();
    const coordinator = getInternals(service).coordinator as {
      setOverlayFocusActive(overlayId: string, active: boolean): void;
      setPoeFocusActive(active: boolean): void;
    };
    const setOverlayFocusActive = vi.spyOn(
      coordinator,
      "setOverlayFocusActive",
    );
    const setPoeFocusActive = vi.spyOn(coordinator, "setPoeFocusActive");

    service.setGameRunningActive(true);
    setPoeFocusActive.mockClear();
    service.setAuraOverlayLocked(true);

    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "active-game-focus-handoff",
      true,
    );
    service.setPoeFocusActive(true);
    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "active-game-focus-handoff",
      false,
    );
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);

    setOverlayFocusActive.mockClear();
    setPoeFocusActive.mockClear();
    service.setAuraOverlayLocked(true);
    service.setGameRunningActive(false);

    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "active-game-focus-handoff",
      true,
    );
    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "active-game-focus-handoff",
      false,
    );
  });

  it("keeps requested overlays eligible during aura lock handoff grace", async () => {
    vi.useFakeTimers();
    const service = new OverlayWindowsService();
    service.setGameRunningActive(true);
    service.setPoeFocusActive(false);
    await flushPromises();
    const participant = {
      restoreRequestedOverlay: vi.fn(),
      suspendRequestedOverlay: vi.fn(),
    };
    getInternals(service).coordinator.register(participant);

    service.setAuraOverlayLocked(true);
    await flushPromises();

    expect(participant.restoreRequestedOverlay).toHaveBeenCalled();
    expect(participant.suspendRequestedOverlay).not.toHaveBeenCalled();

    participant.restoreRequestedOverlay.mockClear();
    await vi.advanceTimersByTimeAsync(2_499);
    await flushPromises();
    expect(participant.suspendRequestedOverlay).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(participant.suspendRequestedOverlay).toHaveBeenCalled();
  });

  it("keeps requested overlays eligible during clip preview close handoff grace", async () => {
    vi.useFakeTimers();
    const service = new OverlayWindowsService();
    service.setGameRunningActive(true);
    service.setPoeFocusActive(false);
    await flushPromises();
    const deathClipsOverlay = getInternals(service).deathClipsOverlay as {
      hide(): boolean;
    };
    vi.spyOn(deathClipsOverlay, "hide").mockReturnValue(true);
    const participant = {
      restoreRequestedOverlay: vi.fn(),
      suspendRequestedOverlay: vi.fn(),
    };
    getInternals(service).coordinator.register(participant);
    await flushPromises();
    participant.restoreRequestedOverlay.mockClear();
    participant.suspendRequestedOverlay.mockClear();

    service.hideClipPreviewOverlay();
    await flushPromises();

    expect(participant.restoreRequestedOverlay).toHaveBeenCalled();
    expect(participant.suspendRequestedOverlay).not.toHaveBeenCalled();

    participant.restoreRequestedOverlay.mockClear();
    await vi.advanceTimersByTimeAsync(2_499);
    await flushPromises();
    expect(participant.suspendRequestedOverlay).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(participant.suspendRequestedOverlay).toHaveBeenCalled();
  });

  it("does not start clip preview handoff when no clip preview closed", async () => {
    vi.useFakeTimers();
    const service = new OverlayWindowsService();
    service.setGameRunningActive(true);
    service.setPoeFocusActive(false);
    const participant = {
      restoreRequestedOverlay: vi.fn(),
      suspendRequestedOverlay: vi.fn(),
    };
    getInternals(service).coordinator.register(participant);
    await flushPromises();
    participant.restoreRequestedOverlay.mockClear();
    participant.suspendRequestedOverlay.mockClear();

    service.hideClipPreviewOverlay();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2_500);
    await flushPromises();

    expect(participant.restoreRequestedOverlay).not.toHaveBeenCalled();
    expect(participant.suspendRequestedOverlay).not.toHaveBeenCalled();
  });

  it("wires death clip preview anchor bounds to the recorder overlay", async () => {
    const clipWindow = createFakeWindow();
    const recorderWindow = createFakeWindow();
    recorderWindow.getBounds.mockReturnValue({
      x: 20,
      y: 30,
      width: 420,
      height: 56,
    });
    electronMocks.browserWindowFactory.mockReturnValue(clipWindow);
    const service = new OverlayWindowsService();
    Object.assign(getInternals(service).recordingControlsOverlay, {
      recorderWindow,
    });
    service.setPoeFocusActive(true);

    await service.showClipPreviewOverlay(createClip());

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 20,
        y: 94,
        width: 560,
        height: 520,
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
    vi.spyOn(service, "isRecorderOverlayRequested").mockReturnValue(true);
    const getRecorderOverlayMode = vi
      .spyOn(service, "getRecorderOverlayMode")
      .mockReturnValue("expanded");
    const setRecorderOverlayMode = vi
      .spyOn(service, "setRecorderOverlayMode")
      .mockReturnValue("minimized");
    const hideClipPreviewOverlay = vi.spyOn(service, "hideClipPreviewOverlay");
    const showAuraOverlay = vi
      .spyOn(service, "showAuraOverlay")
      .mockResolvedValue(undefined);
    vi.spyOn(service, "isAuraOverlayLocked").mockReturnValue(false);
    const setAuraOverlayLocked = vi.spyOn(service, "setAuraOverlayLocked");
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
    expect(
      await handlers.get(OverlayWindowsChannel.IsRecorderRequested)?.({}),
    ).toBe(true);
    expect(
      await handlers.get(OverlayWindowsChannel.GetRecorderMode)?.({}),
    ).toBe("expanded");
    expect(
      await handlers.get(OverlayWindowsChannel.SetRecorderMode)?.(
        {},
        "minimized",
      ),
    ).toBe("minimized");
    handlers.get(OverlayWindowsChannel.HideClipPreview)?.({});
    await handlers.get(OverlayWindowsChannel.ShowAura)?.({});
    await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, "profile-1");
    await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, "profile-1", {
      startAddingAura: true,
    });
    await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, "profile-1", {
      startAddingAura: false,
    });
    await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, "profile-1", {
      addAuraShape: "arc",
      startAddingAura: true,
    });
    expect(await handlers.get(OverlayWindowsChannel.IsAuraLocked)?.({})).toBe(
      false,
    );
    handlers.get(OverlayWindowsChannel.SetAuraLocked)?.({}, false);
    handlers.get(OverlayWindowsChannel.SetAuraLocked)?.(auraOverlayEvent, true);
    await handlers.get(OverlayWindowsChannel.SelectCropRegion)?.({});
    await handlers.get(OverlayWindowsChannel.SelectCropRegion)?.(
      auraOverlayEvent,
    );
    await handlers.get(OverlayWindowsChannel.SelectCropRegion)?.(
      auraOverlayEvent,
      {},
    );
    await handlers.get(OverlayWindowsChannel.SelectCropRegion)?.(
      auraOverlayEvent,
      { shape: "arc" },
    );
    handlers.get(OverlayWindowsChannel.CompleteCropRegionSelection)?.(
      {},
      { x: 1, y: 2, width: 10, height: 10 },
    );
    handlers.get(OverlayWindowsChannel.CancelCropRegionSelection)?.({});

    expect(showRecorderOverlay).toHaveBeenCalled();
    expect(hideRecorderOverlay).toHaveBeenCalled();
    expect(toggleRecorderOverlay).toHaveBeenCalled();
    expect(getRecorderOverlayMode).toHaveBeenCalled();
    expect(setRecorderOverlayMode).toHaveBeenCalledWith("minimized");
    expect(hideClipPreviewOverlay).toHaveBeenCalled();
    expect(showAuraOverlay).toHaveBeenCalledWith(undefined);
    expect(showAuraOverlay).toHaveBeenCalledWith("profile-1");
    expect(showAuraOverlay).toHaveBeenCalledWith("profile-1", {
      startAddingAura: true,
    });
    expect(showAuraOverlay).toHaveBeenCalledWith("profile-1", {});
    expect(showAuraOverlay).toHaveBeenCalledWith("profile-1", {
      addAuraShape: "arc",
      startAddingAura: true,
    });
    expect(setAuraOverlayLocked).toHaveBeenCalledWith(false);
    expect(setAuraOverlayLocked).toHaveBeenCalledWith(true);
    expect(selectCropRegion).toHaveBeenCalledTimes(4);
    expect(selectCropRegion).toHaveBeenCalledWith({ shape: "arc" });
    expect(completeCropRegionSelection).toHaveBeenCalled();
    expect(cancelCropRegionSelection).toHaveBeenCalled();

    expect(
      await handlers.get(OverlayWindowsChannel.SetAuraLocked)?.({}, "false"),
    ).toEqual({
      ok: false,
      error: "locked must be a boolean",
    });
    expect(
      await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, 123),
    ).toEqual({
      ok: false,
      error: "profileId must be a string",
    });
    expect(
      await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, ""),
    ).toEqual({
      ok: false,
      error: "profileId is too short",
    });
    expect(
      await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, "x".repeat(129)),
    ).toEqual({
      ok: false,
      error: "profileId is too long",
    });
    expect(
      await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, "profile-1", {
        startAddingAura: "yes",
      }),
    ).toEqual({
      ok: false,
      error: "startAddingAura must be a boolean",
    });
    expect(
      await handlers.get(OverlayWindowsChannel.ShowAura)?.({}, "profile-1", {
        addAuraShape: "moon",
      }),
    ).toEqual({
      ok: false,
      error: "shape must be rect, arc, or points",
    });
    expect(
      await handlers.get(OverlayWindowsChannel.SelectCropRegion)?.(
        auraOverlayEvent,
        { shape: "moon" },
      ),
    ).toEqual({
      ok: false,
      error: "shape must be rect, arc, or points",
    });
    expect(
      await handlers.get(OverlayWindowsChannel.SetRecorderMode)?.(
        {},
        "compact",
      ),
    ).toEqual({
      ok: false,
      error: "mode must be expanded or minimized",
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
    const setOverlayFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setOverlayFocusActive",
    );

    const selection = service.selectCropRegion();
    await flushTimers();
    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "crop-selector-overlay",
      true,
    );
    expect(cropWindow.focus).toHaveBeenCalledTimes(1);
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
    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "crop-selector-overlay",
      false,
    );
    expect(cropWindow.close).toHaveBeenCalled();

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

    const unknownShapeSelection = service.selectCropRegion();
    await flushTimers();
    service.completeCropRegionSelection({
      shape: "moon",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    });
    service.cancelCropRegionSelection();
    await expect(unknownShapeSelection).resolves.toBeNull();

    const missingArcSelection = service.selectCropRegion({ shape: "arc" });
    await flushTimers();
    service.completeCropRegionSelection({
      shape: "arc",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    });
    service.cancelCropRegionSelection();
    await expect(missingArcSelection).resolves.toBeNull();

    const thinArcSelection = service.selectCropRegion({ shape: "arc" });
    await flushTimers();
    service.completeCropRegionSelection({
      shape: "arc",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      arc: {
        startX: 10,
        startY: 70,
        endX: 90,
        endY: 70,
        controlX: 50,
        controlY: 10,
        thickness: 2,
      },
    });
    service.cancelCropRegionSelection();
    await expect(thinArcSelection).resolves.toBeNull();
  });

  it("uses disabled content protection by default", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new GridLinesOverlayService(coordinator);

    const selection = service.selectCropRegion();
    await flushTimers();

    expect(cropWindow.setContentProtection).toHaveBeenCalledWith(false);

    service.cancelCropRegionSelection();
    await expect(selection).resolves.toBeNull();
  });

  it("loads and resolves arched crop selector selections", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();

    const selection = service.selectCropRegion({ shape: "arc" });
    await flushTimers();

    expect(cropWindow.loadFile).toHaveBeenCalledWith(expect.any(String), {
      hash: `/${WindowName.CropSelectorOverlay}?shape=arc`,
    });

    service.completeCropRegionSelection({
      shape: "arc",
      x: 90,
      y: 90,
      width: 140,
      height: 80,
      arc: {
        startX: 10,
        startY: 70,
        endX: 130,
        endY: 70,
        controlX: 70,
        controlY: 10,
        thickness: 20,
      },
    });

    await expect(selection).resolves.toMatchObject({
      shape: "arc",
      x: 90,
      y: 90,
      width: 140,
      height: 80,
      arc: {
        controlX: 70,
        controlY: 10,
        thickness: 20,
      },
    });
  });

  it("ignores arched crop selector selections outside crop bounds", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();

    const selection = service.selectCropRegion({ shape: "arc" });
    await flushTimers();

    for (const arc of [
      {
        startX: 141,
        startY: 70,
        endX: 130,
        endY: 70,
        controlX: 70,
        controlY: 10,
        thickness: 20,
      },
      {
        startX: 10,
        startY: -1,
        endX: 130,
        endY: 70,
        controlX: 70,
        controlY: 10,
        thickness: 20,
      },
      {
        startX: 10,
        startY: 70,
        endX: 130,
        endY: 70,
        controlX: 70,
        controlY: 81,
        thickness: 20,
      },
    ]) {
      service.completeCropRegionSelection({
        shape: "arc",
        x: 90,
        y: 90,
        width: 140,
        height: 80,
        arc,
      });
    }

    service.completeCropRegionSelection({
      shape: "arc",
      x: 90,
      y: 90,
      width: 140,
      height: 80,
      arc: {
        startX: 10,
        startY: 70,
        endX: 130,
        endY: 70,
        controlX: 70,
        controlY: 10,
        thickness: 20,
      },
    });

    await expect(selection).resolves.toMatchObject({
      shape: "arc",
      arc: {
        controlX: 70,
        controlY: 10,
      },
    });
  });

  it("loads and resolves pointer crop selector selections", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();

    const selection = service.selectCropRegion({ shape: "points" });
    await flushTimers();

    expect(cropWindow.loadFile).toHaveBeenCalledWith(expect.any(String), {
      hash: `/${WindowName.CropSelectorOverlay}?shape=points`,
    });

    service.completeCropRegionSelection({
      shape: "points",
      x: 90,
      y: 90,
      width: 40,
      height: 80,
      points: [
        { x: 5, y: 5 },
        { x: 30, y: 70 },
      ],
    });

    await expect(selection).resolves.toMatchObject({
      shape: "points",
      x: 90,
      y: 90,
      width: 40,
      height: 80,
      points: [
        { x: 5, y: 5 },
        { x: 30, y: 70 },
      ],
    });
  });

  it("ignores invalid pointer crop selector selections", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();

    const selection = service.selectCropRegion({ shape: "points" });
    await flushTimers();

    const tooManyPoints = Array.from(
      { length: AuraPointPlacementSettings.maxPoints + 1 },
      (_, index) => ({ x: index, y: index }),
    );
    for (const points of [
      undefined,
      [],
      tooManyPoints,
      [null],
      [{ x: "bad", y: 1 }],
      [{ x: 1, y: "bad" }],
      [{ x: -1, y: 5 }],
      [{ x: 41, y: 5 }],
      [{ x: 5, y: 81 }],
    ]) {
      service.completeCropRegionSelection({
        shape: "points",
        x: 90,
        y: 90,
        width: 40,
        height: 80,
        points,
      });
    }

    service.completeCropRegionSelection({
      shape: "points",
      x: 90,
      y: 90,
      width: 40,
      height: 80,
      points: [{ x: 5, y: 5 }],
    });

    await expect(selection).resolves.toMatchObject({
      shape: "points",
      points: [{ x: 5, y: 5 }],
    });
  });

  it("tracks native crop selector focus changes", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();
    const setOverlayFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setOverlayFocusActive",
    );

    const selection = service.selectCropRegion();
    await flushTimers();
    const focusListener = cropWindow.on.mock.calls.find(
      ([eventName]) => eventName === "focus",
    )?.[1];
    const blurListener = cropWindow.on.mock.calls.find(
      ([eventName]) => eventName === "blur",
    )?.[1];
    setOverlayFocusActive.mockClear();

    blurListener?.();
    focusListener?.();

    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "crop-selector-overlay",
      false,
    );
    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "crop-selector-overlay",
      true,
    );

    service.cancelCropRegionSelection();
    await expect(selection).resolves.toBeNull();
  });

  it("suspends crop selector selection on native blur and restores it on game focus", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();
    service.setGameRunningActive(true);
    service.setPoeFocusActive(true);
    const setOverlayFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setOverlayFocusActive",
    );

    const selection = service.selectCropRegion();
    await flushTimers();
    const blurListener = cropWindow.on.mock.calls.find(
      ([eventName]) => eventName === "blur",
    )?.[1];

    service.setPoeFocusActive(false);
    await flushTimers();

    expect(cropWindow.setOpacity).not.toHaveBeenCalledWith(0);
    expect(cropWindow.setIgnoreMouseEvents).not.toHaveBeenCalledWith(true);

    blurListener?.();
    await flushTimers();

    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "crop-selector-overlay",
      false,
    );
    expect(cropWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(cropWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);

    service.setPoeFocusActive(true);
    await flushTimers();

    expect(cropWindow.setOpacity).toHaveBeenCalledWith(1);
    expect(cropWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(cropWindow.focus).toHaveBeenCalledTimes(2);

    service.cancelCropRegionSelection();
    await expect(selection).resolves.toBeNull();
    expect(cropWindow.close).toHaveBeenCalled();
    expect(electronMocks.globalShortcutUnregister).toHaveBeenCalledWith(
      "Escape",
    );
    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "crop-selector-overlay",
      false,
    );
  });

  it("keeps aura overlays visible while the crop selector is active", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();
    service.setGameRunningActive(true);
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [createProfile()],
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow({ visible: true });
    Object.assign(getInternals(service).auraManagerOverlays, {
      auraOverlayProfileId: "profile-1",
      auraOverlayRequested: true,
      auraWindow,
    });

    const selection = service.selectCropRegion();
    await flushTimers();
    service.setPoeFocusActive(true);
    await flushTimers();
    service.setPoeFocusActive(false);
    await flushTimers();

    expect(auraWindow.setOpacity).not.toHaveBeenCalledWith(0);

    service.cancelCropRegionSelection();
    await expect(selection).resolves.toBeNull();
    service.setPoeFocusActive(true);
    await flushTimers();
    service.setPoeFocusActive(false);
    await flushTimers();

    expect(auraWindow.setOpacity).toHaveBeenCalledWith(0);
  });

  it("suppresses the recorder overlay while the crop selector is active", async () => {
    const recorderWindow = createFakeWindow();
    const cropWindow = createFakeWindow();
    const mainWindow = createFakeWindow({ url: "app://-/dashboard" });
    electronMocks.browserWindowFactory
      .mockReturnValueOnce(recorderWindow)
      .mockReturnValueOnce(cropWindow);
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow as unknown as Electron.BrowserWindow,
    ]);
    const service = new OverlayWindowsService();

    service.setGameRunningActive(true);
    service.setPoeFocusActive(true);
    await service.showRecorderOverlay();
    expect(service.isRecorderOverlayVisible()).toBe(true);

    mainWindow.webContents.send.mockClear();
    recorderWindow.showInactive.mockClear();

    const selection = service.selectCropRegion();
    await flushTimers();

    expect(service.isRecorderOverlayVisible()).toBe(false);
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      false,
    );

    mainWindow.webContents.send.mockClear();
    recorderWindow.setOpacity.mockClear();
    service.cancelCropRegionSelection();
    await expect(selection).resolves.toBeNull();
    await flushTimers();

    expect(service.isRecorderOverlayVisible()).toBe(true);
    expect(recorderWindow.setOpacity).toHaveBeenLastCalledWith(1);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      true,
    );
  });

  it("suppresses the recorder overlay only while the aura overlay is unlocked", async () => {
    const recorderWindow = createFakeWindow();
    const auraWindow = createFakeWindow({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      url: `app://-/${WindowName.AuraOverlay}`,
    });
    const mainWindow = createFakeWindow({ url: "app://-/dashboard" });
    electronMocks.browserWindowFactory
      .mockReturnValueOnce(recorderWindow)
      .mockReturnValueOnce(auraWindow);
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow as unknown as Electron.BrowserWindow,
    ]);
    const service = new OverlayWindowsService();

    service.setGameRunningActive(true);
    service.setPoeFocusActive(true);
    await service.showRecorderOverlay();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [createProfile()],
    } as unknown as ProfilesService);

    mainWindow.webContents.send.mockClear();
    recorderWindow.showInactive.mockClear();

    await service.showAuraOverlay("profile-1");

    expect(auraWindow.showInactive).toHaveBeenCalled();
    expect(service.isRecorderOverlayVisible()).toBe(true);
    expect(recorderWindow.setOpacity).not.toHaveBeenCalledWith(0);
    expect(mainWindow.webContents.send).not.toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      false,
    );

    service.setAuraOverlayLocked(false);

    expect(service.isRecorderOverlayVisible()).toBe(false);
    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      false,
    );

    mainWindow.webContents.send.mockClear();
    recorderWindow.setOpacity.mockClear();
    service.setAuraOverlayLocked(true);
    await flushTimers();

    expect(service.isRecorderOverlayVisible()).toBe(true);
    expect(recorderWindow.setOpacity).toHaveBeenLastCalledWith(1);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.RecorderVisibilityChanged,
      true,
    );
  });

  it("starts an active-game handoff before releasing crop selector focus", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();
    service.setGameRunningActive(true);
    service.setPoeFocusActive(false);
    const setOverlayFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setOverlayFocusActive",
    );

    const selection = service.selectCropRegion();
    await flushTimers();
    service.cancelCropRegionSelection();

    await expect(selection).resolves.toBeNull();
    const handoffStartIndex = setOverlayFocusActive.mock.calls.findIndex(
      ([overlayId, active]) =>
        overlayId === "active-game-focus-handoff" && active === true,
    );
    const cropReleaseIndex = setOverlayFocusActive.mock.calls.findIndex(
      ([overlayId, active]) =>
        overlayId === "crop-selector-overlay" && active === false,
    );
    expect(handoffStartIndex).toBeGreaterThanOrEqual(0);
    expect(cropReleaseIndex).toBeGreaterThanOrEqual(0);
    expect(handoffStartIndex).toBeLessThan(cropReleaseIndex);
  });

  it("does not start an active-game handoff during crop selector cleanup", async () => {
    const cropWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(cropWindow);
    const service = new OverlayWindowsService();
    service.setGameRunningActive(true);
    service.setPoeFocusActive(false);
    const setOverlayFocusActive = vi.spyOn(
      getInternals(service).coordinator,
      "setOverlayFocusActive",
    );

    const selection = service.selectCropRegion();
    await flushTimers();
    setOverlayFocusActive.mockClear();
    service.suspendForSystem();

    await expect(selection).resolves.toBeNull();
    expect(setOverlayFocusActive).toHaveBeenCalledWith(
      "crop-selector-overlay",
      false,
    );
    expect(setOverlayFocusActive).not.toHaveBeenCalledWith(
      "active-game-focus-handoff",
      true,
    );
  });

  it("omits invalid viewport sizes without forcing PoE focus active", async () => {
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

    service.destroyAll();
    expect(setPoeFocusActive).not.toHaveBeenCalled();
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

    coordinator.setOverlayFocusActive("recorder", true);
    await flushTimers();
    coordinator.setOverlayFocusActive("recorder", false);

    expect(participant.restoreRequestedOverlay).toHaveBeenCalledTimes(2);
    expect(participant.suspendRequestedOverlay).toHaveBeenCalledTimes(2);

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
    Object.assign(getInternals(service).recordingControlsOverlay, {
      recorderOverlayRequested: true,
      recorderWindow,
    });
    Object.assign(getInternals(service).deathClipsOverlay, {
      clipPreviewOverlayRequested: true,
      clipPreviewWindow,
    });

    service.setGameRunningActive(true);
    await flushTimers();

    expect(recorderWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(clipPreviewWindow.setOpacity).toHaveBeenCalledWith(0);
    recorderWindow.setOpacity.mockClear();
    clipPreviewWindow.setOpacity.mockClear();

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
