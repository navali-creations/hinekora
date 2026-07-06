import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
} from "~/main/modules/poe-process/PoeProcess.dto";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import { createPoeProcessSnapshotFromState } from "~/main/test/poe-process";

import { CapturePreviewChannel } from "../CapturePreview.channels";
import { CapturePreviewService } from "../CapturePreview.service";

const electronMocks = vi.hoisted(() => ({
  getAllDisplays: vi.fn(),
  getPrimaryDisplay: vi.fn(),
  getSources: vi.fn(),
}));

const poeProcessMocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  refreshSnapshot: vi.fn(),
}));

const settingsStoreMocks = vi.hoisted(() => ({
  activeGame: "poe2" as "poe1" | "poe2",
  get: vi.fn(),
}));

vi.mock("electron", () => ({
  desktopCapturer: {
    getSources: electronMocks.getSources,
  },
  screen: {
    getAllDisplays: electronMocks.getAllDisplays,
    getPrimaryDisplay: electronMocks.getPrimaryDisplay,
  },
}));

vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: () => ({
      get: settingsStoreMocks.get,
    }),
  },
}));

vi.mock("~/main/modules/poe-process", () => ({
  PoeProcessService: {
    getInstance: () => ({
      getSnapshot: poeProcessMocks.getSnapshot,
      refreshSnapshot: poeProcessMocks.refreshSnapshot,
    }),
  },
}));

function createThumbnail(dataUrl: string | null) {
  return {
    isEmpty: () => dataUrl === null,
    toDataURL: () => dataUrl ?? "",
  };
}

function createDisplay(
  id: number,
  width: number,
  height: number,
  scaleFactor = 1,
  label = "",
): Electron.Display {
  return {
    id,
    label,
    scaleFactor,
    size: { width, height },
  } as Electron.Display;
}

function createSource(
  input: Pick<Electron.DesktopCapturerSource, "id" | "name"> & {
    displayId?: string;
    thumbnailDataUrl?: string | null;
  },
): Electron.DesktopCapturerSource {
  return {
    id: input.id,
    name: input.name,
    display_id: input.displayId ?? "",
    thumbnail: createThumbnail(input.thumbnailDataUrl ?? null),
  } as unknown as Electron.DesktopCapturerSource;
}

function createCapturePreviewSnapshotFromState(
  state: Parameters<typeof createPoeProcessSnapshotFromState>[0],
) {
  return createPoeProcessSnapshotFromState(
    state,
    settingsStoreMocks.activeGame,
  );
}

beforeEach(() => {
  settingsStoreMocks.activeGame = "poe2";
  settingsStoreMocks.get.mockImplementation(() => ({
    activeGame: settingsStoreMocks.activeGame,
  }));
  electronMocks.getPrimaryDisplay.mockReturnValue(createDisplay(1, 1920, 1080));
  poeProcessMocks.getSnapshot.mockImplementation(() =>
    createCapturePreviewSnapshotFromState({
      game: settingsStoreMocks.activeGame,
      isRunning: true,
      processName:
        settingsStoreMocks.activeGame === "poe1"
          ? "PathOfExile.exe"
          : "PathOfExileSteam.exe",
    }),
  );
  poeProcessMocks.refreshSnapshot.mockImplementation(async () =>
    poeProcessMocks.getSnapshot(),
  );
});

afterEach(() => {
  electronMocks.getAllDisplays.mockReset();
  electronMocks.getPrimaryDisplay.mockReset();
  electronMocks.getSources.mockReset();
  poeProcessMocks.getSnapshot.mockReset();
  poeProcessMocks.refreshSnapshot.mockReset();
  settingsStoreMocks.get.mockReset();
  vi.restoreAllMocks();
});

describe("CapturePreviewService", () => {
  it("creates and reuses the singleton instance", () => {
    const singletonAccess = CapturePreviewService as unknown as {
      instance: CapturePreviewService | null;
    };
    singletonAccess.instance = null;

    const first = CapturePreviewService.getInstance();
    const second = CapturePreviewService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("lists renderer-ready Path of Exile capture sources", async () => {
    const primaryDisplay = createDisplay(
      1,
      1920,
      1080,
      1.5,
      "Display Model Alpha",
    );
    electronMocks.getAllDisplays.mockReturnValue([primaryDisplay]);
    electronMocks.getPrimaryDisplay.mockReturnValue(primaryDisplay);
    electronMocks.getSources.mockResolvedValue([
      createSource({
        id: "screen:1:0",
        name: "Entire Screen",
        displayId: "1",
        thumbnailDataUrl: "data:image/png;base64,screen",
      }),
      createSource({
        id: "window:chrome:1",
        name: "Google Chrome",
        thumbnailDataUrl: "data:image/png;base64,chrome",
      }),
      createSource({
        id: "window:chrome-tab:2",
        name: "Path of Exile - Google Chrome",
        thumbnailDataUrl: "data:image/png;base64,chrome-tab",
      }),
      createSource({
        id: "window:poe:3",
        name: "[PathOfExileSteam.exe]: Path of Exile 2",
        thumbnailDataUrl: null,
      }),
      createSource({
        id: "window:poe:4",
        name: "Path of Exile 2:POEWindowClass:PathOfExileSteam.exe",
        thumbnailDataUrl: null,
      }),
      createSource({
        id: "window:process:5",
        name: "PathOfExileSteam.exe",
        thumbnailDataUrl: null,
      }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([
      {
        id: "screen:1:0",
        name: "Screen 1 (Display Model Alpha)",
        kind: "screen",
        displayId: "1",
        width: 2880,
        height: 1620,
        thumbnailDataUrl: null,
      },
      {
        id: "window:poe:3",
        name: "Path of Exile 2",
        kind: "window",
        game: "poe2",
        displayId: null,
        width: 2880,
        height: 1620,
        thumbnailDataUrl: null,
      },
    ]);
  });

  it("keeps display dimensions nullable when Electron reports an unknown display id", async () => {
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({
        id: "screen:99:0",
        name: "Entire Screen",
        displayId: "99",
      }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({
        displayId: "99",
        width: null,
        height: null,
      }),
    ]);
  });

  it("omits blank Electron display labels from screen source names", async () => {
    electronMocks.getAllDisplays.mockReturnValue([
      createDisplay(1, 1920, 1080, 1, "   "),
    ]);
    electronMocks.getSources.mockResolvedValue([
      createSource({
        id: "screen:1:0",
        name: "Entire Screen",
        displayId: "1",
      }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({
        id: "screen:1:0",
        name: "Screen 1",
      }),
    ]);
  });

  it("lists Path of Exile window title matches when a game process is running", async () => {
    settingsStoreMocks.activeGame = "poe1";
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({
        id: "window:poe:1",
        name: "[PathOfExileSteam.exe]: Path of Exile",
      }),
      createSource({
        id: "window:poe:2",
        name: "Path   of   Exile 2:POEWindowClass:PathOfExileSteam.exe",
      }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({
        id: "window:poe:1",
        kind: "window",
        name: "Path of Exile 1",
      }),
    ]);
    expect(poeProcessMocks.getSnapshot).toHaveBeenCalled();
  });

  it("uses the resolved process game for process-only capture source names", async () => {
    settingsStoreMocks.activeGame = "poe1";
    poeProcessMocks.getSnapshot.mockReturnValue(
      createCapturePreviewSnapshotFromState({
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      }),
    );
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({
        id: "window:chrome:1",
        name: "Path of Exile 2 - Google Chrome",
      }),
      createSource({ id: "window:process:2", name: "PathOfExileSteam.exe" }),
      createSource({ id: "window:poe-short:3", name: "PoE 2" }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([
      {
        id: "window:process:2",
        name: "Path of Exile 2",
        kind: "window",
        game: "poe2",
        displayId: null,
        width: 1920,
        height: 1080,
        thumbnailDataUrl: null,
      },
    ]);
  });

  it("omits process-only capture sources when the process game is ambiguous", async () => {
    poeProcessMocks.getSnapshot.mockReturnValue(
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({ id: "window:process:1", name: "PathOfExileSteam.exe" }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([]);
  });

  it("rejects broad Path of Exile title matches", async () => {
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({
        id: "window:chrome:1",
        name: "Path of Exile 2 - Google Chrome",
      }),
      createSource({ id: "window:poe-short:2", name: "PoE 2" }),
      createSource({ id: "window:other-process:3", name: "OtherGame.exe" }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([]);
  });

  it("filters Path of Exile title matches when no game process is running", async () => {
    poeProcessMocks.getSnapshot.mockReturnValue(
      createPoeProcessSnapshot(createStoppedPoeProcessStates(), "poe2"),
    );
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({ id: "screen:1:0", name: "Entire Screen" }),
      createSource({
        id: "window:steam:1",
        name: "[PathOfExileSteam.exe]: Path of Exile 2",
      }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({
        id: "screen:1:0",
        kind: "screen",
      }),
    ]);
  });

  it("reuses source lists until a force refresh is requested", async () => {
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources
      .mockResolvedValueOnce([
        createSource({ id: "screen:1:0", name: "Entire Screen" }),
      ])
      .mockResolvedValueOnce([
        createSource({ id: "screen:2:0", name: "Entire Screen" }),
      ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({ id: "screen:1:0" }),
    ]);
    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({ id: "screen:1:0" }),
    ]);
    expect(electronMocks.getSources).toHaveBeenCalledTimes(1);

    await expect(service.listSources({ forceRefresh: true })).resolves.toEqual([
      expect.objectContaining({ id: "screen:2:0" }),
    ]);
    expect(poeProcessMocks.refreshSnapshot).toHaveBeenCalledWith({
      requestCapturePreviewRefresh: false,
    });
    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({ id: "screen:2:0" }),
    ]);
    expect(electronMocks.getSources).toHaveBeenCalledTimes(2);
  });

  it("expires stale source thumbnails and caps retained thumbnail cache entries", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    electronMocks.getAllDisplays.mockReturnValue([]);
    const service = new CapturePreviewService();
    const internals = service as unknown as {
      sourceThumbnailCache: Map<string, unknown>;
    };

    for (let index = 0; index < 18; index += 1) {
      const sourceId = `screen:${index}:0`;
      electronMocks.getSources.mockResolvedValueOnce([
        createSource({
          id: sourceId,
          name: "Entire Screen",
          thumbnailDataUrl: `data:image/png;base64,screen-${index}`,
        }),
      ]);

      await expect(service.getSourceThumbnail(sourceId)).resolves.toBe(
        `data:image/png;base64,screen-${index}`,
      );
    }

    expect(internals.sourceThumbnailCache.size).toBe(16);
    expect(internals.sourceThumbnailCache.has("screen:0:0")).toBe(false);
    expect(internals.sourceThumbnailCache.has("screen:17:0")).toBe(true);

    await expect(service.getSourceThumbnail("screen:17:0")).resolves.toBe(
      "data:image/png;base64,screen-17",
    );
    expect(electronMocks.getSources).toHaveBeenCalledTimes(18);

    now += 11_000;
    electronMocks.getSources.mockResolvedValueOnce([
      createSource({
        id: "screen:17:0",
        name: "Entire Screen",
        thumbnailDataUrl: "data:image/png;base64,screen-17-new",
      }),
    ]);

    await expect(service.getSourceThumbnail("screen:17:0")).resolves.toBe(
      "data:image/png;base64,screen-17-new",
    );
    expect(internals.sourceThumbnailCache.size).toBe(1);
    expect(electronMocks.getSources).toHaveBeenCalledTimes(19);
  });

  it("shares in-flight source thumbnail requests", async () => {
    let resolveSources!: (sources: Electron.DesktopCapturerSource[]) => void;
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockImplementation(
      () =>
        new Promise<Electron.DesktopCapturerSource[]>((resolve) => {
          resolveSources = resolve;
        }),
    );
    const service = new CapturePreviewService();

    const first = service.getSourceThumbnail("screen:1:0");
    const second = service.getSourceThumbnail("screen:1:0");

    expect(electronMocks.getSources).toHaveBeenCalledTimes(1);
    resolveSources([
      createSource({
        id: "screen:1:0",
        name: "Entire Screen",
        thumbnailDataUrl: "data:image/png;base64,screen",
      }),
    ]);
    await expect(first).resolves.toBe("data:image/png;base64,screen");
    await expect(second).resolves.toBe("data:image/png;base64,screen");
  });

  it("returns null for missing and empty source thumbnails", async () => {
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources
      .mockResolvedValueOnce([
        createSource({
          id: "screen:1:0",
          name: "Entire Screen",
          thumbnailDataUrl: "data:image/png;base64,screen",
        }),
      ])
      .mockResolvedValueOnce([
        createSource({
          id: "screen:empty:0",
          name: "Entire Screen",
          thumbnailDataUrl: null,
        }),
      ]);
    const service = new CapturePreviewService();

    await expect(service.getSourceThumbnail("screen:missing:0")).resolves.toBe(
      null,
    );
    await expect(service.getSourceThumbnail("screen:empty:0")).resolves.toBe(
      null,
    );
  });

  it("prunes source thumbnails when refreshed sources no longer exist", async () => {
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources
      .mockResolvedValueOnce([
        createSource({
          id: "screen:1:0",
          name: "Entire Screen",
          thumbnailDataUrl: "data:image/png;base64,screen-1",
        }),
      ])
      .mockResolvedValueOnce([
        createSource({ id: "screen:2:0", name: "Entire Screen" }),
      ]);
    const service = new CapturePreviewService();
    const internals = service as unknown as {
      sourceThumbnailCache: Map<string, unknown>;
    };

    await expect(service.getSourceThumbnail("screen:1:0")).resolves.toBe(
      "data:image/png;base64,screen-1",
    );
    expect(internals.sourceThumbnailCache.has("screen:1:0")).toBe(true);

    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({ id: "screen:2:0" }),
    ]);

    expect(internals.sourceThumbnailCache.has("screen:1:0")).toBe(false);
  });

  it("shares an in-flight source listing request across normal and forced refreshes", async () => {
    let resolveSources!: (sources: Electron.DesktopCapturerSource[]) => void;
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockImplementation(
      () =>
        new Promise<Electron.DesktopCapturerSource[]>((resolve) => {
          resolveSources = resolve;
        }),
    );
    const service = new CapturePreviewService();

    const first = service.listSources();
    const second = service.listSources({ forceRefresh: true });

    expect(electronMocks.getSources).toHaveBeenCalledTimes(1);
    resolveSources([createSource({ id: "screen:1:0", name: "Entire Screen" })]);
    await expect(first).resolves.toEqual([
      expect.objectContaining({ id: "screen:1:0" }),
    ]);
    await expect(second).resolves.toEqual([
      expect.objectContaining({ id: "screen:1:0" }),
    ]);
  });

  it("logs slow source listings with bounded metadata", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(1_260);
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({ id: "screen:1:0", name: "Entire Screen" }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources({ forceRefresh: true })).resolves.toEqual([
      expect.objectContaining({ id: "screen:1:0" }),
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Capture source listing was slow"),
      {
        elapsedMs: 260,
        forceRefresh: true,
        inputSources: 1,
        returnedSources: 1,
      },
    );
  });

  it("caches source ids briefly and refreshes after the cache window", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources
      .mockResolvedValueOnce([
        createSource({ id: "screen:1:0", name: "Entire Screen" }),
      ])
      .mockResolvedValueOnce([
        createSource({ id: "screen:2:0", name: "Entire Screen" }),
      ]);
    const service = new CapturePreviewService();

    await expect(service.sourceExists("screen:1:0")).resolves.toBe(true);
    await expect(service.sourceExists("screen:2:0")).resolves.toBe(false);
    expect(electronMocks.getSources).toHaveBeenCalledTimes(1);

    now += 2_000;
    await expect(service.sourceExists("screen:2:0")).resolves.toBe(true);
    expect(electronMocks.getSources).toHaveBeenCalledTimes(2);
  });

  it("shares an in-flight source id request", async () => {
    let resolveSources!: (sources: Electron.DesktopCapturerSource[]) => void;
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockImplementation(
      () =>
        new Promise<Electron.DesktopCapturerSource[]>((resolve) => {
          resolveSources = resolve;
        }),
    );
    const service = new CapturePreviewService();

    const first = service.sourceExists("screen:1:0");
    const second = service.sourceExists("window:poe:1");

    expect(electronMocks.getSources).toHaveBeenCalledTimes(1);
    resolveSources([createSource({ id: "screen:1:0", name: "Entire Screen" })]);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
  });

  it("registers IPC handlers for source listing and existence checks", async () => {
    const { handle, handlers } = mockIpcMainHandlers();
    settingsStoreMocks.activeGame = "poe1";
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({
        id: "window:poe:1",
        name: "Path of Exile",
        thumbnailDataUrl: "data:image/png;base64,poe",
      }),
    ]);
    const service = new CapturePreviewService();

    await expect(
      handlers.get(CapturePreviewChannel.ListSources)?.({}),
    ).resolves.toEqual([
      {
        displayId: null,
        game: "poe1",
        height: 1080,
        id: "window:poe:1",
        kind: "window",
        name: "Path of Exile 1",
        thumbnailDataUrl: null,
        width: 1920,
      },
    ]);
    await expect(
      handlers.get(CapturePreviewChannel.ListSources)?.({}, true),
    ).resolves.toEqual([expect.objectContaining({ id: "window:poe:1" })]);
    await expect(
      handlers.get(CapturePreviewChannel.SourceExists)?.({}, "window:poe:1"),
    ).resolves.toBe(true);
    await expect(
      handlers.get(CapturePreviewChannel.GetSourceThumbnail)?.(
        {},
        "window:poe:1",
      ),
    ).resolves.toBe("data:image/png;base64,poe");
    expect(
      handlers.get(CapturePreviewChannel.ListSources)?.({}, "yes"),
    ).toEqual({
      error: "forceRefresh must be a boolean",
      ok: false,
    });
    expect(handlers.get(CapturePreviewChannel.SourceExists)?.({}, "")).toEqual({
      error: "sourceId is too short",
      ok: false,
    });
    expect(
      handlers.get(CapturePreviewChannel.GetSourceThumbnail)?.({}, ""),
    ).toEqual({
      error: "sourceId is too short",
      ok: false,
    });
    expect(service).toBeInstanceOf(CapturePreviewService);
    expect(handle).toHaveBeenCalledTimes(3);
  });
});
