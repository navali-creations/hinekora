import { beforeEach, describe, expect, it, vi } from "vitest";

const processMocks = vi.hoisted(() => ({
  findRunningProcesses: vi.fn(),
  listWindowsProcessWindowTitles: vi.fn(),
}));

vi.mock("../isProcessRunning", () => ({
  findRunningProcesses: processMocks.findRunningProcesses,
  listWindowsProcessWindowTitles: processMocks.listWindowsProcessWindowTitles,
}));

import {
  detectPoeProcessState,
  isPoeProcessStateForGame,
  PoeProcessPoller,
} from "../PoeProcessPoller";

describe("PoeProcessPoller", () => {
  beforeEach(() => {
    processMocks.findRunningProcesses.mockReset();
    processMocks.listWindowsProcessWindowTitles.mockReset();
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([]);
  });

  it("checks whether a process state belongs to a game", () => {
    expect(
      isPoeProcessStateForGame(
        {
          game: "poe2",
          isRunning: true,
          processName: "PathOfExileSteam.exe",
        },
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
      "PathOfExile_x64Steam.exe",
    ]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
    expect(processMocks.findRunningProcesses).toHaveBeenCalledWith(
      expect.arrayContaining([
        "PathOfExileSteam.exe",
        "PathOfExile.exe",
        "PathOfExile_x64Steam.exe",
        "PathOfExile_x64.exe",
      ]),
    );

    processMocks.findRunningProcesses.mockResolvedValueOnce([
      "PathOfExile_x64.exe",
    ]);
    await expect(detectPoeProcessState()).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExile_x64.exe",
    });
  });

  it("uses the active game as the only process tie-breaker", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
      "PathOfExile_x64Steam.exe",
    ]);
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      {
        processName: "PathOfExileSteam.exe",
        windowTitle: "Path of Exile 2",
      },
    ]);

    await expect(detectPoeProcessState("poe2")).resolves.toEqual({
      game: "poe2",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(detectPoeProcessState("poe1")).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
  });

  it("resolves the generic Steam process from the window title", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      {
        processName: "PathOfExileSteam.exe",
        windowTitle: "N/A",
      },
      {
        processName: "PathOfExileSteam.exe",
        windowTitle: "Path of Exile 2",
      },
    ]);

    await expect(detectPoeProcessState("poe2")).resolves.toEqual({
      game: "poe2",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(detectPoeProcessState("poe1")).resolves.toEqual({
      game: "poe2",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
  });

  it("resolves the standalone process from the window title", async () => {
    processMocks.findRunningProcesses.mockResolvedValue(["PathOfExile.exe"]);
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      {
        processName: "PathOfExile.exe",
        windowTitle: "Path of Exile 2",
      },
    ]);

    await expect(detectPoeProcessState("poe1")).resolves.toEqual({
      game: "poe2",
      isRunning: true,
      processName: "PathOfExile.exe",
    });
    expect(processMocks.listWindowsProcessWindowTitles).toHaveBeenCalledWith(
      "PathOfExile.exe",
    );

    processMocks.listWindowsProcessWindowTitles.mockResolvedValueOnce([
      {
        processName: "PathOfExile.exe",
        windowTitle: "Path of Exile",
      },
    ]);

    await expect(detectPoeProcessState("poe2")).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExile.exe",
    });
  });

  it("does not guess a game from ambiguous processes without a title", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
    ]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(detectPoeProcessState("poe1")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });

    processMocks.findRunningProcesses.mockResolvedValueOnce([
      "PathOfExile.exe",
    ]);
    await expect(detectPoeProcessState("poe1")).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExile.exe",
    });
  });

  it("prefers unambiguous running games over generic Steam process fallback", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExileSteam.exe",
      "PathOfExile_x64Steam.exe",
    ]);
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      {
        processName: "PathOfExileSteam.exe",
        windowTitle: "Path of Exile 2",
      },
    ]);

    await expect(detectPoeProcessState("poe1")).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
  });

  it("returns stopped state when no PoE process is found", async () => {
    processMocks.findRunningProcesses.mockResolvedValue([]);

    await expect(detectPoeProcessState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("polls using the active game fallback and requires consecutive misses before stopping", async () => {
    const poller = new PoeProcessPoller(() => "poe2");
    processMocks.listWindowsProcessWindowTitles.mockResolvedValue([
      {
        processName: "PathOfExileSteam.exe",
        windowTitle: "Path of Exile 2",
      },
    ]);
    processMocks.findRunningProcesses
      .mockResolvedValueOnce(["PathOfExileSteam.exe"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(poller.pollNow()).resolves.toEqual({
      game: "poe2",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      game: "poe2",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("polls without an active game fallback", async () => {
    const poller = new PoeProcessPoller();
    processMocks.findRunningProcesses.mockResolvedValue([
      "PathOfExile_x64Steam.exe",
    ]);

    await expect(poller.pollNow()).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExile_x64Steam.exe",
    });
  });
});
