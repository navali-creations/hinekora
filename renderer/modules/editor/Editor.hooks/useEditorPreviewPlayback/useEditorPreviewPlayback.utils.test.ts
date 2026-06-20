import { describe, expect, it } from "vitest";

import type { EditorTimelineClip } from "~/main/modules/editor";

import { isPlaybackInsideClip } from "./useEditorPreviewPlayback.utils";

const clip: EditorTimelineClip = {
  assetKey: "clip:asset-1",
  color: "primary",
  durationSeconds: 2,
  id: "timeline-1",
  inSeconds: 4,
  mediaUrl: "hinekora-media://replay-clip/asset-1",
  name: "asset-1.mp4",
  outSeconds: 6,
  startSeconds: 3,
  trackId: "video-track",
};

describe("useEditorPreviewPlayback utils", () => {
  it("treats clip starts as inclusive and clip ends as exclusive", () => {
    expect(isPlaybackInsideClip({ clip, playbackSeconds: 2.999 })).toBe(false);
    expect(isPlaybackInsideClip({ clip, playbackSeconds: 3 })).toBe(true);
    expect(isPlaybackInsideClip({ clip, playbackSeconds: 4.25 })).toBe(true);
    expect(isPlaybackInsideClip({ clip, playbackSeconds: 5 })).toBe(false);
  });
});
