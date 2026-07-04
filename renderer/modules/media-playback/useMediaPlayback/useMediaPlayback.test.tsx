import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clampMediaPlaybackSeconds,
  useMediaPlayback,
} from "./useMediaPlayback";

let container: HTMLDivElement;
let root: Root;
let hookResult: ReturnType<typeof useMediaPlayback> | null = null;
let mediaUrl: string | null = "hinekora-media://recording/one";
let onVisualTimeChange = vi.fn();

function Probe() {
  hookResult = useMediaPlayback({
    fallbackDurationSeconds: 100,
    mediaUrl,
    onVisualTimeChange,
  });

  return null;
}

async function renderHookProbe() {
  await act(async () => {
    root.render(<Probe />);
  });

  if (!hookResult) {
    throw new Error("Expected media playback hook to render");
  }

  return hookResult;
}

describe("useMediaPlayback", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    hookResult = null;
    mediaUrl = "hinekora-media://recording/one";
    onVisualTimeChange = vi.fn();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("clamps playback seconds to the available duration", () => {
    expect(clampMediaPlaybackSeconds(Number.NaN, 60)).toBe(0);
    expect(clampMediaPlaybackSeconds(-1, 60)).toBe(0);
    expect(clampMediaPlaybackSeconds(42, 60)).toBe(42);
    expect(clampMediaPlaybackSeconds(90, 60)).toBe(60);
  });

  it("resets playback state when the media URL changes", async () => {
    const result = await renderHookProbe();

    await act(async () => {
      result.seekTo(42);
    });
    expect(hookResult?.playbackSeconds).toBe(42);

    mediaUrl = "hinekora-media://recording/two";
    await renderHookProbe();

    expect(hookResult?.playbackSeconds).toBe(0);
    expect(onVisualTimeChange).toHaveBeenLastCalledWith(0);
  });
});
