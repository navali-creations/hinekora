import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import { createDefaultSettings } from "~/types";
import { ClientLogChannel } from "../ClientLog.channels";
import { ClientLogService } from "../ClientLog.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
}));

const poeProcessMocks = vi.hoisted(() => ({
  isActiveGameRunning: vi.fn(),
  refreshState: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
}));

vi.mock("~/main/modules/poe-process", () => ({
  PoeProcessService: {
    getInstance: () => ({
      isActiveGameRunning: poeProcessMocks.isActiveGameRunning,
      refreshState: poeProcessMocks.refreshState,
    }),
  },
}));

let directory: string;
let send: Mock<(channel: string, payload: unknown) => void>;
let setPoeFocusActive: Mock<(active: boolean) => void>;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hinekora-client-log-"));
  send = vi.fn<(channel: string, payload: unknown) => void>();
  setPoeFocusActive = vi.fn<(active: boolean) => void>();
  electronMocks.getAllWindows.mockReturnValue([
    { isDestroyed: () => false, webContents: { send } },
  ]);
  poeProcessMocks.refreshState.mockReset();
  poeProcessMocks.refreshState.mockResolvedValue({
    game: "poe1",
    isRunning: true,
    processName: "PathOfExile_x64Steam.exe",
  });
  poeProcessMocks.isActiveGameRunning.mockReset();
  poeProcessMocks.isActiveGameRunning.mockReturnValue(true);
  vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
    setPoeFocusActive,
  } as unknown as OverlayWindowsService);
});

afterEach(() => {
  electronMocks.getAllWindows.mockReset();
  vi.restoreAllMocks();
  rmSync(directory, { force: true, recursive: true });
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("ClientLogService", () => {
  it("creates and reuses the singleton instance", () => {
    const singletonAccess = ClientLogService as unknown as {
      instance: ClientLogService | null;
    };
    singletonAccess.instance = null;

    const first = ClientLogService.getInstance();
    const second = ClientLogService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("initializes the watcher from active settings", () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    const unwatchFile = vi
      .spyOn(fs, "unwatchFile")
      .mockImplementation(() => undefined);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        poe1ClientTxtPath: path,
      }),
    } as unknown as SettingsStoreService);
    const service = new ClientLogService();

    service.initializeFromSettings();

    expect(unwatchFile).not.toHaveBeenCalled();
    expect(service.getStatus()).toMatchObject({
      activeGame: "poe1",
      path,
      watching: true,
      lastError: null,
    });
    service.stopWatchFile();
    expect(unwatchFile).toHaveBeenCalledWith(path);
  });

  it("leaves the watcher idle when initialized settings have no path", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        poe2ClientTxtPath: null,
      }),
    } as unknown as SettingsStoreService);
    const service = new ClientLogService();

    service.initializeFromSettings();

    expect(service.getStatus()).toMatchObject({
      activeGame: "poe2",
      path: null,
      watching: false,
    });
  });

  it("switches active game to idle when no path is configured", () => {
    const update = vi.fn().mockReturnValue({
      ...createDefaultSettings(),
      activeGame: "poe2",
      poe2ClientTxtPath: null,
    });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      update,
    } as unknown as SettingsStoreService);
    const service = new ClientLogService();

    expect(service.setActiveGame({ game: "poe2" })).toMatchObject({
      activeGame: "poe2",
      path: null,
      watching: false,
      lastError: null,
    });
    expect(update).toHaveBeenCalledWith({ activeGame: "poe2" });
    expect(send).toHaveBeenCalledWith(
      ClientLogChannel.StatusChanged,
      expect.objectContaining({ activeGame: "poe2", watching: false }),
    );
    expect(poeProcessMocks.refreshState).toHaveBeenCalledTimes(1);
  });

  it("keeps duplicate active game selections idempotent", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    const settings = {
      ...createDefaultSettings(),
      activeGame: "poe2",
      poe2ClientTxtPath: path,
    };
    const get = vi.fn().mockReturnValue(settings);
    const update = vi.fn().mockReturnValue(settings);
    const watchFile = vi.spyOn(fs, "watchFile");
    const unwatchFile = vi.spyOn(fs, "unwatchFile");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get,
      update,
    } as unknown as SettingsStoreService);
    const service = new ClientLogService();

    service.watchFile(path, "poe2");
    await flushPromises();
    watchFile.mockClear();
    unwatchFile.mockClear();
    send.mockClear();
    poeProcessMocks.refreshState.mockClear();

    expect(service.setActiveGame({ game: "poe2" })).toMatchObject({
      activeGame: "poe2",
      path,
      watching: true,
      lastError: null,
    });

    expect(watchFile).not.toHaveBeenCalled();
    expect(unwatchFile).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();

    service.stopWatchFile();
  });

  it("keeps matching watcher state after settings update idempotent", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    const currentSettings = {
      ...createDefaultSettings(),
      activeGame: "poe1",
      poe2ClientTxtPath: path,
    };
    const updatedSettings = {
      ...currentSettings,
      activeGame: "poe2",
    };
    const get = vi.fn().mockReturnValue(currentSettings);
    const update = vi.fn().mockReturnValue(updatedSettings);
    const watchFile = vi.spyOn(fs, "watchFile");
    const unwatchFile = vi.spyOn(fs, "unwatchFile");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get,
      update,
    } as unknown as SettingsStoreService);
    const service = new ClientLogService();

    service.watchFile(path, "poe2");
    await flushPromises();
    watchFile.mockClear();
    unwatchFile.mockClear();
    send.mockClear();
    poeProcessMocks.refreshState.mockClear();

    expect(service.setActiveGame({ game: "poe2" })).toMatchObject({
      activeGame: "poe2",
      path,
      watching: true,
      lastError: null,
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ activeGame: "poe2" });
    expect(watchFile).not.toHaveBeenCalled();
    expect(unwatchFile).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();

    service.stopWatchFile();
  });

  it("logs safe warnings when process refresh after game switch fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    poeProcessMocks.refreshState.mockRejectedValueOnce(
      new Error("process refresh failed"),
    );
    const update = vi.fn().mockReturnValue({
      ...createDefaultSettings(),
      activeGame: "poe2",
      poe2ClientTxtPath: null,
    });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      update,
    } as unknown as SettingsStoreService);
    const service = new ClientLogService();

    service.setActiveGame({ game: "poe2" });
    warn.mockClear();
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "WARN [client-log] PoE process refresh after game switch failed",
      ),
      expect.objectContaining({
        activeGame: "poe2",
        error: "process refresh failed",
      }),
    );
  });

  it("updates configured client log paths and publishes watcher status", () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    const update = vi.fn().mockReturnValue(createDefaultSettings());
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      update,
    } as unknown as SettingsStoreService);
    const service = new ClientLogService();

    expect(service.setPath({ game: "poe2", path })).toMatchObject({
      activeGame: "poe2",
      path,
      watching: true,
      lastError: null,
    });

    expect(update).toHaveBeenCalledWith({
      activeGame: "poe2",
      poe2ClientTxtPath: path,
    });
    expect(send).toHaveBeenCalledWith(
      ClientLogChannel.StatusChanged,
      expect.objectContaining({ activeGame: "poe2", watching: true }),
    );
    service.stopWatchFile();
  });

  it("does not infer focus from a running process when recent log history is unknown", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();
    expect(poeProcessMocks.isActiveGameRunning).not.toHaveBeenCalled();
    expect(setPoeFocusActive).not.toHaveBeenCalled();
    service.stopWatchFile();
  });

  it("keeps PoE focus inactive when the startup focus tail is unknown", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    poeProcessMocks.isActiveGameRunning.mockReturnValue(false);
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();
    expect(setPoeFocusActive).not.toHaveBeenCalled();
    service.stopWatchFile();
  });

  it("seeds focus from the current client log session opening", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(
      path,
      [
        "2026/06/26 20:04:31 204228109 528852ff [INFO Client 24172] [WINDOW] Gained focus",
        "2026/06/26 20:04:35 204232000 a1e41514 [INFO Client 24172] Closing game gracefully",
        "2026/06/26 20:05:41 ***** LOG FILE OPENING *****",
        "2026/06/26 20:05:41 204297796 84b56f77 [INFO Client 35236] [JOB] Start",
      ].join("\n"),
    );
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    service.stopWatchFile();
  });

  it("reconciles PoE focus from the latest client log tail", async () => {
    const initialText = "existing\n";
    const path = join(directory, "Client.txt");
    writeFileSync(path, initialText);
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();
    const internals = service as unknown as {
      lastKnownSize: number;
    };

    expect(service.reconcilePoeFocusStateFromRecentLog()).toBeNull();

    service.watchFile(path, "poe2");
    await flushPromises();
    setPoeFocusActive.mockClear();

    expect(service.reconcilePoeFocusStateFromRecentLog()).toBeNull();
    expect(setPoeFocusActive).not.toHaveBeenCalled();

    fs.appendFileSync(
      path,
      "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Lost focus\n",
    );

    expect(service.reconcilePoeFocusStateFromRecentLog()).toBe(false);
    expect(setPoeFocusActive).toHaveBeenCalledWith(false);
    expect(internals.lastKnownSize).toBe(Buffer.byteLength(initialText));

    setPoeFocusActive.mockClear();
    fs.appendFileSync(
      path,
      "2026/05/26 02:22:01 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Gained focus\n",
    );

    expect(service.reconcilePoeFocusStateFromRecentLog()).toBe(true);
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    service.stopWatchFile();
  });

  it("uses a startup focus tail loss even when the active game is running", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(
      path,
      "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Lost focus\n",
    );
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();
    expect(setPoeFocusActive).toHaveBeenCalledWith(false);
    service.stopWatchFile();
  });

  it("uses a startup focus tail gain without checking the running process", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(
      path,
      "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Gained focus\n",
    );
    poeProcessMocks.isActiveGameRunning.mockReturnValue(false);
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    service.stopWatchFile();
  });

  it("does not seed focus from process when a recent focus tail exists", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const path = join(directory, "Client.txt");
    writeFileSync(
      path,
      "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Lost focus\n",
    );
    poeProcessMocks.refreshState.mockRejectedValue(new Error("seed failed"));
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();
    expect(setPoeFocusActive).toHaveBeenCalledWith(false);
    expect(warn).not.toHaveBeenCalled();
    service.stopWatchFile();
  });

  it("does not seed focus when no recent focus tail exists", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    poeProcessMocks.refreshState.mockRejectedValue(new Error("seed failed"));
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(setPoeFocusActive).not.toHaveBeenCalled();
    expect(poeProcessMocks.refreshState).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    service.stopWatchFile();
  });

  it("syncs PoE focus from the bounded startup log tail", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(
      path,
      [
        "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
        "x".repeat(9 * 1024),
      ].join("\n"),
    );
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    setPoeFocusActive.mockClear();
    service.stopWatchFile();

    writeFileSync(
      path,
      [
        "existing",
        "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
      ].join("\n"),
    );

    service.watchFile(path, "poe1");

    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    service.stopWatchFile();
  });

  it("does not scan the whole Client.txt file when startup focus history is too old", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(
      path,
      [
        "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
        "x".repeat(32 * 1024 + 1),
      ].join("\n"),
    );
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();

    service.watchFile(path, "poe1");
    await flushPromises();

    expect(setPoeFocusActive).not.toHaveBeenCalled();
    service.stopWatchFile();
  });

  it("switches active games to configured paths", () => {
    const path = join(directory, "Client-poe1.txt");
    writeFileSync(path, "existing\n");
    const get = vi.fn().mockReturnValue({
      ...createDefaultSettings(),
      activeGame: "poe2",
      poe1ClientTxtPath: path,
    });
    const update = vi.fn().mockReturnValue({
      ...createDefaultSettings(),
      activeGame: "poe1",
      poe1ClientTxtPath: path,
    });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get,
      update,
    } as unknown as SettingsStoreService);
    const service = new ClientLogService();

    expect(service.setActiveGame({ game: "poe1" })).toMatchObject({
      activeGame: "poe1",
      path,
      watching: true,
    });
    expect(update).toHaveBeenCalledWith({ activeGame: "poe1" });
    expect(poeProcessMocks.refreshState).toHaveBeenCalledTimes(1);
    service.stopWatchFile();
  });

  it("processes new focus lines and updates overlay focus gating", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const path = join(directory, "Client.txt");
    writeFileSync(path, "");
    electronMocks.getAllWindows.mockReturnValue([]);
    const service = new ClientLogService();
    const internals = service as unknown as {
      openFileDescriptor(path: string): void;
      processNewBytes(path: string, size: number, game: "poe1"): Promise<void>;
    };

    internals.openFileDescriptor(path);
    const text = [
      "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
      "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Lost focus",
    ].join("\n");
    const completeText = `${text}\n`;
    writeFileSync(path, completeText);
    await internals.processNewBytes(
      path,
      Buffer.byteLength(completeText),
      "poe1",
    );

    expect(setPoeFocusActive).toHaveBeenNthCalledWith(1, true);
    expect(setPoeFocusActive).toHaveBeenNthCalledWith(2, false);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [client-log] Active game focus gained"),
      expect.objectContaining({
        game: "poe1",
        focused: true,
        lineHash: expect.any(String),
      }),
    );
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [client-log] Active game focus lost"),
      expect.objectContaining({
        game: "poe1",
        focused: false,
        lineHash: expect.any(String),
      }),
    );
    service.stopWatchFile();
  });

  it("handles missing files and unavailable-log throttling without throwing", async () => {
    const path = join(directory, "missing.txt");
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send } },
    ]);
    const service = new ClientLogService();
    const internals = service as unknown as {
      fd: number | null;
      lastUnavailableLogAt: number;
      logFileUnavailable(path: string, game: "poe1"): void;
      processNewBytes(path: string, size: number, game: "poe1"): Promise<void>;
    };

    await internals.processNewBytes(path, 100, "poe1");
    expect(internals.fd).toBeNull();

    internals.logFileUnavailable(path, "poe1");
    const firstUnavailableAt = internals.lastUnavailableLogAt;
    internals.logFileUnavailable(path, "poe1");
    expect(internals.lastUnavailableLogAt).toBe(firstUnavailableAt);
  });

  it("handles watch callbacks for busy, unavailable, truncated, and failed reads", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    let listener:
      | ((curr: { size: number; birthtimeMs: number }) => Promise<void>)
      | undefined;
    const watchFile = vi.spyOn(fs, "watchFile") as unknown as {
      mockImplementation(
        implementation: (...args: unknown[]) => fs.StatWatcher,
      ): void;
    };
    watchFile.mockImplementation((...args: unknown[]) => {
      const callback = args.at(-1) as (curr: fs.Stats, prev: fs.Stats) => void;
      listener = async (curr) => {
        await callback(curr as fs.Stats, {} as fs.Stats);
      };
      return undefined as unknown as fs.StatWatcher;
    });
    vi.spyOn(fs, "unwatchFile").mockImplementation(() => undefined);
    const service = new ClientLogService();
    const internals = service as unknown as {
      isProcessing: boolean;
      lastKnownSize: number;
      openFileDescriptor(path: string): void;
      processNewBytes(path: string, size: number, game: "poe1"): Promise<void>;
    };
    const processNewBytes = vi.spyOn(internals, "processNewBytes");
    const openFileDescriptor = vi.spyOn(internals, "openFileDescriptor");

    service.watchFile(path, "poe1");
    if (!listener) {
      throw new Error("Expected watch listener to be registered");
    }

    internals.isProcessing = true;
    await listener({ size: 20, birthtimeMs: 1 });
    expect(processNewBytes).not.toHaveBeenCalled();

    internals.isProcessing = false;
    await listener({ size: 0, birthtimeMs: 0 });
    expect(service.getStatus()).toMatchObject({ watching: true });

    internals.lastKnownSize = 100;
    await listener({ size: 50, birthtimeMs: 1 });
    expect(openFileDescriptor).toHaveBeenCalledWith(path);

    openFileDescriptor.mockClear();
    internals.lastKnownSize = 50;
    await listener({ size: 50, birthtimeMs: 1 });
    expect(openFileDescriptor).not.toHaveBeenCalled();

    processNewBytes.mockRejectedValueOnce(new Error("read failed"));
    internals.lastKnownSize = 0;
    await listener({ size: 10, birthtimeMs: 1 });
    expect(service.getStatus().lastError).toBe("read failed");
    expect(send).toHaveBeenCalledWith(
      ClientLogChannel.StatusChanged,
      expect.objectContaining({ lastError: "read failed" }),
    );
    service.stopWatchFile();
  });

  it("registers IPC handlers with validation", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "existing\n");
    const update = vi.fn((input: unknown) => ({
      ...createDefaultSettings(),
      ...(typeof input === "object" && input !== null ? input : {}),
      poe1ClientTxtPath: path,
    }));
    const get = vi.fn().mockReturnValue({
      ...createDefaultSettings(),
      activeGame: "poe1",
      poe1ClientTxtPath: path,
    });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get,
      update,
    } as unknown as SettingsStoreService);
    const { handlers } = mockIpcMainHandlers();
    const service = new ClientLogService();

    expect(await handlers.get(ClientLogChannel.GetStatus)?.({})).toMatchObject({
      activeGame: "poe1",
    });
    expect(
      await handlers.get(ClientLogChannel.SetPath)?.(
        {},
        { game: "poe1", path },
      ),
    ).toMatchObject({ path, watching: true });
    expect(
      await handlers.get(ClientLogChannel.SetActiveGame)?.(
        {},
        { game: "poe1" },
      ),
    ).toMatchObject({ path, watching: true });
    expect(await handlers.get(ClientLogChannel.SetPath)?.({}, null)).toEqual({
      ok: false,
      error: "client log path must be an object",
    });
    expect(
      await handlers.get(ClientLogChannel.SetPath)?.(
        {},
        { game: "poe3", path },
      ),
    ).toEqual({
      ok: false,
      error: "game must be poe1 or poe2",
    });
    expect(
      await handlers.get(ClientLogChannel.SetActiveGame)?.(
        {},
        { game: "poe3" },
      ),
    ).toEqual({
      ok: false,
      error: "game must be poe1 or poe2",
    });
    service.stopWatchFile();
  });

  it("processes new complete death lines and dispatches replay creation", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "");
    const handleDeathEvent = vi.fn().mockResolvedValue(null);
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      handleDeathEvent,
    } as unknown as ReplayClipsService);
    const service = new ClientLogService();
    const deaths: unknown[] = [];
    service.on("death", (event) => deaths.push(event));
    const internals = service as unknown as {
      openFileDescriptor(path: string): void;
      processNewBytes(path: string, size: number, game: "poe1"): Promise<void>;
    };

    internals.openFileDescriptor(path);
    const text =
      "2026/06/12 12:00:00 123 [INFO Client] : SomeCharacter has been slain.\npartial";
    writeFileSync(path, text);
    await internals.processNewBytes(path, Buffer.byteLength(text), "poe1");
    service.stopWatchFile();

    expect(deaths).toEqual([
      expect.objectContaining({
        game: "poe1",
        line: "2026/06/12 12:00:00 123 [INFO Client] : SomeCharacter has been slain.",
        lineHash: expect.any(String),
        detectedAt: expect.any(String),
      }),
    ]);
    expect(handleDeathEvent).toHaveBeenCalledWith(deaths[0]);
  });

  it("stores partial log lines until a complete line arrives", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "");
    const service = new ClientLogService();
    const internals = service as unknown as {
      openFileDescriptor(path: string): void;
      partialLine: string;
      processNewBytes(path: string, size: number, game: "poe1"): Promise<void>;
    };

    internals.openFileDescriptor(path);
    writeFileSync(path, "partial line");
    await internals.processNewBytes(
      path,
      Buffer.byteLength("partial line"),
      "poe1",
    );
    expect(internals.partialLine).toBe("partial line");
    service.stopWatchFile();
  });

  it("processes appended log data in bounded chunks", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "");
    const service = new ClientLogService();
    const internals = service as unknown as {
      openFileDescriptor(path: string): void;
      processNewBytes(path: string, size: number, game: "poe1"): Promise<void>;
    };

    internals.openFileDescriptor(path);
    const readSync = vi.spyOn(fs, "readSync");
    const text = [
      "x".repeat(70 * 1024),
      "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
      "",
    ].join("\n");
    writeFileSync(path, text);

    await internals.processNewBytes(path, Buffer.byteLength(text), "poe1");

    const readLengths = (readSync.mock.calls as unknown[][]).map(
      (call) => call[3],
    );
    expect(readLengths.length).toBeGreaterThan(1);
    expect(
      readLengths.every(
        (length) => typeof length === "number" && length <= 64 * 1024,
      ),
    ).toBe(true);
    expect(setPoeFocusActive).toHaveBeenCalledWith(true);
    service.stopWatchFile();
  });

  it("caps oversized partial log lines", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "");
    const service = new ClientLogService();
    const internals = service as unknown as {
      openFileDescriptor(path: string): void;
      partialLine: string;
      processNewBytes(path: string, size: number, game: "poe1"): Promise<void>;
    };

    internals.openFileDescriptor(path);
    const text = "x".repeat(70 * 1024);
    writeFileSync(path, text);

    await internals.processNewBytes(path, Buffer.byteLength(text), "poe1");

    expect(internals.partialLine).toHaveLength(64 * 1024);
    service.stopWatchFile();
  });

  it("stops chunk processing when a read makes no progress", async () => {
    const path = join(directory, "Client.txt");
    writeFileSync(path, "");
    const service = new ClientLogService();
    const internals = service as unknown as {
      lastKnownSize: number;
      openFileDescriptor(path: string): void;
      processNewBytes(path: string, size: number, game: "poe1"): Promise<void>;
    };

    internals.openFileDescriptor(path);
    writeFileSync(path, "new data");
    vi.spyOn(fs, "readSync").mockReturnValue(0);

    await internals.processNewBytes(
      path,
      Buffer.byteLength("new data"),
      "poe1",
    );

    expect(internals.lastKnownSize).toBe(0);
    service.stopWatchFile();
  });

  it("handles recent focus tail reads when unavailable or unreadable", () => {
    const path = join(directory, "Client.txt");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = new ClientLogService();
    const internals = service as unknown as {
      fd: number | null;
      getCurrentLogFileSize(): number;
      lastKnownSize: number;
      readLatestFocusStateFromRecentFileTail(filePath: string): boolean | null;
    };

    internals.fd = null;
    internals.lastKnownSize = 10;
    expect(internals.readLatestFocusStateFromRecentFileTail(path)).toBeNull();
    expect(internals.getCurrentLogFileSize()).toBe(0);

    internals.fd = 1;
    const readSync = vi.spyOn(fs, "readSync").mockImplementation(() => {
      throw new Error("read failed");
    });

    expect(internals.readLatestFocusStateFromRecentFileTail(path)).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "WARN [client-log] Client log focus state read failed",
      ),
      expect.objectContaining({
        error: "read failed",
        clientLogFile: "Client.txt",
      }),
    );

    readSync.mockRestore();
    internals.lastKnownSize = 42;
    vi.spyOn(fs, "fstatSync").mockImplementation(() => {
      throw new Error("stat failed");
    });
    expect(internals.getCurrentLogFileSize()).toBe(42);
  });

  it("skips destroyed windows when publishing watcher status", () => {
    const destroyedSend = vi.fn();
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send: destroyedSend } },
    ]);
    const service = new ClientLogService();
    const internals = service as unknown as {
      publishStatus(): void;
    };

    internals.publishStatus();

    expect(destroyedSend).not.toHaveBeenCalled();
  });
});
