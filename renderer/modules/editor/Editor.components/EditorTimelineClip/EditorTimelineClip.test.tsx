import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";

const storeMocks = vi.hoisted(() => ({
  selectTimelineClip: vi.fn(),
  useEditorShallow: vi.fn(),
}));
const thumbnailMocks = vi.hoisted(() => ({
  calculateEditorThumbnailCount: vi.fn((widthPixels: number) =>
    widthPixels <= 0
      ? 0
      : Math.min(Math.max(Math.ceil(widthPixels / 96), 1), 8),
  ),
  useEditorClipThumbnails: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

vi.mock(
  "../../Editor.hooks/useEditorClipThumbnails/useEditorClipThumbnails",
  () => thumbnailMocks,
);

import { EditorTimelineClip } from "./EditorTimelineClip";

let container: HTMLDivElement;
let root: Root;

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

async function renderClip() {
  const asset = createEditorTestAsset();
  const clip = createEditorTestTimelineClip(asset);

  await act(async () => {
    root.render(<EditorTimelineClip clip={clip} visibleDurationSeconds={10} />);
  });

  return clip;
}

describe("EditorTimelineClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverMock,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 48,
      height: 48,
      left: 0,
      right: 240,
      top: 0,
      width: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    thumbnailMocks.useEditorClipThumbnails.mockImplementation((input) =>
      input.mediaUrl
        ? ["data:image/jpeg;base64,first", "data:image/jpeg;base64,second"]
        : [],
    );
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        selectedClipId: null,
        selectTimelineClip: storeMocks.selectTimelineClip,
      }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders thumbnails without requiring selection or hover", async () => {
    const clip = await renderClip();

    expect(thumbnailMocks.useEditorClipThumbnails).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: clip.mediaUrl,
      }),
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-clip-body]")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(storeMocks.selectTimelineClip).toHaveBeenCalledWith(clip.id);
  });

  it("renders thumbnails for a different selected clip", async () => {
    const asset = createEditorTestAsset();
    const clip = createEditorTestTimelineClip(asset);
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        selectedClipId: "timeline-other",
        selectTimelineClip: storeMocks.selectTimelineClip,
      }),
    );

    await act(async () => {
      root.render(
        <EditorTimelineClip clip={clip} visibleDurationSeconds={10} />,
      );
    });

    expect(thumbnailMocks.useEditorClipThumbnails).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: clip.mediaUrl,
      }),
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("sizes a trimmed clip against the stable source rail duration", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 54.95 });
    const clip = createEditorTestTimelineClip(asset, {
      durationSeconds: 30,
      outSeconds: 30,
      sourceOutSeconds: 54.95,
    });

    await act(async () => {
      root.render(
        <EditorTimelineClip clip={clip} visibleDurationSeconds={68.688} />,
      );
    });

    const clipElement = container.querySelector<HTMLElement>(
      `[data-timeline-clip="${clip.id}"]`,
    );

    expect(Number.parseFloat(clipElement?.style.width ?? "")).toBeCloseTo(
      43.68,
      2,
    );
  });

  it("renders available thumbnails for the selected clip", async () => {
    const asset = createEditorTestAsset();
    const clip = createEditorTestTimelineClip(asset);
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        selectedClipId: clip.id,
        selectTimelineClip: storeMocks.selectTimelineClip,
      }),
    );

    await act(async () => {
      root.render(
        <EditorTimelineClip clip={clip} visibleDurationSeconds={10} />,
      );
    });

    expect(thumbnailMocks.useEditorClipThumbnails).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: clip.mediaUrl,
      }),
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(
      Array.from(container.querySelectorAll("img")).map((image) =>
        image.getAttribute("src"),
      ),
    ).toEqual([
      "data:image/jpeg;base64,first",
      "data:image/jpeg;base64,second",
    ]);
  });
});
