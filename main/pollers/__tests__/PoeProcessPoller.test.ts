import { beforeEach, describe, expect, it, vi } from "vitest";

const processMocks = vi.hoisted(() => ({
  findRunningProcesses: vi.fn(),
  listWindowsProcessWindowTitles: vi.fn(),
}));
const electronMocks = vi.hoisted(() => ({
  getSources: vi.fn(),
}));

vi.mock("../isProcessRunning", () => ({
  findRunningProcesses: processMocks.findRunningProcesses,
  listWindowsProcessWindowTitles: processMocks.listWindowsProcessWindowTitles,
}));
vi.mock("electron", () => ({
  desktopCapturer: {
    getSources: electronMocks.getSources,
  },
}));

import {
  detectPoeProcessState,
  detectPoeProcessWindowGame,
  detectRunningPoeWindowGame,
  isAmbiguousPoeProcessName,
  isPoeProcessStateForGame,
  POE_PROCESS_NAMES,
  POE_PROCESS_POLL_INTERVAL_MS,
  PoeProcessPoller,
  resolvePoeProcessGame,
} from "../PoeProcessPoller";

describe("PoeProcessPoller", () => {
  beforeEach(() => {
    processMocks.findRunningProcesses.mockReset();
    processMocks.listWindowsProcessWindowTitles.mockReset();
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([]);
    electronMocks.getSources.mockReset();
    electronMocks.getSources.mockResolvedValue([]);
  });

  it("defines known PoE process names and poll interval", () => {
    expect(POE_PROCESS_NAMES).toContain("PathOfExileSteam.exe");
    expect(POE_PROCESS_NAMES).toContain("PathOfExile.exe");
    expect(POE_PROCESS_NAMES).toContain("PathOfExile2Steam.exe");
    expect(POE_PROCESS_NAMES).toContain("PathOfExile2.exe");
    expect(POE_PROCESS_POLL_INTERVAL_MS).toBe(5_000);
  });

  it("resolves process names to game ids", () => {
    expect(resolvePoeProcessGame("PathOfExileSteam.exe")).toBeNull();
    expect(resolvePoeProcessGame("PathOfExile.exe")).toBe("poe1");
    expect(resolvePoeProcessGame("PathOfExile_x64Steam.exe")).toBe("poe1");
    expect(resolvePoeProcessGame("PathOfExile2Steam.exe")).toBe("poe2");
    expect(resolvePoeProcessGame("PathOfExile2.exe")).toBe("poe2");
    expect(resolvePoeProcessGame("")).toBeNull();
    expect(isAmbiguousPoeProcessName("PathOfExileSteam.exe")).toBe(true);
    expect(isAmbiguousPoeProcessName("PathOfExile.exe")).toBe(false);
    expect(isAmbiguousPoeProcessName("PathOfExile2Steam.exe")).toBe(false);
  });

  it("checks whether a process state belongs to a game", () => {
    expect(
      isPoeProcessStateForGame(
        { isRunning: true, processName: "PathOfExile2Steam.exe" },
        "poe2",
      ),
    ).toBe(true);
    expect(
      isPoeProcessStateForGame(
        { isRunning: true, processName: "PathOfExileSteam.exe" },
        "poe2",
      ),
    ).toBe(false);
    expect(
      isPoeProcessStateForGame({ isRunning: false, processName: "" }, "poe1"),
    ).toBe(false);
    expect(
      isPoeProcessStateForGame(
        { isRunning: true, processName: "PathOfExile.exe" },
        "poe1",
      ),
    ).toBe(true);
  });

  it("detects the current PoE process state", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExile2Steam.exe",
    ]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    expect(processMocks.findRunningProcesses).toHaveBeenCalledWith(
      POE_PROCESS_NAMES,
    );
  });

  it("detects standalone PoE process names", async () => {
    processMocks.findRunningProcesses.mockResolvedValueOnce([
      "PathOfExile.exe",
    ]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });

    processMocks.findRunningProcesses.mockResolvedValueOnce([
      "PathOfExile2.exe",
    ]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("prefers the selected game when multiple PoE processes are running", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExile_x64Steam.exe",
      "PathOfExile2Steam.exe",
    ]);

    await expect(detectPoeProcessState(null, "poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("uses the visible PoE window title when Steam reports a generic PoE process", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([{ name: "Path of Exile 2" }]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    expect(electronMocks.getSources).toHaveBeenCalledWith({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
    });
  });

  it("prefers the selected visible window when Steam reports a generic PoE process", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExile_x64Steam.exe",
      "PathOfExileSteam.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([
      { name: "Path of Exile" },
      { name: "Path of Exile 2" },
    ]);

    await expect(detectPoeProcessState(null, "poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("canonicalizes a visible PoE1 Steam window to an unambiguous PoE1 state", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([{ name: "Path of Exile" }]);

    const state = await detectPoeProcessState();

    expect(state).toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
    expect(isPoeProcessStateForGame(state, "poe1")).toBe(true);
  });

  it("uses the process window title when desktop capture misses a generic Steam process", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      { processName: "PathOfExileSteam.exe", windowTitle: "Path of Exile 2" },
    ]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await expect(
      detectPoeProcessWindowGame("PathOfExileSteam.exe"),
    ).resolves.toBe("poe2");
    await expect(
      detectPoeProcessWindowGame("PathOfExile2Steam.exe"),
    ).resolves.toBeNull();
  });

  it("prefers the selected game from a generic Steam process window title", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      { processName: "PathOfExileSteam.exe", windowTitle: "Path of Exile 2" },
    ]);

    await expect(detectPoeProcessState(null, "poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("prefers the selected visible window over a generic Steam process", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
      "PathOfExile.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([
      { name: "Path of Exile" },
      { name: "Path of Exile 2" },
    ]);

    await expect(detectPoeProcessState(null, "poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("canonicalizes a PoE1 process window title to an unambiguous PoE1 state", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      { processName: "PathOfExileSteam.exe", windowTitle: "Path of Exile" },
    ]);

    const state = await detectPoeProcessState();

    expect(state).toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
    expect(isPoeProcessStateForGame(state, "poe1")).toBe(true);
  });

  it("falls back to the raw process name when an ambiguous process has no preferred game", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
  });

  it("ignores ambiguous process window titles that do not identify a PoE game", async () => {
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      { processName: "PathOfExileSteam.exe", windowTitle: "Steam" },
    ]);

    await expect(
      detectPoeProcessWindowGame("PathOfExileSteam.exe"),
    ).resolves.toBeNull();
  });

  it("keeps the last known game when Steam reports an ambiguous generic process", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([]);

    await expect(detectPoeProcessState("poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("uses the fallback game when an ambiguous Steam process has no detectable title", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([]);

    await expect(detectPoeProcessState(null, "poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("uses the PoE1 fallback game as an unambiguous PoE1 state", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([]);

    const state = await detectPoeProcessState(null, "poe1");

    expect(state).toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
    expect(isPoeProcessStateForGame(state, "poe1")).toBe(true);
  });

  it("detects the running PoE game from desktop window titles", async () => {
    electronMocks.getSources.mockResolvedValue([
      { name: "Visual Studio Code" },
      { name: "Path of Exile" },
    ]);

    await expect(detectRunningPoeWindowGame()).resolves.toBe("poe1");
  });

  it("ignores desktop capture failures while detecting window titles", async () => {
    electronMocks.getSources.mockRejectedValue(new Error("capture failed"));

    await expect(detectRunningPoeWindowGame()).resolves.toBeNull();
  });

  it("returns stopped state when no PoE process is found", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
    expect(electronMocks.getSources).not.toHaveBeenCalled();
  });

  it("polls using the PoE process list", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExile_x64Steam.exe",
    ]);
    const poller = new PoeProcessPoller();

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
    expect(processMocks.findRunningProcesses).toHaveBeenCalledWith(
      POE_PROCESS_NAMES,
    );
  });

  it("keeps PoE2 state through ambiguous Steam names and transient missed scans", async () => {
    const poller = new PoeProcessPoller();
    processMocks.findRunningProcesses
      .mockResolvedValueOnce(["PathOfExileSteam.exe"])
      .mockResolvedValueOnce(["PathOfExileSteam.exe"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    electronMocks.getSources
      .mockResolvedValueOnce([{ name: "Path of Exile 2" }])
      .mockResolvedValue([]);

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("uses the poller fallback game for the first ambiguous Steam poll", async () => {
    const poller = new PoeProcessPoller(() => "poe2");
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    electronMocks.getSources.mockResolvedValue([]);

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });
});
