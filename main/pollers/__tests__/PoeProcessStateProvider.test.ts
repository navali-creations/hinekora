import { afterEach, describe, expect, it, vi } from "vitest";

import type { PoeProcessState } from "~/main/modules/poe-process/PoeProcess.dto";

import {
  clearPoeProcessStateProvider,
  isProcessStateForGame,
  type PoeProcessStateProvider,
  refreshPoeProcessState,
  setPoeProcessStateProvider,
} from "../PoeProcessStateProvider";

describe("PoeProcessStateProvider", () => {
  afterEach(() => {
    clearPoeProcessStateProvider();
  });

  it("returns stopped state when no provider is registered", async () => {
    await expect(refreshPoeProcessState()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("refreshes through the registered provider", async () => {
    const provider: PoeProcessStateProvider = {
      refreshState: vi.fn(
        async (preferredGame): Promise<PoeProcessState> => ({
          game: preferredGame ?? "poe1",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        }),
      ),
    };

    setPoeProcessStateProvider(provider);

    await expect(refreshPoeProcessState("poe1")).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      pid: 99,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    expect(provider.refreshState).toHaveBeenCalledWith("poe1");
  });

  it("only clears the matching provider when one is supplied", async () => {
    const firstProvider: PoeProcessStateProvider = {
      refreshState: vi.fn(
        async (): Promise<PoeProcessState> => ({
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        }),
      ),
    };
    const secondProvider: PoeProcessStateProvider = {
      refreshState: vi.fn(
        async (): Promise<PoeProcessState> => ({
          game: "poe2",
          isRunning: true,
          pid: 100,
          processName: "PathOfExileSteam.exe",
          windowTitle: "Path of Exile 2",
        }),
      ),
    };

    setPoeProcessStateProvider(firstProvider);
    clearPoeProcessStateProvider(secondProvider);

    await expect(refreshPoeProcessState("poe1")).resolves.toEqual({
      game: "poe1",
      isRunning: true,
      pid: 99,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });

    clearPoeProcessStateProvider(firstProvider);

    await expect(refreshPoeProcessState("poe1")).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("matches running process state to a game", () => {
    expect(
      isProcessStateForGame(
        {
          game: "poe2",
          isRunning: true,
          pid: 100,
          processName: "PathOfExileSteam.exe",
          windowTitle: "Path of Exile 2",
        },
        "poe2",
      ),
    ).toBe(true);
    expect(
      isProcessStateForGame(
        {
          game: "poe2",
          isRunning: true,
          pid: 100,
          processName: "PathOfExileSteam.exe",
          windowTitle: "Path of Exile 2",
        },
        "poe1",
      ),
    ).toBe(false);
    expect(
      isProcessStateForGame(
        {
          isRunning: false,
          processName: "",
        },
        "poe2",
      ),
    ).toBe(false);
  });
});
