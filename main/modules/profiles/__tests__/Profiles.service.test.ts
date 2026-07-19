import { afterEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { DatabaseService } from "../../database";
import { SettingsStoreService } from "../../settings-store/SettingsStore.service";
import { ProfilesChannel } from "../Profiles.channels";
import { ProfilesService } from "../Profiles.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
}));

describe("ProfilesService", () => {
  afterEach(() => {
    electronMocks.getAllWindows.mockReset();
    clearIpcWindowRolesForTests();
    SettingsStoreService.resetForTests();
    DatabaseService.resetForTests();
    vi.restoreAllMocks();
  });

  it("creates one global default aura profile once and publishes changes", () => {
    const mainSend = vi.fn();
    const auraSend = vi.fn();
    const recorderSend = vi.fn();
    const unscopedSend = vi.fn();
    const destroyedSend = vi.fn();
    const mainWebContents = { id: 1, send: mainSend };
    const auraWebContents = { id: 2, send: auraSend };
    const recorderWebContents = { id: 3, send: recorderSend };
    const unscopedWebContents = { id: 4, send: unscopedSend };
    const destroyedWebContents = { id: 5, send: destroyedSend };
    DatabaseService.getInstance(":memory:");
    registerIpcWindowRole(mainWebContents, WindowName.Main);
    registerIpcWindowRole(auraWebContents, WindowName.AuraOverlay);
    registerIpcWindowRole(recorderWebContents, WindowName.RecorderOverlay);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: mainWebContents },
      { isDestroyed: () => false, webContents: auraWebContents },
      { isDestroyed: () => false, webContents: recorderWebContents },
      { isDestroyed: () => false, webContents: unscopedWebContents },
      { isDestroyed: () => true, webContents: destroyedWebContents },
    ]);
    const service = new ProfilesService();

    const created = service.ensureDefaultProfile();
    const existing = service.ensureDefaultProfile();

    expect(created).toMatchObject({
      name: "Default Aura Profile",
      game: null,
    });
    expect(existing.id).toBe(created.id);
    expect(service.list()).toHaveLength(1);
    expect(service.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ game: null, name: "Default Aura Profile" }),
      ]),
    );
    expect(mainSend).toHaveBeenCalledTimes(1);
    expect(auraSend).toHaveBeenCalledTimes(1);
    expect(recorderSend).toHaveBeenCalledTimes(1);
    expect(unscopedSend).not.toHaveBeenCalled();
    expect(destroyedSend).not.toHaveBeenCalled();
    expect(mainSend).toHaveBeenLastCalledWith(
      ProfilesChannel.Changed,
      expect.arrayContaining([expect.objectContaining({ game: null })]),
    );
  });

  it("notifies main-process profile observers", () => {
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ProfilesService();
    const listener = vi.fn();
    const unsubscribe = service.onDidChange(listener);

    const created = service.create({ name: "Mapper", game: "poe2" });
    unsubscribe();
    service.update({ id: created.id, name: "Ignored" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({ id: created.id, name: "Mapper" }),
    ]);
  });

  it("continues notifying profile observers when one listener throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mainSend = vi.fn();
    const mainWebContents = { id: 1, send: mainSend };
    DatabaseService.getInstance(":memory:");
    registerIpcWindowRole(mainWebContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: mainWebContents },
    ]);
    const service = new ProfilesService();
    const throwingListener = vi.fn(() => {
      throw new Error("listener failed");
    });
    const survivingListener = vi.fn();
    service.onDidChange(throwingListener);
    service.onDidChange(survivingListener);

    service.create({ name: "Mapper", game: "poe1" });

    expect(survivingListener).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Mapper" }),
    ]);
    expect(mainSend).toHaveBeenCalledWith(
      ProfilesChannel.Changed,
      expect.any(Array),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Profile listener failed"),
      { error: "listener failed" },
    );
  });

  it("creates and reuses the singleton instance", () => {
    const singletonAccess = ProfilesService as unknown as {
      instance: ProfilesService | null;
    };
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    singletonAccess.instance = null;

    const first = ProfilesService.getInstance();
    const second = ProfilesService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("updates, upserts, replaces, and deletes profiles", () => {
    const send = vi.fn();
    const webContents = { id: 1, send };
    DatabaseService.getInstance(":memory:");
    registerIpcWindowRole(webContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents },
    ]);
    const service = new ProfilesService();
    const profile = service.create({ name: "Mapper", game: "poe2" });

    expect(service.update({ id: profile.id, name: "Bossing" })).toMatchObject({
      id: profile.id,
      name: "Bossing",
    });

    const replacement = {
      ...profile,
      id: "replacement",
      name: "Replacement",
      updatedAt: new Date().toISOString(),
    };
    service.replaceAll([replacement]);
    expect(service.list()).toEqual([replacement]);

    service.upsertMany([{ ...replacement, name: "Updated Replacement" }]);
    expect(service.list()[0]).toMatchObject({
      id: "replacement",
      name: "Updated Replacement",
    });

    service.delete("replacement");
    expect(service.list()).toEqual([
      expect.objectContaining({
        id: "replacement",
        game: null,
        name: "Default Aura Profile",
        cropRegions: [],
        overlayPlacements: [],
      }),
    ]);
    expect(send).toHaveBeenCalledTimes(5);
  });

  it("duplicates profiles and keeps destructive lifecycle changes atomic", () => {
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ProfilesService();
    const source = service.create({ name: "PoE 2", game: "poe2" });
    service.update({
      id: source.id,
      cropRegions: [
        {
          id: "crop-1",
          label: "Aura 1",
          x: 1,
          y: 2,
          width: 3,
          height: 4,
        },
      ],
      targetFps: 45,
    });

    const duplicate = service.duplicate({
      sourceId: source.id,
      name: "PoE 2 Copy",
    });

    expect(duplicate).toMatchObject({
      game: "poe2",
      name: "PoE 2 Copy",
      targetFps: 45,
      cropRegions: [expect.objectContaining({ id: "crop-1" })],
    });
    expect(duplicate.id).not.toBe(source.id);
    expect(() =>
      service.duplicate({
        sourceId: "missing-profile",
        name: "Missing Copy",
      }),
    ).toThrow("source profile was not found");

    const listSpy = vi.spyOn(service, "list");
    expect(() => service.delete("missing-profile")).toThrow(
      "profile was not found",
    );
    expect(service.delete(source.id)).toEqual([duplicate]);
    expect(listSpy).toHaveBeenCalledOnce();
    listSpy.mockClear();
    expect(service.delete(duplicate.id)).toEqual([
      expect.objectContaining({
        id: duplicate.id,
        game: null,
        name: "Default Aura Profile",
        cropRegions: [],
      }),
    ]);
    expect(listSpy).toHaveBeenCalledOnce();
  });

  it("deletes all profiles into one global empty default", () => {
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ProfilesService();
    const poe1 = service.create({ name: "PoE 1", game: "poe1" });
    service.create({ name: "PoE 2", game: "poe2" });

    const listSpy = vi.spyOn(service, "list");
    expect(service.deleteAll(poe1.id)).toEqual([
      expect.objectContaining({
        id: poe1.id,
        game: null,
        name: "Default Aura Profile",
        captureTarget: null,
        cropRegions: [],
        overlayPlacements: [],
        targetFps: 30,
      }),
    ]);
    expect(listSpy).toHaveBeenCalledOnce();
    expect(() => service.deleteAll("missing-profile")).toThrow(
      "fallback profile was not found",
    );
    expect(service.list()).toHaveLength(1);
  });

  it("registers IPC handlers with validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    new ProfilesService();

    const created = await handlers.get(ProfilesChannel.Create)?.(
      {},
      { name: "IPC Profile", game: "poe1" },
    );
    expect(created).toMatchObject({ name: "IPC Profile", game: "poe1" });

    expect(await handlers.get(ProfilesChannel.List)?.({})).toEqual([
      expect.objectContaining({ name: "IPC Profile" }),
    ]);

    const id = (created as { id: string }).id;
    SettingsStoreService.getInstance().update({ activeGame: "poe2" });
    expect(await handlers.get(ProfilesChannel.Select)?.({}, id)).toEqual({
      ok: false,
      error: "profile is not available for the active game",
    });
    SettingsStoreService.getInstance().update({ activeGame: "poe1" });
    expect(
      await handlers.get(ProfilesChannel.Select)?.({}, "missing-profile"),
    ).toEqual({
      ok: false,
      error: "profile is not available for the active game",
    });

    expect(
      await handlers.get(ProfilesChannel.Update)?.({}, { id, name: "Updated" }),
    ).toMatchObject({ id, name: "Updated" });

    const duplicated = await handlers.get(ProfilesChannel.Duplicate)?.(
      {},
      {
        sourceId: id,
        name: "IPC Profile Copy",
      },
    );
    expect(duplicated).toMatchObject({
      game: "poe1",
      name: "IPC Profile Copy",
    });

    await handlers.get(ProfilesChannel.Select)?.({}, id);
    expect(SettingsStoreService.getInstance().get().selectedProfileId).toBe(id);

    expect(await handlers.get(ProfilesChannel.Delete)?.({}, id)).toEqual([
      expect.objectContaining({ name: "IPC Profile Copy" }),
    ]);
    const duplicateId = (duplicated as { id: string }).id;
    expect(
      await handlers.get(ProfilesChannel.DeleteAll)?.({}, duplicateId),
    ).toEqual([
      expect.objectContaining({
        id: duplicateId,
        game: null,
        name: "Default Aura Profile",
      }),
    ]);
    expect(await handlers.get(ProfilesChannel.Create)?.({}, null)).toEqual({
      ok: false,
      error: "profile must be an object",
    });
    expect(await handlers.get(ProfilesChannel.Update)?.({}, null)).toEqual({
      ok: false,
      error: "profile must be an object",
    });
    expect(await handlers.get(ProfilesChannel.Duplicate)?.({}, null)).toEqual({
      ok: false,
      error: "profile must be an object",
    });
    expect(
      await handlers.get(ProfilesChannel.Create)?.({}, { name: "   " }),
    ).toMatchObject({ ok: false });
    expect(
      await handlers.get(ProfilesChannel.Duplicate)?.(
        {},
        { sourceId: duplicateId, name: "   " },
      ),
    ).toMatchObject({ ok: false });
    expect(
      await handlers.get(ProfilesChannel.Update)?.(
        {},
        { id: duplicateId, name: "   " },
      ),
    ).toMatchObject({ ok: false });
    expect(await handlers.get(ProfilesChannel.Delete)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ProfilesChannel.DeleteAll)?.({}, "")).toEqual({
      ok: false,
      error: "fallbackId is too short",
    });
    expect(await handlers.get(ProfilesChannel.Select)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
  });
});
