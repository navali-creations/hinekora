import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import { OverlayWindowsChannel } from "~/main/modules/overlay-windows/OverlayWindows.channels";
import { ProfilesService } from "~/main/modules/profiles";
import {
  createFakeBrowserWindow,
  type FakeBrowserWindowOptions,
} from "~/main/test/fake-browser-window";

import { createDefaultProfile, type Profile } from "~/types";
import { AuraManagerOverlaysService } from "../AuraManagerOverlays.service";

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
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    url: `app://-/${WindowName.AuraOverlay}`,
    ...options,
  });
}

function createDisplay() {
  return {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  } as Electron.Display;
}

function createAuraProfile(update: Partial<Profile> = {}): Profile {
  const profile = {
    ...createDefaultProfile({ name: "Default", game: "poe1" }),
    id: "profile-1",
    cropRegions: [
      {
        id: "crop-1",
        label: "Life",
        x: 10,
        y: 20,
        width: 100,
        height: 40,
      },
      {
        id: "crop-2",
        label: "Mana",
        x: 100,
        y: 120,
        width: 80,
        height: 36,
      },
    ],
    overlayPlacements: [
      {
        id: "placement-1",
        cropRegionId: "crop-1",
        x: 30,
        y: 40,
        scale: 0.5,
        opacity: 1,
      },
      {
        id: "placement-2",
        cropRegionId: "crop-2",
        x: 300,
        y: 340,
        scale: 1,
        opacity: 0.8,
      },
    ],
  };

  return { ...profile, ...update };
}

function getInternals(service: AuraManagerOverlaysService) {
  return service as unknown as {
    auraOverlayProfileId: string | undefined;
    auraOverlayRequested: boolean;
    auraWindow: unknown;
    auraWindowProfileId: string | undefined;
    restoreRequestedOverlay(): Promise<void>;
  };
}

async function flushTimers(): Promise<void> {
  await new Promise<void>((resolveFlush) => {
    setTimeout(resolveFlush, 0);
  });
}

beforeEach(() => {
  electronMocks.getAllWindows.mockReturnValue([]);
  electronMocks.getPrimaryDisplay.mockReturnValue(createDisplay());
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

describe("AuraManagerOverlaysService", () => {
  it("shows one click-through full-display aura overlay for all placements", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id);

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        minWidth: 1920,
        minHeight: 1080,
        title: "Hinekora Aura Overlay",
        focusable: false,
        frame: false,
        skipTaskbar: true,
        transparent: true,
        webPreferences: expect.objectContaining({ sandbox: true }),
      }),
    );
    expect(auraWindow.loadFile).toHaveBeenCalledWith(expect.any(String), {
      hash: `/${WindowName.AuraOverlay}?profileId=profile-1`,
    });
    expect(auraWindow.showInactive).toHaveBeenCalled();
    expect(auraWindow.setFocusable).toHaveBeenLastCalledWith(false);
    expect(auraWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);

    const closedListener = auraWindow.on.mock.calls.find(
      ([eventName]) => eventName === "closed",
    )?.[1];
    closedListener?.();
    closedListener?.();
    expect(getInternals(service).auraWindow).toBeNull();
    expect(getInternals(service).auraWindowProfileId).toBeUndefined();
  });

  it("reuses the existing aura overlay window and reloads only when the profile changes", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const firstProfile = createAuraProfile({ id: "profile-1" });
    const secondProfile = createAuraProfile({ id: "profile-2" });
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [firstProfile, secondProfile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(firstProfile.id);
    await service.show(firstProfile.id);
    await service.show(secondProfile.id);

    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(
      info.mock.calls.filter(
        ([message]) =>
          typeof message === "string" &&
          message.includes("Aura overlay opened"),
      ),
    ).toHaveLength(1);
    expect(auraWindow.loadFile).toHaveBeenCalledTimes(2);
    expect(auraWindow.loadFile).toHaveBeenNthCalledWith(1, expect.any(String), {
      hash: `/${WindowName.AuraOverlay}?profileId=profile-1`,
    });
    expect(auraWindow.loadFile).toHaveBeenNthCalledWith(2, expect.any(String), {
      hash: `/${WindowName.AuraOverlay}?profileId=profile-2`,
    });
  });

  it("requests add aura mode without reloading the current aura profile", async () => {
    const profile = createAuraProfile({ id: "profile-1" });
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id);
    await service.show(profile.id, { startAddingAura: true });

    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(auraWindow.loadFile).toHaveBeenCalledTimes(1);
    expect(auraWindow.loadFile).toHaveBeenNthCalledWith(1, expect.any(String), {
      hash: `/${WindowName.AuraOverlay}?profileId=profile-1`,
    });
    expect(auraWindow.webContents.send).toHaveBeenCalledWith(
      OverlayWindowsChannel.AuraAddRequested,
      "1",
    );
  });

  it("loads first-time aura add mode through route params", async () => {
    const profile = createAuraProfile({ id: "profile-1" });
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id, { startAddingAura: true });

    expect(auraWindow.loadFile).toHaveBeenCalledWith(expect.any(String), {
      hash: `/${WindowName.AuraOverlay}?profileId=profile-1&startAddingAura=1&addAuraRequestId=1`,
    });
  });

  it("toggles the aura overlay between click-through and editable modes", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    const mainWindow = createFakeWindow();
    const destroyedWindow = createFakeWindow({ destroyed: true });
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow as unknown as Electron.BrowserWindow,
      destroyedWindow as unknown as Electron.BrowserWindow,
      auraWindow as unknown as Electron.BrowserWindow,
    ]);
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id);
    auraWindow.setIgnoreMouseEvents.mockClear();
    auraWindow.setFocusable.mockClear();
    auraWindow.webContents.send.mockClear();
    mainWindow.webContents.send.mockClear();
    info.mockClear();

    service.setInputPassthrough(false);
    expect(auraWindow.setIgnoreMouseEvents).not.toHaveBeenCalled();
    expect(auraWindow.setFocusable).not.toHaveBeenCalled();

    service.setLocked(false);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Aura overlay unlocked"),
      { locked: false },
    );
    expect(auraWindow.setFocusable).toHaveBeenCalledWith(true);
    expect(auraWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(service.isLocked()).toBe(false);
    expect(auraWindow.webContents.send).toHaveBeenLastCalledWith(
      "overlay-windows:aura-lock-changed",
      false,
    );
    expect(mainWindow.webContents.send).toHaveBeenLastCalledWith(
      "overlay-windows:aura-lock-changed",
      false,
    );
    expect(destroyedWindow.webContents.send).not.toHaveBeenCalled();

    info.mockClear();
    service.setLocked(true);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Aura overlay locked"),
      { locked: true },
    );
    expect(auraWindow.setFocusable).toHaveBeenCalledWith(false);
    expect(auraWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(service.isLocked()).toBe(true);
    expect(auraWindow.webContents.send).toHaveBeenLastCalledWith(
      "overlay-windows:aura-lock-changed",
      true,
    );
  });

  it("keeps the editable aura overlay visible while its window is focused", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow({ visible: true });
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);
    service.setLocked(false);

    await service.show(profile.id);
    const focusListener = auraWindow.on.mock.calls.find(
      ([eventName]) => eventName === "focus",
    )?.[1];
    const blurListener = auraWindow.on.mock.calls.find(
      ([eventName]) => eventName === "blur",
    )?.[1];

    focusListener?.();
    await flushTimers();
    auraWindow.setOpacity.mockClear();
    auraWindow.setIgnoreMouseEvents.mockClear();

    coordinator.setPoeFocusActive(false);
    await flushTimers();

    expect(auraWindow.setOpacity).not.toHaveBeenCalledWith(0);
    expect(auraWindow.setIgnoreMouseEvents).not.toHaveBeenCalledWith(true);

    blurListener?.();
    expect(auraWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(auraWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
  });

  it("does not directly blur the aura overlay window when locking it", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow({ focused: true });
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);
    service.setLocked(false);

    await service.show(profile.id);
    auraWindow.blur.mockClear();

    service.setLocked(true);

    expect(auraWindow.blur).not.toHaveBeenCalled();
    expect(auraWindow.setFocusable).toHaveBeenLastCalledWith(false);
    expect(auraWindow.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true);
  });

  it("suspends requested auras while the game is running but not focused", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow({ visible: true });
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);

    await service.show(profile.id);

    expect(auraWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(auraWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(auraWindow.showInactive).not.toHaveBeenCalled();
  });

  it("updates full-display bounds when the primary display changes", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id);
    auraWindow.getBounds.mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
    await service.show(profile.id);

    expect(auraWindow.setBounds).toHaveBeenCalledWith(
      { x: 0, y: 0, width: 1920, height: 1080 },
      false,
    );
  });

  it("closes the aura overlay when hidden, game stops, or no renderable placements exist", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const firstWindow = createFakeWindow();
    const secondWindow = createFakeWindow();
    electronMocks.browserWindowFactory
      .mockReturnValueOnce(firstWindow)
      .mockReturnValueOnce(secondWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id);
    service.hide();
    expect(firstWindow.close).toHaveBeenCalled();

    await service.show(profile.id);
    service.setGameRunningActive(false);
    expect(secondWindow.close).toHaveBeenCalled();

    const noRenderableProfile = createAuraProfile({
      cropRegions: [],
      overlayPlacements: [
        {
          id: "placement-1",
          cropRegionId: "missing-crop",
          x: 30,
          y: 40,
          scale: 1,
          opacity: 1,
        },
      ],
    });
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [noRenderableProfile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    service.setGameRunningActive(true);
    await service.show(noRenderableProfile.id);
    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(2);
  });

  it("shows an unlocked aura overlay even when the profile has no renderable placements", async () => {
    const profile = createAuraProfile({
      cropRegions: [],
      overlayPlacements: [],
    });
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    service.setLocked(false);
    await service.show(profile.id);

    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(auraWindow.loadFile).toHaveBeenCalledWith(expect.any(String), {
      hash: `/${WindowName.AuraOverlay}?profileId=profile-1`,
    });
    expect(auraWindow.showInactive).toHaveBeenCalled();
    expect(auraWindow.setFocusable).toHaveBeenLastCalledWith(true);
    expect(auraWindow.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
  });

  it("does not show requested auras until the active game is running", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id);

    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();

    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    await flushTimers();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(auraWindow.showInactive).toHaveBeenCalled();

    auraWindow.isVisible.mockReturnValue(true);
    coordinator.setPoeFocusActive(false);
    await flushTimers();
    expect(auraWindow.setOpacity).toHaveBeenCalledWith(0);
    expect(auraWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
  });

  it("uses the first profile when no profile id is provided", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show();

    expect(auraWindow.loadFile).toHaveBeenCalledWith(expect.any(String), {
      hash: `/${WindowName.AuraOverlay}?profileId=profile-1`,
    });
  });

  it("handles restore and profile lookup misses without creating windows", async () => {
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [],
      update: vi.fn(),
    } as unknown as ProfilesService);

    await service.show();
    service.suspendForSystem();
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();

    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    service.setGameRunningActive(true);
    await service.show("missing-profile");
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();

    Object.assign(getInternals(service), {
      auraOverlayRequested: true,
      auraOverlayProfileId: "missing-profile",
    });
    await getInternals(service).restoreRequestedOverlay();
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
  });

  it("does not close windows on system suspend when no aura overlay is requested", () => {
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);

    service.suspendForSystem();

    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
  });

  it("closes requested aura overlays on system suspend", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id);
    service.suspendForSystem();

    expect(auraWindow.close).toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Aura overlay closed"),
      { reason: "system-suspend" },
    );
  });

  it("does not close already destroyed aura windows", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow({ destroyed: true });
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await service.show(profile.id);
    service.destroy();

    expect(auraWindow.close).not.toHaveBeenCalled();
  });

  it("ignores aborted aura overlay navigation when the window is closed during load", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    auraWindow.loadFile.mockRejectedValue(
      new Error(
        `ERR_ABORTED (-3) loading 'http://localhost:5173/#/${WindowName.AuraOverlay}'`,
      ),
    );
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await expect(service.show(profile.id)).resolves.toBeUndefined();

    expect(auraWindow.showInactive).not.toHaveBeenCalled();
  });

  it("ignores aura overlay load failures after the window is destroyed", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    auraWindow.loadFile.mockImplementation(async () => {
      auraWindow.isDestroyed.mockReturnValue(true);
      throw new Error("load failed");
    });
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await expect(service.show(profile.id)).resolves.toBeUndefined();

    expect(auraWindow.showInactive).not.toHaveBeenCalled();
  });

  it("surfaces non-aborted aura overlay navigation failures", async () => {
    const profile = createAuraProfile();
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [profile],
      update: vi.fn(),
    } as unknown as ProfilesService);
    const auraWindow = createFakeWindow();
    auraWindow.loadFile.mockRejectedValue(new Error("load failed"));
    electronMocks.browserWindowFactory.mockReturnValue(auraWindow);
    const coordinator = new GameOverlayCoordinator();
    const service = new AuraManagerOverlaysService(coordinator);
    coordinator.setGameRunningActive(true);
    service.setGameRunningActive(true);
    coordinator.setPoeFocusActive(true);

    await expect(service.show(profile.id)).rejects.toThrow("load failed");
  });
});
