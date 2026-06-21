import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIpcMainHandlers } from "~/main/test/ipc";

import { CapturePreviewChannel } from "../CapturePreview.channels";
import { CapturePreviewService } from "../CapturePreview.service";

const electronMocks = vi.hoisted(() => ({
  getAllDisplays: vi.fn(),
  getPrimaryDisplay: vi.fn(),
  getSources: vi.fn(),
}));

const processMocks = vi.hoisted(() => ({
  detectPoeProcessState: vi.fn(),
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

vi.mock("~/main/pollers", () => ({
  detectPoeProcessState: processMocks.detectPoeProcessState,
  isPoeProcessStateForGame: (
    state: { isRunning: boolean; processName: string },
    game: "poe1" | "poe2",
  ) => {
    if (!state.isRunning) {
      return false;
    }

    const stateGame = state.processName.toLowerCase().includes("pathofexile2")
      ? "poe2"
      : "poe1";

    return stateGame === game;
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
): Electron.Display {
  return {
    id,
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

beforeEach(() => {
  electronMocks.getPrimaryDisplay.mockReturnValue(createDisplay(1, 1920, 1080));
  processMocks.detectPoeProcessState.mockResolvedValue({
    isRunning: true,
    processName: "PathOfExile2Steam.exe",
  });
});

afterEach(() => {
  electronMocks.getAllDisplays.mockReset();
  electronMocks.getPrimaryDisplay.mockReset();
  electronMocks.getSources.mockReset();
  processMocks.detectPoeProcessState.mockReset();
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
    const primaryDisplay = createDisplay(1, 1920, 1080, 1.5);
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
        name: "Path of Exile 2",
        thumbnailDataUrl: null,
      }),
      createSource({
        id: "window:poe:4",
        name: "Path of Exile 2",
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
        name: "Screen 1",
        kind: "screen",
        displayId: "1",
        width: 2880,
        height: 1620,
        thumbnailDataUrl: "data:image/png;base64,screen",
      },
      {
        id: "window:poe:3",
        name: "Path of Exile 2",
        kind: "window",
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

  it("lists exact Path of Exile title matches when a game process is running", async () => {
    processMocks.detectPoeProcessState.mockResolvedValue({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({ id: "window:poe:1", name: "Path of Exile" }),
      createSource({ id: "window:poe:2", name: "Path   of   Exile 2" }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({
        id: "window:poe:1",
        kind: "window",
        name: "Path of Exile 1",
      }),
    ]);
  });

  it("rejects broad Path of Exile title matches", async () => {
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

    await expect(service.listSources()).resolves.toEqual([]);
  });

  it("filters exact Path of Exile title matches when no game process is running", async () => {
    processMocks.detectPoeProcessState.mockResolvedValue({
      isRunning: false,
      processName: "",
    });
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({ id: "screen:1:0", name: "Entire Screen" }),
      createSource({ id: "window:steam:1", name: "Path of Exile 2" }),
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
    await expect(service.listSources()).resolves.toEqual([
      expect.objectContaining({ id: "screen:2:0" }),
    ]);
    expect(electronMocks.getSources).toHaveBeenCalledTimes(2);
  });

  it("shares an in-flight source listing request", async () => {
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
    const second = service.listSources();

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
      expect.stringContaining(
        "WARN [capture-preview] Capture source listing was slow",
      ),
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

  it("detects running Path of Exile games from exact window titles and process state", async () => {
    processMocks.detectPoeProcessState.mockResolvedValue({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({ id: "window:poe1:1", name: "Path of Exile" }),
      createSource({ id: "window:chrome:2", name: "Path of Exile 2 - Chrome" }),
    ]);
    const service = new CapturePreviewService();

    await expect(service.isGameRunning("poe1")).resolves.toBe(true);
    await expect(service.isGameRunning("poe2")).resolves.toBe(false);
    expect(electronMocks.getSources).toHaveBeenCalledWith({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
    });
  });

  it("reports games offline without listing windows when no game process is running", async () => {
    processMocks.detectPoeProcessState.mockResolvedValue({
      isRunning: false,
      processName: "",
    });
    electronMocks.getAllDisplays.mockReturnValue([]);
    const service = new CapturePreviewService();

    await expect(
      service.isGameRunning("poe2", { forceRefresh: true }),
    ).resolves.toBe(false);
    expect(electronMocks.getSources).not.toHaveBeenCalled();
  });

  it("shares an in-flight running game lookup", async () => {
    processMocks.detectPoeProcessState.mockResolvedValue({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    let resolveSources!: (sources: Electron.DesktopCapturerSource[]) => void;
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockImplementation(
      () =>
        new Promise<Electron.DesktopCapturerSource[]>((resolve) => {
          resolveSources = resolve;
        }),
    );
    const service = new CapturePreviewService();

    const first = service.isGameRunning("poe1");
    const second = service.isGameRunning("poe2");

    await Promise.resolve();
    expect(electronMocks.getSources).toHaveBeenCalledTimes(1);
    resolveSources([
      createSource({ id: "window:poe1:1", name: "Path of Exile" }),
    ]);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
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
    processMocks.detectPoeProcessState.mockResolvedValue({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    electronMocks.getAllDisplays.mockReturnValue([]);
    electronMocks.getSources.mockResolvedValue([
      createSource({ id: "window:poe:1", name: "Path of Exile" }),
    ]);
    const service = new CapturePreviewService();

    await expect(
      handlers.get(CapturePreviewChannel.ListSources)?.({}),
    ).resolves.toEqual([
      {
        displayId: null,
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
    expect(service).toBeInstanceOf(CapturePreviewService);
    expect(handle).toHaveBeenCalledTimes(2);
  });
});
