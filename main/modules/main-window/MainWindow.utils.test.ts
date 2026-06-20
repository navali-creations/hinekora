import { describe, expect, it } from "vitest";

import { isAllowedExternalUrl } from "./MainWindow.utils";

describe("MainWindow utils", () => {
  it("allows trusted external urls", () => {
    expect(
      isAllowedExternalUrl(
        "https://github.com/navali-creations/hinekora/releases/latest",
      ),
    ).toBe(true);
    expect(isAllowedExternalUrl("https://discord.gg/mrqmPYXHHT")).toBe(true);
    expect(isAllowedExternalUrl("https://www.pathofexile.com")).toBe(true);
  });

  it("rejects untrusted local, executable, and web urls", () => {
    expect(isAllowedExternalUrl("https://example.com/path")).toBe(false);
    expect(isAllowedExternalUrl("https://discord.gg/other")).toBe(false);
    expect(isAllowedExternalUrl("file:///C:/Users/seb/token.txt")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("discord://open")).toBe(false);
    expect(isAllowedExternalUrl("not a url")).toBe(false);
  });
});
