import { describe, expect, it } from "vitest";

import {
  ALL_LEAGUES_VALUE,
  buildMediaLibraryLeagueOptions,
  formatBytes,
  formatDurationSeconds,
  getPathFileName,
} from "./MediaLibrary.utils";

describe("MediaLibrary utils", () => {
  it("builds league options from configured and saved leagues", () => {
    expect(
      buildMediaLibraryLeagueOptions("poe2", ["Mirage", "Standard"], "Mirage"),
    ).toEqual([
      { value: ALL_LEAGUES_VALUE, label: "All leagues" },
      { value: "Dawn of the Hunt", label: "Dawn of the Hunt" },
      { value: "Hardcore", label: "Hardcore" },
      { value: "Mirage", label: "Mirage" },
      { value: "Standard", label: "Standard" },
    ]);
  });

  it("formats common media values", () => {
    expect(formatBytes(2_621_440)).toBe("2.5 MB");
    expect(formatDurationSeconds(65)).toBe("1:05");
    expect(formatDurationSeconds(3723)).toBe("1:02:03");
    expect(formatDurationSeconds(null)).toBe("--");
    expect(getPathFileName("C:\\Videos\\Hinekora\\clip.mp4")).toBe("clip.mp4");
  });
});
