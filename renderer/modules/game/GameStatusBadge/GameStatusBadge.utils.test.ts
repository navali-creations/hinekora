import { describe, expect, it } from "vitest";

import { createStoppedPoeProcessStates } from "~/main/modules/poe-process/PoeProcess.dto";

import { isPoeProcessStateForGame } from "./GameStatusBadge.utils";

describe("GameStatusBadge utils", () => {
  it("matches process state against a specific game", () => {
    expect(
      isPoeProcessStateForGame(
        {
          game: "poe2",
          isRunning: true,
          pid: 4242,
          processName: "PathOfExileSteam.exe",
          windowTitle: "Path of Exile 2",
        },
        "poe2",
      ),
    ).toBe(true);
    expect(
      isPoeProcessStateForGame(
        {
          game: "poe1",
          isRunning: true,
          pid: 4243,
          processName: "PathOfExileSteam.exe",
          windowTitle: "Path of Exile",
        },
        "poe2",
      ),
    ).toBe(false);
    expect(isPoeProcessStateForGame(null, "poe1")).toBe(false);
  });

  it("matches a game from the per-game process snapshot states", () => {
    const states = createStoppedPoeProcessStates();
    states.poe2 = {
      game: "poe2",
      isRunning: true,
      pid: 4242,
      processName: "PathOfExileSteam.exe",
      windowTitle: "Path of Exile 2",
    };

    expect(isPoeProcessStateForGame(states, "poe1")).toBe(false);
    expect(isPoeProcessStateForGame(states, "poe2")).toBe(true);
  });
});
