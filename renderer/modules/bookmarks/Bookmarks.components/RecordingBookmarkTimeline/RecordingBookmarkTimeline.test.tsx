import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordingBookmark } from "~/main/modules/bookmarks";

import { RecordingBookmarkTimeline } from "./RecordingBookmarkTimeline";

const mediaPlaybackMocks = vi.hoisted(() => ({
  useMediaClipThumbnails: vi.fn(() => []),
}));

vi.mock(
  "~/renderer/modules/media-playback/useMediaClipThumbnails/useMediaClipThumbnails",
  () => mediaPlaybackMocks,
);

function createBookmark(
  overrides: Partial<RecordingBookmark> = {},
): RecordingBookmark {
  return {
    category: "rewind-manual-replay",
    createdAt: "2026-07-03T10:00:00.000Z",
    durationSeconds: 10,
    id: "bookmark-1",
    label: "Manual replay",
    note: null,
    occurredAt: "2026-07-03T10:00:10.000Z",
    offsetSeconds: 50,
    sceneName: "Qimah Reservoir",
    source: "system",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    subcategory: null,
    updatedAt: "2026-07-03T10:00:00.000Z",
    ...overrides,
  };
}

function createPointerLikeEvent(
  type: "pointerdown" | "pointermove",
  eventInit: MouseEventInit,
): PointerEvent {
  const event = new MouseEvent(type, eventInit) as PointerEvent;

  Object.defineProperty(event, "pointerId", { value: 1 });

  return event;
}

describe("RecordingBookmarkTimeline", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mediaPlaybackMocks.useMediaClipThumbnails.mockClear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("seeks from pointer position and selects clip marker targets", () => {
    const bookmark = createBookmark();
    const onClipTargetSelect = vi.fn();
    const onSeek = vi.fn();

    act(() => {
      root.render(
        <RecordingBookmarkTimeline
          markers={{
            bookmarks: [bookmark],
            clipTargetsByBookmarkId: {
              [bookmark.id]: {
                durationSeconds: 12,
                targetDurationSeconds: 60,
                targetId: "clip-1",
              },
            },
            onClipTargetSelect,
          }}
          playback={{
            durationSeconds: 100,
            isPlaying: false,
            mediaUrl: "hinekora-media://recording/recording-1",
            playbackSeconds: 0,
            volume: 1,
            onJumpToStart: vi.fn(),
            onSeek,
            onSeekBackward: vi.fn(),
            onSeekForward: vi.fn(),
            onTogglePlayback: vi.fn(),
            onVolumeChange: vi.fn(),
          }}
        />,
      );
    });

    const timelineGrid = container.querySelector<HTMLElement>(
      "[data-recording-timeline-grid='true']",
    );
    expect(timelineGrid).not.toBeNull();
    if (!timelineGrid) {
      return;
    }

    vi.spyOn(timelineGrid, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 120,
      left: 100,
      right: 300,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 100,
      y: 0,
    });

    act(() => {
      timelineGrid.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          bubbles: true,
          clientX: 200,
        }),
      );
    });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek.mock.calls[0]?.[0]).toBeCloseTo(50, 1);

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          "button[aria-label='Preview Manual replay clip']",
        )
        ?.click();
    });

    expect(onClipTargetSelect).toHaveBeenCalledWith("clip-1");
  });

  it("renders the highlighted bookmark marker when regular markers are hidden", () => {
    const bookmark = createBookmark();

    act(() => {
      root.render(
        <RecordingBookmarkTimeline
          markers={{
            bookmarks: [bookmark],
            hoveredBookmark: bookmark,
            markerBookmarks: [],
            showBookmarkMarkers: false,
          }}
          playback={{
            durationSeconds: 100,
            isPlaying: false,
            mediaUrl: "hinekora-media://recording/recording-1",
            playbackSeconds: 0,
            volume: 1,
            onJumpToStart: vi.fn(),
            onSeek: vi.fn(),
            onSeekBackward: vi.fn(),
            onSeekForward: vi.fn(),
            onTogglePlayback: vi.fn(),
            onVolumeChange: vi.fn(),
          }}
        />,
      );
    });

    expect(
      container.querySelector(
        '[data-recording-bookmark-marker-id="bookmark-1"]',
      ),
    ).not.toBe(null);
  });

  it("updates the timer and playhead from one presented video frame", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 120,
      left: 0,
      right: 248,
      toJSON: () => ({}),
      top: 0,
      width: 248,
      x: 0,
      y: 0,
    });
    const visualPlaybackListeners = new Set<(seconds: number) => void>();

    act(() => {
      root.render(
        <RecordingBookmarkTimeline
          markers={{ bookmarks: [] }}
          playback={{
            durationSeconds: 100,
            isPlaying: true,
            mediaUrl: "hinekora-media://recording/recording-1",
            playbackSeconds: 25,
            subscribeVisualPlaybackTime: (listener) => {
              visualPlaybackListeners.add(listener);
              return () => {
                visualPlaybackListeners.delete(listener);
              };
            },
            volume: 1,
            onJumpToStart: vi.fn(),
            onSeek: vi.fn(),
            onSeekBackward: vi.fn(),
            onSeekForward: vi.fn(),
            onTogglePlayback: vi.fn(),
            onVolumeChange: vi.fn(),
          }}
        />,
      );
    });

    expect(visualPlaybackListeners.size).toBe(2);
    expect(mediaPlaybackMocks.useMediaClipThumbnails).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(container.textContent).toContain("0:25.00 / 1:40.00");

    act(() => {
      for (const listener of visualPlaybackListeners) {
        listener(50);
      }
    });

    expect(container.textContent).toContain("0:50.00 / 1:40.00");
    expect(
      container.querySelector<HTMLElement>(
        '[data-recording-timeline-playhead="true"]',
      )?.style.transform,
    ).toContain("translate3d(100px");
  });

  it("restores state time when visual playback subscription is disabled", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 120,
      left: 0,
      right: 248,
      toJSON: () => ({}),
      top: 0,
      width: 248,
      x: 0,
      y: 0,
    });
    const visualPlaybackListeners = new Set<(seconds: number) => void>();
    const subscribeVisualPlaybackTime = (
      listener: (seconds: number) => void,
    ) => {
      visualPlaybackListeners.add(listener);
      return () => {
        visualPlaybackListeners.delete(listener);
      };
    };
    const playbackActions = {
      onJumpToStart: vi.fn(),
      onSeek: vi.fn(),
      onSeekBackward: vi.fn(),
      onSeekForward: vi.fn(),
      onTogglePlayback: vi.fn(),
      onVolumeChange: vi.fn(),
    };

    act(() => {
      root.render(
        <RecordingBookmarkTimeline
          markers={{ bookmarks: [] }}
          playback={{
            durationSeconds: 100,
            isPlaying: true,
            mediaUrl: "hinekora-media://recording/recording-1",
            playbackSeconds: 25,
            subscribeVisualPlaybackTime,
            volume: 1,
            ...playbackActions,
          }}
        />,
      );
    });

    expect(visualPlaybackListeners.size).toBe(2);
    act(() => {
      for (const listener of visualPlaybackListeners) {
        listener(50);
      }
    });
    expect(container.textContent).toContain("0:50.00 / 1:40.00");

    act(() => {
      root.render(
        <RecordingBookmarkTimeline
          markers={{ bookmarks: [] }}
          playback={{
            durationSeconds: 100,
            enableVisualPlaybackSubscription: false,
            isPlaybackDisabled: true,
            isPlaying: false,
            mediaUrl: null,
            playbackSeconds: 25,
            subscribeVisualPlaybackTime,
            volume: 1,
            ...playbackActions,
          }}
        />,
      );
    });

    expect(visualPlaybackListeners.size).toBe(0);
    expect(container.textContent).toContain("0:25.00 / 1:40.00");
    expect(
      container.querySelector<HTMLElement>(
        '[data-recording-timeline-playhead="true"]',
      )?.style.transform,
    ).toContain("translate3d(50px");
  });

  it("steps frames only after its recording timeline is focused or clicked", () => {
    const onStep = vi.fn();
    const getPlaybackSeconds = vi.fn(() => 10);

    act(() => {
      root.render(
        <RecordingBookmarkTimeline
          markers={{ bookmarks: [] }}
          playback={{
            durationSeconds: 100,
            frameStep: {
              framesPerSecond: 60,
              getPlaybackSeconds,
              onStep,
            },
            isPlaying: false,
            mediaUrl: "hinekora-media://recording/recording-1",
            playbackSeconds: 10,
            volume: 1,
            onJumpToStart: vi.fn(),
            onSeek: vi.fn(),
            onSeekBackward: vi.fn(),
            onSeekForward: vi.fn(),
            onTogglePlayback: vi.fn(),
            onVolumeChange: vi.fn(),
          }}
        />,
      );
    });
    const timeline = container.querySelector<HTMLElement>(
      "[data-recording-frame-step-shortcuts='true']",
    );
    if (!timeline) {
      throw new Error("Expected focusable recording timeline");
    }

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "." }),
      );
    });
    expect(onStep).not.toHaveBeenCalled();

    const grid = container.querySelector<HTMLElement>(
      "[data-recording-timeline-grid='true']",
    );
    if (!grid) {
      throw new Error("Expected recording timeline grid");
    }
    act(() => {
      grid.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: ".",
        }),
      );
    });
    expect(getPlaybackSeconds).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith(10 + 1 / 60);
  });
});
