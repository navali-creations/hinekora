import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";

const frameMocks = vi.hoisted(() => ({
  useEditorPreviewFrame: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({
  setPlaybackSeconds: vi.fn(),
  setPreviewHasAudio: vi.fn(),
  setPreviewPlaying: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

vi.mock("../useEditorPreviewFrame/useEditorPreviewFrame", () => ({
  useEditorPreviewFrame: frameMocks.useEditorPreviewFrame,
}));

import { useEditorPreviewPlayback } from "./useEditorPreviewPlayback";

const asset = createEditorTestAsset({ durationSeconds: 4 });
const clip = createEditorTestTimelineClip(asset, {
  durationSeconds: 2,
  id: "timeline-1",
  inSeconds: 1,
  outSeconds: 3,
  startSeconds: 2,
});
const project = createEditorTestProject(asset, {
  durationSeconds: 4,
  tracks: [
    {
      clips: [clip],
      id: "video-track",
      kind: "video",
      label: "Video",
    },
  ],
});

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      isPreviewPlaying: false,
      playbackSeconds: 2.5,
      previewVolume: 1,
      project,
      selectedAssetKey: asset.assetKey,
      selectedClipId: "timeline-1",
      setPlaybackSeconds: storeMocks.setPlaybackSeconds,
      setPreviewHasAudio: storeMocks.setPreviewHasAudio,
      setPreviewPlaying: storeMocks.setPreviewPlaying,
      ...overrides,
    }),
  );
}

function PreviewPlaybackHarness() {
  const playback = useEditorPreviewPlayback();

  return playback.mediaUrl ? (
    <video
      data-testid="preview-video"
      ref={playback.videoRef}
      src={playback.mediaUrl}
      title={playback.title}
      onEnded={playback.handleEnded}
      onLoadedMetadata={playback.handleLoadedMetadata}
      onTimeUpdate={playback.handleTimeUpdate}
    />
  ) : (
    <div data-testid="empty-preview" />
  );
}

async function renderHarness() {
  await act(async () => {
    root.render(<PreviewPlaybackHarness />);
  });
}

describe("useEditorPreviewPlayback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    frameMocks.useEditorPreviewFrame.mockReturnValue({
      frameStyle: { height: 180, width: 320 },
      stageRef: { current: null },
    });
    configureEditorState();
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("syncs the selected clip source time on metadata load", async () => {
    await renderHarness();
    const video = container.querySelector<HTMLVideoElement>(
      '[data-testid="preview-video"]',
    );

    await act(async () => {
      video?.dispatchEvent(new Event("loadedmetadata", { bubbles: true }));
    });

    expect(video?.currentTime).toBeCloseTo(1.5);
  });

  it("publishes known no-audio media metadata", async () => {
    await renderHarness();
    const video = container.querySelector<HTMLVideoElement>(
      '[data-testid="preview-video"]',
    );
    if (!video) {
      throw new Error("Expected preview video to render");
    }
    Object.defineProperty(video, "audioTracks", {
      configurable: true,
      value: { length: 0 },
    });

    await act(async () => {
      video.dispatchEvent(new Event("loadedmetadata", { bubbles: true }));
    });

    expect(storeMocks.setPreviewHasAudio).toHaveBeenLastCalledWith(false);
  });

  it("syncs timeline playback from video time updates", async () => {
    await renderHarness();
    const video = container.querySelector<HTMLVideoElement>(
      '[data-testid="preview-video"]',
    );
    if (!video) {
      throw new Error("Expected preview video to render");
    }

    video.currentTime = 2;
    await act(async () => {
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });

    expect(storeMocks.setPlaybackSeconds).toHaveBeenCalledWith(3);

    await act(async () => {
      video.dispatchEvent(new Event("ended", { bubbles: true }));
    });
    expect(storeMocks.setPreviewPlaying).toHaveBeenCalledWith(false);
  });

  it("does not reset to the sequence start when media ends before the modeled clip boundary", async () => {
    configureEditorState({
      playbackSeconds: 3,
      project: createEditorTestProject(asset, {
        durationSeconds: 5.36,
        tracks: [
          {
            clips: [
              createEditorTestTimelineClip(asset, {
                durationSeconds: 5.36,
                id: "timeline-early-ended",
                inSeconds: 0,
                outSeconds: 5.36,
                startSeconds: 0,
              }),
            ],
            id: "video-track",
            kind: "video",
            label: "Video",
          },
        ],
      }),
      selectedClipId: "timeline-early-ended",
    });
    await renderHarness();
    const video = container.querySelector<HTMLVideoElement>(
      '[data-testid="preview-video"]',
    );
    if (!video) {
      throw new Error("Expected preview video to render");
    }

    video.currentTime = 3.11;
    await act(async () => {
      video.dispatchEvent(new Event("ended", { bubbles: true }));
    });

    expect(storeMocks.setPlaybackSeconds).toHaveBeenCalledWith(3.11);
    expect(storeMocks.setPlaybackSeconds).not.toHaveBeenCalledWith(0);
    expect(storeMocks.setPreviewPlaying).toHaveBeenCalledWith(false);
  });

  it("resets to the sequence start when the final clip finishes", async () => {
    const firstClip = createEditorTestTimelineClip(asset, {
      durationSeconds: 2,
      id: "timeline-first",
      inSeconds: 0,
      outSeconds: 2,
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      durationSeconds: 2,
      id: "timeline-second",
      inSeconds: 0,
      outSeconds: 2,
      startSeconds: 2,
    });
    configureEditorState({
      playbackSeconds: 3.99,
      project: createEditorTestProject(asset, {
        durationSeconds: 4,
        tracks: [
          {
            clips: [firstClip, secondClip],
            id: "video-track",
            kind: "video",
            label: "Video",
          },
        ],
      }),
      selectedClipId: "timeline-second",
    });
    await renderHarness();
    const video = container.querySelector<HTMLVideoElement>(
      '[data-testid="preview-video"]',
    );
    if (!video) {
      throw new Error("Expected preview video to render");
    }

    video.currentTime = 2;
    await act(async () => {
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });

    expect(storeMocks.setPlaybackSeconds).toHaveBeenCalledWith(0);
    expect(storeMocks.setPreviewPlaying).toHaveBeenCalledWith(false);
  });

  it("ignores paused time updates from a selected clip outside the playhead", async () => {
    const firstClip = createEditorTestTimelineClip(asset, {
      durationSeconds: 2,
      id: "timeline-first",
      inSeconds: 0,
      outSeconds: 2,
      startSeconds: 1,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      durationSeconds: 2,
      id: "timeline-second",
      inSeconds: 0,
      outSeconds: 2,
      startSeconds: 3,
    });
    configureEditorState({
      playbackSeconds: 0,
      project: createEditorTestProject(asset, {
        durationSeconds: 5,
        tracks: [
          {
            clips: [firstClip, secondClip],
            id: "video-track",
            kind: "video",
            label: "Video",
          },
        ],
      }),
      selectedClipId: "timeline-second",
    });
    await renderHarness();
    const video = container.querySelector<HTMLVideoElement>(
      '[data-testid="preview-video"]',
    );
    if (!video) {
      throw new Error("Expected preview video to render");
    }

    video.currentTime = 0.5;
    await act(async () => {
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });

    expect(storeMocks.setPlaybackSeconds).not.toHaveBeenCalled();
  });

  it("stops playback when no media can be resolved", async () => {
    configureEditorState({
      isPreviewPlaying: true,
      project: createEditorTestProject(asset, {
        assets: [{ ...asset, mediaUrl: null }],
        durationSeconds: 0,
        tracks: [],
      }),
      selectedAssetKey: asset.assetKey,
      selectedClipId: null,
    });

    await renderHarness();

    expect(container.querySelector('[data-testid="empty-preview"]')).not.toBe(
      null,
    );
    expect(storeMocks.setPreviewPlaying).toHaveBeenCalledWith(false);
  });
});
