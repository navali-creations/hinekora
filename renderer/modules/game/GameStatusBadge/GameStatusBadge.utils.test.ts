import { describe, expect, it } from "vitest";

import { isPoeProcessStateForGame } from "./GameStatusBadge.utils";

describe("GameStatusBadge utils", () => {
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
