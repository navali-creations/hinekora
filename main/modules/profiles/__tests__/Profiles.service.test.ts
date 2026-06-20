import { afterEach, describe, expect, it, vi } from "vitest";

import { mockIpcMainHandlers } from "~/main/test/ipc";

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
    DatabaseService.resetForTests();
    vi.restoreAllMocks();
  });

  it("creates a default profile once and publishes changes", () => {
    const send = vi.fn();
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: { send } },
      { isDestroyed: () => true, webContents: { send: vi.fn() } },
    ]);
    const service = new ProfilesService();

    const created = service.ensureDefaultProfile();
    const existing = service.ensureDefaultProfile();

    expect(created).toMatchObject({
      name: "Default PoE Profile",
      game: "poe1",
    });
    expect(existing.id).toBe(created.id);
    expect(service.list()).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(ProfilesChannel.Changed, [
      expect.objectContaining({ id: created.id }),
    ]);
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
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: { send } },
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
