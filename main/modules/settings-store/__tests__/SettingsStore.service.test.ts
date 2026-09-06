import { afterEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import {
  type AppSettings,
  createDefaultSettings,
  getCurrentLeague,
} from "~/types";
import { DatabaseService } from "../../database";
import { PoeLeaguesRepository } from "../../poe-leagues/PoeLeagues.repository";
import { SettingsStoreChannel } from "../SettingsStore.channels";
import { SettingsStoreRepository } from "../SettingsStore.repository";
import { SettingsStoreService } from "../SettingsStore.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn<() => unknown[]>(() => []),
  getPath: vi.fn(() => "C:\\Videos"),
  ipcMainHandle: vi.fn(),
  setLoginItemSettings: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: electronMocks.getPath,
    setLoginItemSettings: electronMocks.setLoginItemSettings,
  },
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
  ipcMain: {
    handle: electronMocks.ipcMainHandle,
  },
}));

describe("SettingsStoreService", () => {
  afterEach(() => {
    clearIpcWindowRolesForTests();
    electronMocks.getAllWindows.mockReset();
    electronMocks.getAllWindows.mockReturnValue([]);
    electronMocks.getPath.mockReset();
    electronMocks.getPath.mockReturnValue("C:\\Videos");
    electronMocks.ipcMainHandle.mockReset();
    electronMocks.setLoginItemSettings.mockReset();
    vi.restoreAllMocks();
    SettingsStoreService.resetForTests();
    DatabaseService.resetForTests();
  });

  it("merges validated settings updates through the repository", () => {
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();

    try {
      expect(service.get()).toMatchObject({
        activeGame: "poe1",
        activeLeague: getCurrentLeague("poe1"),
      });
      expect(
        service.update({
          activeGame: "poe2",
          activeLeague: "Mercenaries",
          deathClipSeconds: 12,
          groupPlayDeathAlertDismissed: true,
          onboardingDismissedBeacons: ["game-selector"],
          poe1CharacterName: "Ailucannon",
          poe2CharacterName: "Ailumonk",
          recorderSettingsInfoAlertDismissed: true,
        }),
      ).toMatchObject({
        activeGame: "poe2",
        activeLeague: "Mercenaries",
        deathClipSeconds: 12,
        groupPlayDeathAlertDismissed: true,
        onboardingDismissedBeacons: ["game-selector"],
        poe1CharacterName: "Ailucannon",
        poe2CharacterName: "Ailumonk",
        recorderSettingsInfoAlertDismissed: true,
      });
      expect(() => service.update({ deathClipSeconds: 61 })).toThrow();
    } finally {
      database.close();
    }
  });

  it("rejects overlapping recording and export roots", () => {
    const service = new SettingsStoreService();

    expect(() =>
      service.update({ recordingStoragePath: "C:\\Videos" }),
    ).toThrow("Recording and export folders must not contain each other");
    expect(() =>
      service.update({ editorExportStoragePath: "C:\\Videos" }),
    ).toThrow("Recording and export folders must not contain each other");
    expect(
      service.update({ editorExportStoragePath: "D:\\Hinekora Exports" }),
    ).toMatchObject({ editorExportStoragePath: "D:\\Hinekora Exports" });
  });

  it("persists only the validated settings delta", () => {
    const database = DatabaseService.getInstance(":memory:");
    const setMany = vi.spyOn(SettingsStoreRepository.prototype, "setMany");
    const service = new SettingsStoreService();

    try {
      service.update({ setupCompleted: true });
      setMany.mockClear();

      service.update({ appStartMinimized: true });
      expect(setMany).toHaveBeenLastCalledWith({ appStartMinimized: true });

      service.update({ activeGame: "poe2" });
      expect(setMany).toHaveBeenLastCalledWith({
        activeGame: "poe2",
        activeLeague: getCurrentLeague("poe2"),
      });
      expect(service.get()).toMatchObject({
        activeGame: "poe2",
        activeLeague: getCurrentLeague("poe2"),
        editorAutoPruneProjects: true,
      });
      expect(() =>
        service.update({ unsupportedSetting: true } as never),
      ).toThrow();
    } finally {
      database.close();
    }
  });

  it("refreshes unresolved league defaults after the catalog changes", () => {
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();
    const listener = vi.fn();
    service.onDidChange(listener);
    expect(service.get().poe1SelectedLeague).toBe(getCurrentLeague("poe1"));

    new PoeLeaguesRepository(database).replaceActive(
      "poe1",
      [
        {
          endAt: null,
          id: "Next League",
          isCurrent: true,
          name: "Next League",
          startAt: null,
          updatedAt: null,
        },
        {
          endAt: null,
          id: "Standard",
          isCurrent: false,
          name: "Standard",
          startAt: null,
          updatedAt: null,
        },
      ],
      "test-provider",
      "2026-08-01T00:00:00.000Z",
    );

    expect(service.refreshCatalogDefaults()).toMatchObject({
      activeLeague: "Next League",
      poe1SelectedLeague: "Next League",
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ poe1SelectedLeague: "Next League" }),
    );

    database.close();
  });

  it("does not publish catalog default refreshes when league defaults are unchanged", () => {
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();
    const listener = vi.fn();
    service.onDidChange(listener);
    service.get();

    expect(service.refreshCatalogDefaults()).toMatchObject({
      activeLeague: getCurrentLeague("poe1"),
      poe1SelectedLeague: getCurrentLeague("poe1"),
      poe2SelectedLeague: getCurrentLeague("poe2"),
    });
    expect(listener).not.toHaveBeenCalled();

    database.close();
  });

  it("caches settings reads and refreshes the cache after updates", () => {
    const database = DatabaseService.getInstance(":memory:");
    const get = vi.spyOn(SettingsStoreRepository.prototype, "get");
    const service = new SettingsStoreService();

    try {
      expect(service.get().activeGame).toBe("poe1");
      expect(service.get().activeGame).toBe("poe1");
      expect(get).toHaveBeenCalledTimes(1);

      service.update({ activeGame: "poe2" });
      expect(service.get().activeGame).toBe("poe2");
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      database.close();
    }
  });

  it("keeps the compatibility league synchronized with each game selection", () => {
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();

    try {
      service.update({ poe2SelectedLeague: "Dawn of the Hunt" });
      expect(service.update({ activeGame: "poe2" })).toMatchObject({
        activeGame: "poe2",
        activeLeague: "Dawn of the Hunt",
        poe2SelectedLeague: "Dawn of the Hunt",
      });

      expect(service.update({ activeLeague: "Hardcore" })).toMatchObject({
        activeLeague: "Hardcore",
        poe2SelectedLeague: "Hardcore",
      });
    } finally {
      database.close();
    }
  });

  it("creates and reuses the singleton instance until reset", () => {
    const database = DatabaseService.getInstance(":memory:");

    try {
      const first = SettingsStoreService.getInstance();
      const second = SettingsStoreService.getInstance();

      expect(first).toBe(second);

      SettingsStoreService.resetForTests();
      const replacement = SettingsStoreService.getInstance();

      expect(replacement).not.toBe(first);
    } finally {
      database.close();
    }
  });

  it("replaces all settings with a validated snapshot", () => {
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();

    try {
      service.update({ activeGame: "poe2", activeLeague: "Mercenaries" });

      expect(
        service.replace({
          ...createDefaultSettings(),
          activeGame: "poe1",
          activeLeague: "Hardcore",
          poe1SelectedLeague: "Hardcore",
        }),
      ).toMatchObject({
        activeGame: "poe1",
        activeLeague: "Hardcore",
      });
    } finally {
      database.close();
    }
  });

  it("notifies subscribers when settings change", () => {
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();
    const listener = vi.fn();
    const unsubscribe = service.onDidChange(listener);

    try {
      const updatedSettings = service.update({ activeGame: "poe2" });

      expect(listener).toHaveBeenCalledWith(updatedSettings);

      listener.mockClear();
      const replacedSettings = service.replace({
        ...createDefaultSettings(),
        activeLeague: "Hardcore",
      });

      expect(listener).toHaveBeenCalledWith(replacedSettings);

      listener.mockClear();
      unsubscribe();
      service.update({ activeGame: "poe1" });

      expect(listener).not.toHaveBeenCalled();
    } finally {
      database.close();
    }
  });

  it("publishes full settings to main and scoped settings to overlays", () => {
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();
    const mainWindow = createMockWindow(1, WindowName.Main);
    const auraOverlay = createMockWindow(2, WindowName.AuraOverlay);
    const recorderOverlay = createMockWindow(3, WindowName.RecorderOverlay);
    const clipPreviewOverlay = createMockWindow(
      4,
      WindowName.ClipPreviewOverlay,
    );
    const destroyedMainWindow = createMockWindow(5, WindowName.Main);
    destroyedMainWindow.isDestroyed.mockReturnValue(true);
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow,
      auraOverlay,
      recorderOverlay,
      clipPreviewOverlay,
      destroyedMainWindow,
    ]);

    try {
      const updatedSettings = service.update({ activeGame: "poe2" });

      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        SettingsStoreChannel.Changed,
        updatedSettings,
      );
      expect(auraOverlay.webContents.send).toHaveBeenCalledWith(
        SettingsStoreChannel.OverlayChanged,
        {
          activeGame: "poe2",
          auraOverlayEnableSnapping: updatedSettings.auraOverlayEnableSnapping,
          auraOverlayHideLabels: updatedSettings.auraOverlayHideLabels,
          auraOverlayHidePropertiesPanel:
            updatedSettings.auraOverlayHidePropertiesPanel,
          auraOverlayShowCenterGuides:
            updatedSettings.auraOverlayShowCenterGuides,
          auraOverlayShowEditingFrame:
            updatedSettings.auraOverlayShowEditingFrame,
          auraOverlayShowEditingGrid:
            updatedSettings.auraOverlayShowEditingGrid,
          manualReplaySeconds: updatedSettings.manualReplaySeconds,
          replayClipPreviewResolution:
            updatedSettings.replayClipPreviewResolution,
          selectedCaptureProfileId: updatedSettings.selectedCaptureProfileId,
          selectedCaptureProfileIdsByGame:
            updatedSettings.selectedCaptureProfileIdsByGame,
          selectedProfileId: updatedSettings.selectedProfileId,
          telemetryCrashReporting: updatedSettings.telemetryCrashReporting,
        },
      );
      expect(recorderOverlay.webContents.send).toHaveBeenCalledWith(
        SettingsStoreChannel.OverlayChanged,
        {
          activeGame: "poe2",
          manualReplayShowPreview: updatedSettings.manualReplayShowPreview,
          manualReplaySeconds: updatedSettings.manualReplaySeconds,
          replayClipPreviewResolution:
            updatedSettings.replayClipPreviewResolution,
          selectedCaptureProfileId: updatedSettings.selectedCaptureProfileId,
          selectedCaptureProfileIdsByGame:
            updatedSettings.selectedCaptureProfileIdsByGame,
          selectedProfileId: updatedSettings.selectedProfileId,
          telemetryCrashReporting: updatedSettings.telemetryCrashReporting,
        },
      );
      expect(auraOverlay.webContents.send).not.toHaveBeenCalledWith(
        SettingsStoreChannel.Changed,
        expect.anything(),
      );
      expect(recorderOverlay.webContents.send).not.toHaveBeenCalledWith(
        SettingsStoreChannel.Changed,
        expect.anything(),
      );
      expect(clipPreviewOverlay.webContents.send).toHaveBeenCalledWith(
        SettingsStoreChannel.ClipPreviewOverlayChanged,
        {
          clipPreviewInfoAlertDismissed:
            updatedSettings.clipPreviewInfoAlertDismissed,
          telemetryCrashReporting: updatedSettings.telemetryCrashReporting,
        },
      );
      expect(clipPreviewOverlay.webContents.send).not.toHaveBeenCalledWith(
        SettingsStoreChannel.OverlayChanged,
        expect.anything(),
      );
      expect(clipPreviewOverlay.webContents.send).not.toHaveBeenCalledWith(
        SettingsStoreChannel.Changed,
        expect.anything(),
      );
      expect(destroyedMainWindow.webContents.send).not.toHaveBeenCalled();
    } finally {
      database.close();
    }
  });

  it("keeps settings updates successful when a subscriber throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();
    const throwingListener = vi.fn(() => {
      throw new Error("listener failed");
    });
    const survivingListener = vi.fn();
    service.onDidChange(throwingListener);
    service.onDidChange(survivingListener);

    try {
      const updatedSettings = service.update({ activeGame: "poe2" });

      expect(updatedSettings.activeGame).toBe("poe2");
      expect(service.get().activeGame).toBe("poe2");
      expect(survivingListener).toHaveBeenCalledWith(updatedSettings);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Settings change listener failed"),
        { error: "listener failed" },
      );
    } finally {
      database.close();
    }
  });

  it("applies login item settings when startup preferences change", () => {
    const database = DatabaseService.getInstance(":memory:");
    const service = new SettingsStoreService();

    try {
      service.update({ appLaunchOnStartup: true });
      expect(electronMocks.setLoginItemSettings).toHaveBeenLastCalledWith({
        args: [],
        openAsHidden: false,
        openAtLogin: true,
      });

      service.update({ appStartMinimized: true });
      expect(electronMocks.setLoginItemSettings).toHaveBeenLastCalledWith({
        args: ["--hidden"],
        openAsHidden: true,
        openAtLogin: true,
      });
    } finally {
      database.close();
    }
  });

  it("registers IPC handlers with validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    const database = DatabaseService.getInstance(":memory:");
    new SettingsStoreService();
    const mainEvent = createIpcEvent(10, WindowName.Main);
    const auraEvent = createIpcEvent(11, WindowName.AuraOverlay);
    const recorderEvent = createIpcEvent(12, WindowName.RecorderOverlay);
    const clipPreviewEvent = createIpcEvent(13, WindowName.ClipPreviewOverlay);

    try {
      const fullSettings = (await handlers.get(SettingsStoreChannel.Get)?.(
        mainEvent,
      )) as AppSettings;
      expect(fullSettings).toMatchObject({
        activeGame: "poe1",
      });
      expect(() => handlers.get(SettingsStoreChannel.Get)?.(auraEvent)).toThrow(
        "settings-store:get is not available from this window",
      );
      const expectedCommonOverlaySnapshot = {
        activeGame: fullSettings.activeGame,
        manualReplaySeconds: fullSettings.manualReplaySeconds,
        replayClipPreviewResolution: fullSettings.replayClipPreviewResolution,
        selectedCaptureProfileId: fullSettings.selectedCaptureProfileId,
        selectedCaptureProfileIdsByGame:
          fullSettings.selectedCaptureProfileIdsByGame,
        selectedProfileId: fullSettings.selectedProfileId,
        telemetryCrashReporting: fullSettings.telemetryCrashReporting,
      };
      const expectedAuraOverlaySnapshot = {
        ...expectedCommonOverlaySnapshot,
        auraOverlayEnableSnapping: fullSettings.auraOverlayEnableSnapping,
        auraOverlayHideLabels: fullSettings.auraOverlayHideLabels,
        auraOverlayHidePropertiesPanel:
          fullSettings.auraOverlayHidePropertiesPanel,
        auraOverlayShowCenterGuides: fullSettings.auraOverlayShowCenterGuides,
        auraOverlayShowEditingFrame: fullSettings.auraOverlayShowEditingFrame,
        auraOverlayShowEditingGrid: fullSettings.auraOverlayShowEditingGrid,
      };
      expect(
        await handlers.get(SettingsStoreChannel.GetOverlaySnapshot)?.(
          auraEvent,
        ),
      ).toEqual(expectedAuraOverlaySnapshot);
      expect(
        await handlers.get(SettingsStoreChannel.GetOverlaySnapshot)?.(
          recorderEvent,
        ),
      ).toEqual({
        ...expectedCommonOverlaySnapshot,
        manualReplayShowPreview: fullSettings.manualReplayShowPreview,
      });
      expect(() =>
        handlers.get(SettingsStoreChannel.GetOverlaySnapshot)?.(mainEvent),
      ).toThrow(
        "settings-store:get-overlay-snapshot is not available from this window",
      );
      expect(() =>
        handlers.get(SettingsStoreChannel.GetOverlaySnapshot)?.(
          clipPreviewEvent,
        ),
      ).toThrow(
        "settings-store:get-overlay-snapshot is not available from this window",
      );
      expect(
        await handlers.get(
          SettingsStoreChannel.GetClipPreviewOverlaySnapshot,
        )?.(clipPreviewEvent),
      ).toEqual({
        clipPreviewInfoAlertDismissed:
          fullSettings.clipPreviewInfoAlertDismissed,
        telemetryCrashReporting: fullSettings.telemetryCrashReporting,
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(mainEvent, {
          activeGame: "poe2",
        }),
      ).toMatchObject({
        activeGame: "poe2",
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(auraEvent, {
          auraOverlayEnableSnapping: false,
          auraOverlayHideLabels: true,
          auraOverlayHidePropertiesPanel: true,
          auraOverlayShowCenterGuides: false,
          auraOverlayShowEditingFrame: false,
          auraOverlayShowEditingGrid: true,
        }),
      ).toEqual({
        ...expectedAuraOverlaySnapshot,
        activeGame: "poe2",
        auraOverlayEnableSnapping: false,
        auraOverlayHideLabels: true,
        auraOverlayHidePropertiesPanel: true,
        auraOverlayShowCenterGuides: false,
        auraOverlayShowEditingFrame: false,
        auraOverlayShowEditingGrid: true,
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(auraEvent, {
          activeGame: "poe1",
        }),
      ).toEqual({
        ok: false,
        error: "activeGame cannot be updated from this window",
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(auraEvent, {
          auraOverlayShowEditingGrid: "yes",
        }),
      ).toEqual({
        ok: false,
        error: "auraOverlayShowEditingGrid must be a boolean",
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(auraEvent, {
          auraOverlayEnableSnapping: "yes",
        }),
      ).toEqual({
        ok: false,
        error: "auraOverlayEnableSnapping must be a boolean",
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(auraEvent, {
          auraOverlayHideLabels: "yes",
        }),
      ).toEqual({
        ok: false,
        error: "auraOverlayHideLabels must be a boolean",
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(auraEvent, {
          auraOverlayHidePropertiesPanel: "yes",
        }),
      ).toEqual({
        ok: false,
        error: "auraOverlayHidePropertiesPanel must be a boolean",
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(auraEvent, {
          auraOverlayShowCenterGuides: "yes",
        }),
      ).toEqual({
        ok: false,
        error: "auraOverlayShowCenterGuides must be a boolean",
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(clipPreviewEvent, {
          clipPreviewInfoAlertDismissed: true,
        }),
      ).toEqual({
        clipPreviewInfoAlertDismissed: true,
        telemetryCrashReporting: fullSettings.telemetryCrashReporting,
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(clipPreviewEvent, {
          activeGame: "poe1",
        }),
      ).toEqual({
        ok: false,
        error: "activeGame cannot be updated from this window",
      });
      expect(() =>
        handlers.get(SettingsStoreChannel.Update)?.(recorderEvent, {
          activeGame: "poe1",
        }),
      ).toThrow("settings-store:update is not available from this window");
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(mainEvent, null),
      ).toEqual({
        ok: false,
        error: "settings must be an object",
      });
      expect(
        await handlers.get(SettingsStoreChannel.Update)?.(mainEvent, {
          unsupportedSetting: true,
        }),
      ).toMatchObject({ ok: false });
    } finally {
      database.close();
    }
  });
});

function createMockWindow(id: number, role: WindowName) {
  const window = {
    isDestroyed: vi.fn(() => false),
    webContents: {
      id,
      send: vi.fn(),
    },
  };
  registerIpcWindowRole(window.webContents, role);

  return window;
}

function createIpcEvent(
  id: number,
  role: WindowName,
): Electron.IpcMainInvokeEvent {
  const webContents = { id };
  registerIpcWindowRole(webContents, role);

  return { sender: webContents } as Electron.IpcMainInvokeEvent;
}
