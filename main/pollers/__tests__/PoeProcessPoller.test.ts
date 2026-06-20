import { beforeEach, describe, expect, it, vi } from "vitest";

const processMocks = vi.hoisted(() => ({
  findRunningProcess: vi.fn(),
  listWindowsProcessWindowTitles: vi.fn(),
}));
const electronMocks = vi.hoisted(() => ({
  getSources: vi.fn(),
}));

vi.mock("../isProcessRunning", () => ({
  findRunningProcess: processMocks.findRunningProcess,
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
    processMocks.findRunningProcess.mockReset();
    processMocks.listWindowsProcessWindowTitles.mockReset();
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([]);
    electronMocks.getSources.mockReset();
    electronMocks.getSources.mockResolvedValue([]);
  });

  it("defines known PoE process names and poll interval", () => {
    expect(POE_PROCESS_NAMES).toContain("PathOfExileSteam.exe");
    expect(POE_PROCESS_NAMES).toContain("PathOfExile2Steam.exe");
    expect(POE_PROCESS_POLL_INTERVAL_MS).toBe(5_000);
  });

  it("resolves process names to game ids", () => {
    expect(resolvePoeProcessGame("PathOfExileSteam.exe")).toBeNull();
    expect(resolvePoeProcessGame("PathOfExile_x64Steam.exe")).toBe("poe1");
    expect(resolvePoeProcessGame("PathOfExile2Steam.exe")).toBe("poe2");
    expect(resolvePoeProcessGame("")).toBeNull();
    expect(isAmbiguousPoeProcessName("PathOfExileSteam.exe")).toBe(true);
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
  });

  it("detects the current PoE process state", async () => {
    processMocks.findRunningProcess.mockResolvedValue("PathOfExile2Steam.exe");

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    expect(processMocks.findRunningProcess).toHaveBeenCalledWith(
      POE_PROCESS_NAMES,
    );
  });

  it("uses the visible PoE window title when Steam reports a generic PoE process", async () => {
    processMocks.findRunningProcess.mockResolvedValue("PathOfExileSteam.exe");
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

  it("uses the process window title when desktop capture misses a generic Steam process", async () => {
    processMocks.findRunningProcess.mockResolvedValue("PathOfExileSteam.exe");
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

  it("ignores ambiguous process window titles that do not identify a PoE game", async () => {
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      { processName: "PathOfExileSteam.exe", windowTitle: "Steam" },
    ]);

    await expect(
      detectPoeProcessWindowGame("PathOfExileSteam.exe"),
    ).resolves.toBeNull();
  });

  it("keeps the last known game when Steam reports an ambiguous generic process", async () => {
    processMocks.findRunningProcess.mockResolvedValue("PathOfExileSteam.exe");
    electronMocks.getSources.mockResolvedValue([]);

    await expect(detectPoeProcessState("poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("uses the fallback game when an ambiguous Steam process has no detectable title", async () => {
    processMocks.findRunningProcess.mockResolvedValue("PathOfExileSteam.exe");
    electronMocks.getSources.mockResolvedValue([]);

    await expect(detectPoeProcessState(null, "poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
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
    processMocks.findRunningProcess.mockResolvedValue(null);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
    expect(electronMocks.getSources).not.toHaveBeenCalled();
  });

  it("polls using the PoE process list", async () => {
    processMocks.findRunningProcess.mockResolvedValue(
      "PathOfExile_x64Steam.exe",
    );
    const poller = new PoeProcessPoller();

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
    expect(processMocks.findRunningProcess).toHaveBeenCalledWith(
      POE_PROCESS_NAMES,
    );
  });

  it("keeps PoE2 state through ambiguous Steam names and transient missed scans", async () => {
    const poller = new PoeProcessPoller();
    processMocks.findRunningProcess
      .mockResolvedValueOnce("PathOfExileSteam.exe")
      .mockResolvedValueOnce("PathOfExileSteam.exe")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
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
    processMocks.findRunningProcess.mockResolvedValue("PathOfExileSteam.exe");
    electronMocks.getSources.mockResolvedValue([]);

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });
});
