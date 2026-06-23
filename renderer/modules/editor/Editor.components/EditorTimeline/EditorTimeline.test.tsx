import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";

const dragMocks = vi.hoisted(() => ({
  handleTimelinePointerDown: vi.fn(),
  handleTimelinePointerEnd: vi.fn(),
  handleTimelinePointerMove: vi.fn(),
  useEditorTimelineDrag: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({
  setZoom: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

vi.mock(
  "../../Editor.hooks/useEditorTimelineDrag/useEditorTimelineDrag",
  () => ({
    useEditorTimelineDrag: dragMocks.useEditorTimelineDrag,
  }),
);
vi.mock("../EditorPlaybackControls/EditorPlaybackControls", () => ({
  EditorPlaybackControls: () => <div data-testid="playback-controls" />,
}));
vi.mock(
  "../EditorTimelineClipDragPreview/EditorTimelineClipDragPreview",
  () => ({
    EditorTimelineClipDragPreview: () => <div data-testid="drag-preview" />,
  }),
);
vi.mock("../EditorTimelineGap/EditorTimelineGap", () => ({
  EditorTimelineGap: ({ gap }: { gap: { id: string } }) => (
    <div data-testid={`gap-${gap.id}`} />
  ),
}));
vi.mock("../EditorTimelineHoverMarker/EditorTimelineHoverMarker", () => ({
  EditorTimelineHoverMarker: ({
    hoverSeconds,
  }: {
    hoverSeconds: number | null;
  }) => <div data-testid="hover-marker">{hoverSeconds ?? "none"}</div>,
}));
vi.mock("../EditorTimelinePlayhead/EditorTimelinePlayhead", () => ({
  EditorTimelinePlayhead: () => <div data-testid="playhead" />,
}));
vi.mock("../EditorTimelineTools/EditorTimelineTools", () => ({
  EditorTimelineTools: () => <div data-testid="timeline-tools" />,
}));
vi.mock("../EditorTimelineVideoTrack/EditorTimelineVideoTrack", () => ({
  EditorTimelineVideoTrack: ({
    track,
    visibleDurationSeconds,
  }: {
    track: { clips: unknown[]; id: string; label: string };
    visibleDurationSeconds: number;
  }) => (
    <div
      data-testid={`track-${track.id}`}
      data-visible-duration={visibleDurationSeconds}
    >
      {track.label}:{track.clips.length}
    </div>
  ),
}));
vi.mock("../EditorTimelineZoomControls/EditorTimelineZoomControls", () => ({
  EditorTimelineZoomControls: () => <div data-testid="zoom-controls" />,
}));

import { EditorTimeline } from "./EditorTimeline";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      project: createEditorTestProject(),
      selectedClipId: "timeline-1",
      setZoom: storeMocks.setZoom,
      zoom: 1,
      ...overrides,
    }),
  );
}

async function renderTimeline() {
  await act(async () => {
    root.render(<EditorTimeline />);
  });
}

describe("EditorTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dragMocks.useEditorTimelineDrag.mockReturnValue({
      activeTimelineMarkerSeconds: null,
      clipDragPreview: null,
      handleTimelinePointerDown: dragMocks.handleTimelinePointerDown,
      handleTimelinePointerEnd: dragMocks.handleTimelinePointerEnd,
      handleTimelinePointerMove: dragMocks.handleTimelinePointerMove,
      timelineGridRef: { current: null },
    });
    configureEditorState();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 220,
      height: 220,
      left: 0,
      right: 1_132,
      top: 0,
      width: 1_132,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders timeline controls and video tracks", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 78 });
    configureEditorState({
      project: createEditorTestProject(asset),
      zoom: 1,
    });
    await renderTimeline();

    expect(
      container.querySelector('[data-onboarding="editor-timeline"]'),
    ).not.toBe(null);
    expect(container.querySelector('[data-testid="timeline-tools"]')).not.toBe(
      null,
    );
    expect(
      container.querySelector('[data-testid="playback-controls"]'),
    ).not.toBe(null);
    expect(container.querySelector('[data-testid="zoom-controls"]')).not.toBe(
      null,
    );
    expect(
      container.querySelector('[data-testid="track-video-track"]')?.textContent,
    ).toBe("Video:1");
    expect(
      container
        .querySelector('[data-testid="track-video-track"]')
        ?.getAttribute("data-visible-duration"),
    ).toBe("97.5");
    expect(
      container
        .querySelector<HTMLElement>("[data-timeline-grid]")
        ?.style.getPropertyValue("width"),
    ).toBe("100%");
    expect(
      container.querySelectorAll("[data-timeline-minor-marker]").length,
    ).toBeGreaterThan(0);
  });

  it("stretches fitted recordings when zoomed in", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 78 });
    configureEditorState({
      project: createEditorTestProject(asset),
      zoom: 1.25,
    });
    await renderTimeline();

    expect(
      container
        .querySelector<HTMLElement>("[data-timeline-grid]")
        ?.style.getPropertyValue("width"),
    ).toBe("181.3%");
  });

  it("fits short recordings against their padded duration instead of the empty timeline floor", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 11.92 });
    configureEditorState({
      project: createEditorTestProject(asset),
      zoom: 1,
    });
    await renderTimeline();

    expect(
      container
        .querySelector('[data-testid="track-video-track"]')
        ?.getAttribute("data-visible-duration"),
    ).toBe("14.9");
    expect(
      container
        .querySelector<HTMLElement>("[data-timeline-grid]")
        ?.style.getPropertyValue("width"),
    ).toBe("100%");
  });

  it("keeps the rail duration anchored to source media after trimming", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 54.95 });
    configureEditorState({
      project: createEditorTestProject(asset, {
        durationSeconds: 30,
        tracks: [
          {
            clips: [
              createEditorTestTimelineClip(asset, {
                durationSeconds: 30,
                outSeconds: 30,
                sourceOutSeconds: 54.95,
              }),
            ],
            id: "video-track",
            kind: "video",
            label: "Video",
          },
        ],
      }),
      zoom: 1,
    });
    await renderTimeline();

    expect(
      container
        .querySelector('[data-testid="track-video-track"]')
        ?.getAttribute("data-visible-duration"),
    ).toBe("68.688");
  });

  it("resolves hover seconds from the marker zone", async () => {
    await renderTimeline();
    const markerZone = container.querySelector<HTMLElement>(
      "[data-timeline-marker-zone]",
    );

    await act(async () => {
      markerZone?.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 632 }),
      );
    });

    expect(dragMocks.handleTimelinePointerMove).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="hover-marker"]')?.textContent,
    ).toBe("6.25");
  });

  it("zooms the timeline with ctrl wheel", async () => {
    await renderTimeline();
    const scrollContainer = container.querySelector<HTMLElement>(
      "[data-timeline-scroll]",
    );

    await act(async () => {
      scrollContainer?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          ctrlKey: true,
          deltaY: -100,
        }),
      );
      scrollContainer?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          ctrlKey: true,
          deltaY: 100,
        }),
      );
    });

    expect(storeMocks.setZoom).toHaveBeenNthCalledWith(1, 1.25);
    expect(storeMocks.setZoom).toHaveBeenCalledTimes(1);
  });

  it("uses the active drag marker ahead of passive hover", async () => {
    dragMocks.useEditorTimelineDrag.mockReturnValue({
      activeTimelineMarkerSeconds: 7.54,
      clipDragPreview: null,
      handleTimelinePointerDown: dragMocks.handleTimelinePointerDown,
      handleTimelinePointerEnd: dragMocks.handleTimelinePointerEnd,
      handleTimelinePointerMove: dragMocks.handleTimelinePointerMove,
      timelineGridRef: { current: null },
    });

    await renderTimeline();

    expect(
      container.querySelector('[data-testid="hover-marker"]')?.textContent,
    ).toBe("7.54");
  });
});
