import { act, useCallback, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publishEditorPlaybackVisualTime } from "../../Editor.utils/Editor.utils";
import { useEditorTimelinePlaybackScroll } from "./useEditorTimelinePlaybackScroll";

interface PlaybackScrollHarnessProps {
  isPreviewPlaying?: boolean;
  playbackSeconds?: number;
}

let container: HTMLDivElement;
let getTimelineBounds: ReturnType<typeof createTimelineBoundsMock>;
let root: Root;

function PlaybackScrollHarness({
  isPreviewPlaying = true,
  playbackSeconds = 1,
}: PlaybackScrollHarnessProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineGridRef = useRef<HTMLDivElement | null>(null);
  const handleScrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        Object.defineProperty(node, "clientWidth", {
          configurable: true,
          value: 500,
        });
        Object.defineProperty(node, "scrollWidth", {
          configurable: true,
          value: 1_200,
        });
        node.scrollLeft = 0;
      }

      scrollContainerRef.current = node;
    },
    [],
  );
  const handleTimelineGridRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.getBoundingClientRect = getTimelineBounds;
    }

    timelineGridRef.current = node;
  }, []);

  useEditorTimelinePlaybackScroll({
    isPreviewPlaying,
    paddingPixels: 96,
    playbackSeconds,
    railPaddingPixels: 24,
    scrollContainerRef,
    timelineGridRef,
    visibleDurationSeconds: 10,
  });

  return (
    <div data-testid="timeline-scroll" ref={handleScrollContainerRef}>
      <div data-testid="timeline-grid" ref={handleTimelineGridRef} />
    </div>
  );
}

async function renderHarness(
  props: PlaybackScrollHarnessProps = {},
): Promise<void> {
  await act(async () => {
    root.render(<PlaybackScrollHarness {...props} />);
  });
}

function getScrollContainer(): HTMLDivElement {
  const scrollContainer = container.querySelector<HTMLDivElement>(
    '[data-testid="timeline-scroll"]',
  );
  if (!scrollContainer) {
    throw new Error("Expected timeline scroll container to render");
  }

  return scrollContainer;
}

function createTimelineBoundsMock() {
  return vi.fn(
    (): DOMRect =>
      createRect({
        height: 200,
        left: 0,
        top: 0,
        width: 1_200,
      }),
  );
}

function createRect(input: {
  height: number;
  left: number;
  top: number;
  width: number;
}): DOMRect {
  return {
    bottom: input.top + input.height,
    height: input.height,
    left: input.left,
    right: input.left + input.width,
    toJSON: () => ({}),
    top: input.top,
    width: input.width,
    x: input.left,
    y: input.top,
  };
}

describe("useEditorTimelinePlaybackScroll", () => {
  beforeEach(() => {
    getTimelineBounds = createTimelineBoundsMock();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("follows visual playback ticks without waiting for store playback updates", async () => {
    await renderHarness();

    const scrollContainer = getScrollContainer();
    expect(scrollContainer.scrollLeft).toBe(0);
    expect(getTimelineBounds).toHaveBeenCalledTimes(1);

    publishEditorPlaybackVisualTime(6);

    expect(scrollContainer.scrollLeft).toBe(311);
    expect(getTimelineBounds).toHaveBeenCalledTimes(1);
  });

  it("ignores visual playback ticks while preview playback is paused", async () => {
    await renderHarness({ isPreviewPlaying: false });

    const scrollContainer = getScrollContainer();
    publishEditorPlaybackVisualTime(6);

    expect(scrollContainer.scrollLeft).toBe(0);
  });
});
