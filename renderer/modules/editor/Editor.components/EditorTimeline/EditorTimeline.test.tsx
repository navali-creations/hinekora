import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordingBookmark } from "~/main/modules/bookmarks";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";
import type { EditorTimelineBookmarks } from "./EditorTimeline";

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
vi.mock("../EditorAudioControls/EditorAudioControls", () => ({
  EditorAudioControls: () => <div data-testid="audio-controls" />,
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
    useCompactTrimHandles,
    visibleDurationSeconds,
  }: {
    track: { clips: unknown[]; id: string; label: string };
    useCompactTrimHandles: boolean;
    visibleDurationSeconds: number;
  }) => (
    <div
      data-compact-trim-handles={String(useCompactTrimHandles)}
      data-testid={`track-${track.id}`}
      data-visible-duration={visibleDurationSeconds}
    >
      {track.clips.length}
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
      clipboardState: { error: null, requestId: null, status: "idle" },
      exportState: { status: "idle" },
      isPreviewPlaying: false,
      isTimelineFitToEdit: false,
      playbackSeconds: 0,
      project: createEditorTestProject(),
      selectedClipId: "timeline-1",
      setZoom: storeMocks.setZoom,
      zoom: 1,
      ...overrides,
    }),
  );
}

const hoveredBookmark: RecordingBookmark = {
  category: "map",
  createdAt: "2026-07-03T10:00:00.000Z",
  durationSeconds: 2,
  id: "bookmark-map",
  label: "Qimah Reservoir",
  note: null,
  occurredAt: "2026-07-03T10:00:05.000Z",
  offsetSeconds: 4.5,
  sceneName: "Qimah Reservoir",
  source: "client-log",
  sourceGame: "poe2",
  sourceLeague: "Standard",
  subcategory: null,
  updatedAt: "2026-07-03T10:00:00.000Z",
};

async function renderTimeline(bookmarks?: EditorTimelineBookmarks) {
  await act(async () => {
    root.render(<EditorTimeline {...(bookmarks ? { bookmarks } : {})} />);
  });
}

describe("EditorTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dragMocks.useEditorTimelineDrag.mockReturnValue({
      activeTrimVisibleDurationSeconds: null,
      activeTimelineMarkerKind: null,
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
    ).toBe("1");
    expect(
      container
        .querySelector('[data-testid="track-video-track"]')
        ?.getAttribute("data-visible-duration"),
    ).toBe("97.5");
    expect(
      container
        .querySelector('[data-testid="track-video-track"]')
        ?.getAttribute("data-compact-trim-handles"),
    ).toBe("false");
    expect(
      container
        .querySelector<HTMLElement>("[data-timeline-grid]")
        ?.style.getPropertyValue("width"),
    ).toBe("100%");
    expect(
      container.querySelectorAll("[data-timeline-minor-marker]").length,
    ).toBeGreaterThan(0);
  });

  it("keeps spacious recordings zoomable after the trailing tail", async () => {
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

  it("keeps a short trailing tail for short recordings", async () => {
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

  it("keeps a short trailing tail after trimming", async () => {
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
    ).toBe("37.5");
  });

  it("fits the rail duration to the current edit when fit mode is active", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 54.95 });
    configureEditorState({
      isTimelineFitToEdit: true,
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
    ).toBe("30");
  });

  it("keeps the visual rail duration stable while trimming the last clip", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 54.95 });
    const createProjectWithClipDuration = (durationSeconds: number) =>
      createEditorTestProject(asset, {
        durationSeconds,
        tracks: [
          {
            clips: [
              createEditorTestTimelineClip(asset, {
                durationSeconds,
                outSeconds: durationSeconds,
                sourceOutSeconds: 54.95,
              }),
            ],
            id: "video-track",
            kind: "video",
            label: "Video",
          },
        ],
      });

    configureEditorState({
      project: createProjectWithClipDuration(30),
      zoom: 1,
    });
    await renderTimeline();
    expect(
      container
        .querySelector('[data-testid="track-video-track"]')
        ?.getAttribute("data-visible-duration"),
    ).toBe("37.5");

    dragMocks.useEditorTimelineDrag.mockReturnValue({
      activeTrimVisibleDurationSeconds: 37.5,
      activeTimelineMarkerKind: "trim",
      activeTimelineMarkerSeconds: 20,
      clipDragPreview: null,
      handleTimelinePointerDown: dragMocks.handleTimelinePointerDown,
      handleTimelinePointerEnd: dragMocks.handleTimelinePointerEnd,
      handleTimelinePointerMove: dragMocks.handleTimelinePointerMove,
      timelineGridRef: { current: null },
    });
    configureEditorState({
      project: createProjectWithClipDuration(20),
      zoom: 1,
    });
    await renderTimeline();

    expect(
      container
        .querySelector('[data-testid="track-video-track"]')
        ?.getAttribute("data-visible-duration"),
    ).toBe("37.5");
  });

  it("uses compact trim handles for every clip once any clip is too narrow", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 20 });
    const firstClip = createEditorTestTimelineClip(asset, {
      durationSeconds: 10,
      id: "timeline-first",
      outSeconds: 10,
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      durationSeconds: 0.5,
      id: "timeline-second",
      outSeconds: 0.5,
      startSeconds: 10,
    });
    configureEditorState({
      project: createEditorTestProject(asset, {
        durationSeconds: 10.5,
        tracks: [
          {
            clips: [firstClip, secondClip],
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
        ?.getAttribute("data-compact-trim-handles"),
    ).toBe("true");
  });

  it("resolves hover seconds from the marker zone", async () => {
    await renderTimeline();
    const markerZone = container.querySelector<HTMLElement>(
      "[data-timeline-marker-zone]",
    );

    await act(async () => {
      markerZone?.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 566 }),
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

  it("does not zoom the timeline with meta wheel", async () => {
    await renderTimeline();
    const scrollContainer = container.querySelector<HTMLElement>(
      "[data-timeline-scroll]",
    );

    await act(async () => {
      scrollContainer?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          deltaY: -100,
          metaKey: true,
        }),
      );
    });

    expect(storeMocks.setZoom).not.toHaveBeenCalled();
  });

  it("blocks timeline interaction while the editor is processing", async () => {
    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
    });
    await renderTimeline();
    const scrollContainer = container.querySelector<HTMLElement>(
      "[data-timeline-scroll]",
    );
    const grid = container.querySelector<HTMLElement>("[data-timeline-grid]");

    await act(async () => {
      grid?.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, clientX: 566 }),
      );
      grid?.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 566 }),
      );
      scrollContainer?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          ctrlKey: true,
          deltaY: -100,
        }),
      );
    });

    expect(grid?.getAttribute("aria-disabled")).toBe("true");
    expect(grid?.className).toContain("pointer-events-none");
    expect(dragMocks.handleTimelinePointerDown).not.toHaveBeenCalled();
    expect(dragMocks.handleTimelinePointerMove).not.toHaveBeenCalled();
    expect(storeMocks.setZoom).not.toHaveBeenCalled();
  });

  it("uses the active drag marker ahead of passive hover", async () => {
    dragMocks.useEditorTimelineDrag.mockReturnValue({
      activeTrimVisibleDurationSeconds: 37.5,
      activeTimelineMarkerKind: "trim",
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

  it("uses the hovered recording bookmark as the passive marker", async () => {
    await renderTimeline({
      hoveredBookmark,
      markerBookmarks: [],
      showBookmarkMarkers: false,
    });

    expect(
      container.querySelector('[data-testid="hover-marker"]')?.textContent,
    ).toBe("4.5");
    expect(
      container.querySelector(
        '[data-recording-bookmark-marker-id="bookmark-map"]',
      ),
    ).not.toBe(null);
  });

  it("does not duplicate a highlighted bookmark marker already visible in the marker layer", async () => {
    await renderTimeline({
      hoveredBookmark,
      markerBookmarks: [hoveredBookmark],
      showBookmarkMarkers: true,
    });

    expect(
      container.querySelectorAll(
        '[data-recording-bookmark-marker-id="bookmark-map"]',
      ),
    ).toHaveLength(1);
  });

  it("allows a highlighted bookmark segment without a pinned point marker", async () => {
    await renderTimeline({
      hoveredBookmark,
      markerBookmarks: [],
      pinnedBookmark: null,
      showBookmarkMarkers: false,
    });

    expect(
      container.querySelector('[data-testid="hover-marker"]')?.textContent,
    ).toBe("none");
    expect(
      container.querySelector(
        '[data-recording-timeline-hover-segment-id="bookmark-map"]',
      ),
    ).not.toBe(null);
    expect(
      container.querySelector(
        '[data-recording-bookmark-marker-id="bookmark-map"]',
      ),
    ).toBe(null);
  });

  it("hides the hover marker while dragging the playhead", async () => {
    dragMocks.useEditorTimelineDrag.mockReturnValue({
      activeTrimVisibleDurationSeconds: null,
      activeTimelineMarkerKind: "playhead",
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
    ).toBe("none");
  });
});
