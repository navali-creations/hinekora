import { describe, expect, it } from "vitest";

import {
  isPoeProcessStateForGame,
  resolvePoeProcessGame,
} from "./GameStatusBadge.utils";

describe("GameStatusBadge utils", () => {
  it("maps PoE process names to game ids", () => {
    expect(resolvePoeProcessGame("PathOfExileSteam.exe")).toBeNull();
    expect(resolvePoeProcessGame("PathOfExile_x64Steam.exe")).toBe("poe1");
    expect(resolvePoeProcessGame("PathOfExile2Steam.exe")).toBe("poe2");
    expect(resolvePoeProcessGame("steam.exe")).toBeNull();
  });

  it("matches process state against a specific game", () => {
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
    expect(isPoeProcessStateForGame(null, "poe1")).toBe(false);
  });
});
