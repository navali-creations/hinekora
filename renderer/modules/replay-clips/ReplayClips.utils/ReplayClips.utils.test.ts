import { describe, expect, it } from "vitest";

import { createReplayClipView } from "~/main/test/factories/replayClip";

import { hasPlayableClip } from "./ReplayClips.utils";

describe("ReplayClips utils", () => {
  it("detects playable clips from available media paths", () => {
    expect(hasPlayableClip(createReplayClipView())).toBe(false);
    expect(
      hasPlayableClip(
        createReplayClipView({ hasMediaFile: true, sizeBytes: 1 }),
      ),
    ).toBe(true);
    expect(
      hasPlayableClip(
        createReplayClipView({ hasMediaFile: true, sizeBytes: 1 }),
      ),
    ).toBe(true);
    expect(
      hasPlayableClip(
        createReplayClipView({ hasMediaFile: false, sizeBytes: 0 }),
      ),
    ).toBe(false);
  });
});
