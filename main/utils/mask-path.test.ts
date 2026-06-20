import { describe, expect, it } from "vitest";

import { maskPath } from "./mask-path";

describe("maskPath", () => {
  it("masks Windows paths before a known anchor", () => {
    expect(
      maskPath("C:\\Users\\seb\\AppData\\Local\\Hinekora\\hinekora.sqlite", [
        "Hinekora",
      ]),
    ).toBe("C:\\**\\Hinekora\\hinekora.sqlite");
  });

  it("masks Unix paths before a known anchor", () => {
    expect(
      maskPath("/home/seb/.config/hinekora/hinekora.sqlite", ["hinekora"]),
    ).toBe("/**/hinekora/hinekora.sqlite");
  });

  it("returns direct anchor paths unchanged", () => {
    expect(maskPath("C:\\Hinekora", ["Hinekora"])).toBe("C:\\Hinekora");
  });

  it("keeps only the last two path segments when no anchor matches", () => {
    expect(
      maskPath("C:\\Users\\seb\\Downloads\\capture.mp4", ["Hinekora"]),
    ).toBe("C:\\**\\Downloads\\capture.mp4");
  });

  it("returns short or unconfigured paths unchanged", () => {
    expect(maskPath("capture.mp4", ["Hinekora"])).toBe("capture.mp4");
    expect(maskPath("C:\\Users\\seb\\capture.mp4", [])).toBe(
      "C:\\Users\\seb\\capture.mp4",
    );
    expect(maskPath("", ["Hinekora"])).toBe("");
  });
});
