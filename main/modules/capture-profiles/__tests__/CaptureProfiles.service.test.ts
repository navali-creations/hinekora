import { afterEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { CaptureProfilesChannel } from "../CaptureProfiles.channels";
import { CaptureProfilesService } from "../CaptureProfiles.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
}));

describe("CaptureProfilesService", () => {
  afterEach(() => {
    electronMocks.getAllWindows.mockReset();
    clearIpcWindowRolesForTests();
    CaptureProfilesService.resetForTests();
    DatabaseService.resetForTests();
    vi.restoreAllMocks();
  });

  it("creates default capture profiles for both games without duplicating them", () => {
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new CaptureProfilesService();

    const created = service.ensureDefaultProfiles();
    const existing = service.ensureDefaultProfiles();

    expect(created).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          game: "poe1",
          id: "default-capture-poe1",
          isDefault: true,
          name: "Default PoE Capture",
        }),
        expect.objectContaining({
          game: "poe2",
          id: "default-capture-poe2",
          isDefault: true,
          name: "Default PoE 2 Capture",
        }),
      ]),
    );
    expect(existing).toHaveLength(2);
  });

  it("repairs a default-id capture profile that lost its default flag", () => {
    const database = DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    database.runQuery(
      database.kysely
        .updateTable("capture_profiles")
        .set({
          name: "Broken default",
          data_json: JSON.stringify({
            id: "default-capture-poe1",
            name: "Broken default",
            game: "poe1",
            isDefault: false,
          }),
        })
        .where("id", "=", "default-capture-poe1"),
    );
    const service = new CaptureProfilesService();

    expect(service.ensureDefaultProfiles()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "default-capture-poe1",
          isDefault: true,
          name: "Default PoE Capture",
        }),
      ]),
    );
  });

  it("notifies listeners and live main windows after create, update, replace, upsert, and delete", () => {
    const mainSend = vi.fn();
    const overlaySend = vi.fn();
    const destroyedSend = vi.fn();
    const mainWebContents = { id: 1, send: mainSend };
    const overlayWebContents = { id: 2, send: overlaySend };
    const destroyedWebContents = { id: 3, send: destroyedSend };
    DatabaseService.getInstance(":memory:");
    registerIpcWindowRole(mainWebContents, WindowName.Main);
    registerIpcWindowRole(overlayWebContents, WindowName.RecorderOverlay);
    registerIpcWindowRole(destroyedWebContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: mainWebContents },
      { isDestroyed: () => false, webContents: overlayWebContents },
      { isDestroyed: () => true, webContents: destroyedWebContents },
    ]);
    const service = new CaptureProfilesService();
    service.ensureDefaultProfiles();
    const listener = vi.fn();
    const unsubscribe = service.onDidChange(listener);

    const created = service.create({
      name: "Bossing capture",
      game: "poe2",
    });
    const updated = service.update({
      id: created.id,
      deathClipSeconds: 30,
      recordingAutoStartMode: "rewind",
    });
    service.replaceAll([]);
    expect(service.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ game: "poe1" }),
        expect.objectContaining({ game: "poe2" }),
      ]),
    );
    service.upsertMany([
      {
        ...updated,
        name: "Upserted capture",
        updatedAt: new Date().toISOString(),
      },
    ]);
    unsubscribe();
    service.delete(updated.id);

    expect(listener).toHaveBeenCalledTimes(4);
    expect(listener).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          deathClipSeconds: 30,
          name: "Upserted capture",
          recordingAutoStartMode: "rewind",
        }),
      ]),
    );
    expect(service.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          game: "poe1",
          id: "default-capture-poe1",
          isDefault: true,
        }),
        expect.objectContaining({
          game: "poe2",
          id: "default-capture-poe2",
          isDefault: true,
        }),
      ]),
    );
    expect(mainSend).toHaveBeenCalledWith(
      CaptureProfilesChannel.Changed,
      expect.any(Array),
    );
    expect(overlaySend).not.toHaveBeenCalled();
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it("rejects deleting default capture profiles in the main service", () => {
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new CaptureProfilesService();
    const defaultProfile = service
      .ensureDefaultProfiles()
      .find((profile) => profile.id === "default-capture-poe1");

    expect(defaultProfile).toBeDefined();
    expect(() => service.delete(defaultProfile!.id)).toThrow(
      "Default capture profiles cannot be deleted",
    );
  });

  it("rejects changing a default capture profile game", () => {
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new CaptureProfilesService();
    const defaultProfile = service
      .ensureDefaultProfiles()
      .find((profile) => profile.id === "default-capture-poe1");

    expect(defaultProfile).toBeDefined();
    expect(() =>
      service.update({ id: defaultProfile!.id, game: "poe2" }),
    ).toThrow("Default capture profiles cannot change game");
  });

  it("continues notifying capture profile observers when one listener throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mainSend = vi.fn();
    const mainWebContents = { id: 1, send: mainSend };
    DatabaseService.getInstance(":memory:");
    registerIpcWindowRole(mainWebContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: mainWebContents },
    ]);
    const service = new CaptureProfilesService();
    const throwingListener = vi.fn(() => {
      throw new Error("listener failed");
    });
    const survivingListener = vi.fn();
    service.onDidChange(throwingListener);
    service.onDidChange(survivingListener);

    service.create({ name: "Mapping capture", game: "poe1" });

    expect(survivingListener).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "Mapping capture" }),
      ]),
    );
    expect(mainSend).toHaveBeenCalledWith(
      CaptureProfilesChannel.Changed,
      expect.any(Array),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Capture profile listener failed"),
      { error: "listener failed" },
    );
  });

  it("creates and reuses the singleton instance", () => {
    const singletonAccess = CaptureProfilesService as unknown as {
      instance: CaptureProfilesService | null;
    };
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    singletonAccess.instance = null;

    const first = CaptureProfilesService.getInstance();
    const second = CaptureProfilesService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("registers IPC handlers with validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    DatabaseService.getInstance(":memory:");
    electronMocks.getAllWindows.mockReturnValue([]);
    new CaptureProfilesService();

    const created = await handlers.get(CaptureProfilesChannel.Create)?.(
      {},
      { name: "IPC Capture", game: "poe1" },
    );
    expect(created).toMatchObject({ name: "IPC Capture", game: "poe1" });

    expect(await handlers.get(CaptureProfilesChannel.List)?.({})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "IPC Capture" }),
      ]),
    );

    const id = (created as { id: string }).id;
    expect(
      await handlers.get(CaptureProfilesChannel.Update)?.(
        {},
        {
          id,
          deathClipSeconds: 60,
        },
      ),
    ).toMatchObject({ id, deathClipSeconds: 60 });

    await handlers.get(CaptureProfilesChannel.Delete)?.({}, id);
    expect(await handlers.get(CaptureProfilesChannel.List)?.({})).toEqual([
      expect.objectContaining({
        game: "poe1",
        id: "default-capture-poe1",
        isDefault: true,
      }),
      expect.objectContaining({
        game: "poe2",
        id: "default-capture-poe2",
        isDefault: true,
      }),
    ]);
    expect(
      await handlers.get(CaptureProfilesChannel.Delete)?.(
        {},
        "default-capture-poe1",
      ),
    ).toEqual({
      ok: false,
      error: "Default capture profiles cannot be deleted",
    });
    expect(
      await handlers.get(CaptureProfilesChannel.Create)?.({}, null),
    ).toEqual({
      ok: false,
      error: "capture profile must be an object",
    });
    expect(
      await handlers.get(CaptureProfilesChannel.Update)?.({}, null),
    ).toEqual({
      ok: false,
      error: "capture profile must be an object",
    });
    expect(await handlers.get(CaptureProfilesChannel.Delete)?.({}, "")).toEqual(
      {
        ok: false,
        error: "id is too short",
      },
    );
  });
});
