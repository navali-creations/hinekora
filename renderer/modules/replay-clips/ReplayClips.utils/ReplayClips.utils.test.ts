import { describe, expect, it } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import { hasPlayableClip } from "./ReplayClips.utils";

describe("ReplayClips utils", () => {
  it("detects playable clips from available media paths", () => {
    expect(hasPlayableClip(createReplayClip())).toBe(false);
    expect(
      hasPlayableClip(
        createReplayClip({ processedClipPath: "clip.mp4", sizeBytes: 1 }),
      ),
    ).toBe(true);
    expect(
      hasPlayableClip(
        createReplayClip({ originalObsPath: "original.mp4", sizeBytes: 1 }),
      ),
    ).toBe(true);
    expect(
      hasPlayableClip(
        createReplayClip({ processedClipPath: "missing.mp4", sizeBytes: 0 }),
      ),
    ).toBe(false);
  });
});
