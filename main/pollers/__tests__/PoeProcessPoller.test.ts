import { beforeEach, describe, expect, it, vi } from "vitest";

const processMocks = vi.hoisted(() => ({
  findRunningProcesses: vi.fn(),
}));

vi.mock("../isProcessRunning", () => ({
  findRunningProcesses: processMocks.findRunningProcesses,
}));

import {
  detectPoeProcessState,
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
  });

  it("detects the current PoE process state from unambiguous processes", async () => {
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

    processMocks.findRunningProcesses.mockResolvedValueOnce([
      "PathOfExile.exe",
    ]);
    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
  });

  it("uses the active game as the only process tie-breaker", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExile_x64Steam.exe",
      "PathOfExile2Steam.exe",
    ]);

    await expect(detectPoeProcessState("poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await expect(detectPoeProcessState("poe1")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
  });

  it("treats the generic Steam process as the active game when configured", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);

    await expect(detectPoeProcessState("poe2")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
    await expect(detectPoeProcessState("poe1")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
  });

  it("falls back to the raw generic Steam process without an active game", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
  });

  it("returns stopped state when no PoE process is found", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("polls using the active game fallback and keeps transient misses debounced", async () => {
    const poller = new PoeProcessPoller(() => "poe2");
    processMocks.findRunningProcesses
      .mockResolvedValueOnce(["PathOfExileSteam.exe"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

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

  it("polls without an active game fallback", async () => {
    const poller = new PoeProcessPoller();
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExile2Steam.exe",
    ]);

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });
});
