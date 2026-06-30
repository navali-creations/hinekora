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

async function renderClip({
  timelineRailWidthPixels = 240,
  useCompactTrimHandles = false,
}: {
  timelineRailWidthPixels?: number;
  useCompactTrimHandles?: boolean;
} = {}) {
  const asset = createEditorTestAsset();
  const clip = createEditorTestTimelineClip(asset);

  await act(async () => {
    root.render(
      <EditorTimelineClip
        clip={clip}
        railPaddingPixels={0}
        timelineRailWidthPixels={timelineRailWidthPixels}
        useCompactTrimHandles={useCompactTrimHandles}
        visibleDurationSeconds={10}
      />,
    );
  });

  return clip;
}

describe("EditorTimelineClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
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
        <EditorTimelineClip
          clip={clip}
          railPaddingPixels={0}
          timelineRailWidthPixels={240}
          useCompactTrimHandles={false}
          visibleDurationSeconds={10}
        />,
      );
    });

    expect(thumbnailMocks.useEditorClipThumbnails).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: clip.mediaUrl,
      }),
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("sizes a trimmed clip against the fitted edit duration", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 54.95 });
    const clip = createEditorTestTimelineClip(asset, {
      durationSeconds: 30,
      outSeconds: 30,
      sourceOutSeconds: 54.95,
    });

    await act(async () => {
      root.render(
        <EditorTimelineClip
          clip={clip}
          railPaddingPixels={0}
          timelineRailWidthPixels={240}
          useCompactTrimHandles={false}
          visibleDurationSeconds={30}
        />,
      );
    });

    const clipElement = container.querySelector<HTMLElement>(
      `[data-timeline-clip="${clip.id}"]`,
    );

    expect(Number.parseFloat(clipElement?.style.width ?? "")).toBeCloseTo(
      100,
      2,
    );
  });

  it("positions clips inside the padded timeline rail", async () => {
    const asset = createEditorTestAsset();
    const clip = createEditorTestTimelineClip(asset, {
      durationSeconds: 4,
      startSeconds: 2,
    });

    await act(async () => {
      root.render(
        <EditorTimelineClip
          clip={clip}
          railPaddingPixels={24}
          timelineRailWidthPixels={240}
          useCompactTrimHandles={false}
          visibleDurationSeconds={10}
        />,
      );
    });

    const clipElement = container.querySelector<HTMLElement>(
      `[data-timeline-clip="${clip.id}"]`,
    );

    expect(clipElement?.style.left).toBe("calc(24px + 0.2 * (100% - 48px))");
    expect(clipElement?.style.width).toBe("calc(0.4 * (100% - 48px))");
    expect(clipElement?.style.minWidth).toBe("4px");
    expect(
      container
        .querySelector<HTMLElement>('[data-trim-edge="start"]')
        ?.className.includes("border-r"),
    ).toBe(true);
    expect(
      container
        .querySelector<HTMLElement>('[data-trim-edge="end"]')
        ?.className.includes("border-l"),
    ).toBe(true);
    expect(
      container
        .querySelector<HTMLElement>('[data-trim-edge="start"]')
        ?.className.includes("bg-base-content/20"),
    ).toBe(true);
  });

  it("uses compact border trim handles when the timeline requires compact handles", async () => {
    await renderClip({ useCompactTrimHandles: true });

    expect(
      container
        .querySelector<HTMLElement>('[data-trim-edge="start"]')
        ?.className.includes("border-l-2"),
    ).toBe(true);
    expect(
      container
        .querySelector<HTMLElement>('[data-trim-edge="end"]')
        ?.className.includes("border-r-2"),
    ).toBe(true);
    expect(
      container
        .querySelector<HTMLElement>('[data-trim-edge="start"]')
        ?.className.includes("bg-transparent"),
    ).toBe(true);
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
        <EditorTimelineClip
          clip={clip}
          railPaddingPixels={0}
          timelineRailWidthPixels={240}
          useCompactTrimHandles={false}
          visibleDurationSeconds={10}
        />,
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
