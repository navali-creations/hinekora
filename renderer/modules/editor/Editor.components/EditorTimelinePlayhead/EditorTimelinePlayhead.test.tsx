import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publishEditorPlaybackVisualTime } from "../../Editor.utils/Editor.utils";
import { EditorTimelinePlayhead } from "./EditorTimelinePlayhead";

const storeMocks = vi.hoisted(() => ({
  useEditorSelector: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorSelector: storeMocks.useEditorSelector,
}));

let container: HTMLDivElement;
let root: Root;
let rootUnmounted: boolean;

function configurePlaybackSeconds(playbackSeconds: number): void {
  storeMocks.useEditorSelector.mockImplementation((selector) =>
    selector({ playbackSeconds }),
  );
}

async function renderPlayhead(): Promise<void> {
  await act(async () => {
    root.render(
      <EditorTimelinePlayhead
        railPaddingPixels={24}
        visibleDurationSeconds={4}
      />,
    );
  });
}

function getPlayheadElement(): HTMLElement {
  const handle = container.querySelector("[data-playhead-handle]");
  const playhead = handle?.parentElement;
  if (!playhead) {
    throw new Error("Expected timeline playhead to render");
  }

  return playhead;
}

function unmountRoot(): void {
  if (!rootUnmounted) {
    root.unmount();
    rootUnmounted = true;
  }
}

describe("EditorTimelinePlayhead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    rootUnmounted = false;
    configurePlaybackSeconds(1);
  });

  afterEach(() => {
    unmountRoot();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("updates the marker from visual playback time without a store render", async () => {
    await renderPlayhead();

    const playhead = getPlayheadElement();
    expect(playhead.style.left).toBe("calc(24px + 0.25 * (100% - 48px))");

    const selectorCallCount = storeMocks.useEditorSelector.mock.calls.length;
    publishEditorPlaybackVisualTime(2);

    expect(playhead.style.left).toBe("calc(24px + 0.5 * (100% - 48px))");
    expect(storeMocks.useEditorSelector).toHaveBeenCalledTimes(
      selectorCallCount,
    );

    unmountRoot();
    publishEditorPlaybackVisualTime(3);

    expect(playhead.style.left).toBe("calc(24px + 0.5 * (100% - 48px))");
  });
});
