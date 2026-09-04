import { describe, expect, it } from "vitest";

import { readReplayStatusClipId } from "./ReplayStatusOverlay.page.utils";

describe("readReplayStatusClipId", () => {
  it("reads an encoded clip id from the overlay route", () => {
    expect(
      readReplayStatusClipId("#/replay-status-overlay?clipId=manual%20clip"),
    ).toBe("manual clip");
  });

  it.each([
    ["a missing id", "#/replay-status-overlay"],
    ["an empty id", "#/replay-status-overlay?clipId="],
    ["an overlong id", `#/replay-status-overlay?clipId=${"x".repeat(129)}`],
  ])("rejects %s", (_label, hash) => {
    expect(readReplayStatusClipId(hash)).toBeNull();
  });
});
