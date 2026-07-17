import { describe, expect, it } from "vitest";

import { isWindowsOS } from "./platform";

describe("isWindowsOS", () => {
  it("identifies Windows platforms", () => {
    expect(isWindowsOS("win32")).toBe(true);
    expect(isWindowsOS("linux")).toBe(false);
    expect(isWindowsOS("darwin")).toBe(false);
  });

  it("uses the current platform by default", () => {
    expect(typeof isWindowsOS()).toBe("boolean");
  });
});
