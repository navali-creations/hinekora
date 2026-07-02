import { afterEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { DatabaseService } from "../../database";
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
    DatabaseService.resetForTests();
    vi.restoreAllMocks();
  });

  it("creates default profiles for both games once and publishes changes", () => {
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
      name: "Default PoE Profile",
      game: "poe1",
    });
    expect(existing.id).toBe(created.id);
    expect(service.list()).toHaveLength(2);
    expect(service.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ game: "poe1", name: "Default PoE Profile" }),
        expect.objectContaining({
          game: "poe2",
          name: "Default PoE 2 Profile",
        }),
      ]),
    );
    expect(mainSend).toHaveBeenCalledTimes(2);
    expect(auraSend).toHaveBeenCalledTimes(2);
    expect(recorderSend).toHaveBeenCalledTimes(2);
    expect(unscopedSend).not.toHaveBeenCalled();
    expect(destroyedSend).not.toHaveBeenCalled();
    expect(mainSend).toHaveBeenLastCalledWith(
      ProfilesChannel.Changed,
      expect.arrayContaining([
        expect.objectContaining({ game: "poe1" }),
        expect.objectContaining({ game: "poe2" }),
      ]),
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
    expect(service.list()).toEqual([]);
    expect(send).toHaveBeenCalledTimes(5);
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
    expect(
      await handlers.get(ProfilesChannel.Update)?.({}, { id, name: "Updated" }),
    ).toMatchObject({ id, name: "Updated" });

    await handlers.get(ProfilesChannel.Delete)?.({}, id);
    expect(await handlers.get(ProfilesChannel.List)?.({})).toEqual([]);
    expect(await handlers.get(ProfilesChannel.Create)?.({}, null)).toEqual({
      ok: false,
      error: "profile must be an object",
    });
    expect(await handlers.get(ProfilesChannel.Update)?.({}, null)).toEqual({
      ok: false,
      error: "profile must be an object",
    });
    expect(await handlers.get(ProfilesChannel.Delete)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
  });
});
