import { describe, expect, it } from "vitest";

import {
  isAmbiguousPathOfExileProcessName,
  resolvePathOfExileProcessGame,
} from "./path-of-exile-process";

describe("Path of Exile process utilities", () => {
  it("maps unambiguous process names to game ids", () => {
    expect(resolvePathOfExileProcessGame("PathOfExile.exe")).toBe("poe1");
    expect(resolvePathOfExileProcessGame("PathOfExile_x64Steam.exe")).toBe(
      "poe1",
    );
    expect(resolvePathOfExileProcessGame("PathOfExile2Steam.exe")).toBe("poe2");
    expect(resolvePathOfExileProcessGame("PathOfExile2.exe")).toBe("poe2");
  });

  it("does not guess a game from generic or unrelated process names", () => {
    expect(resolvePathOfExileProcessGame("PathOfExileSteam.exe")).toBeNull();
    expect(resolvePathOfExileProcessGame("steam.exe")).toBeNull();
    expect(resolvePathOfExileProcessGame("")).toBeNull();
  });

  it("identifies ambiguous generic Path of Exile process names", () => {
    expect(isAmbiguousPathOfExileProcessName("PathOfExileSteam.exe")).toBe(
      true,
    );
    expect(isAmbiguousPathOfExileProcessName("PathOfExile.exe")).toBe(false);
    expect(isAmbiguousPathOfExileProcessName("PathOfExile2Steam.exe")).toBe(
      false,
    );
  });
});
