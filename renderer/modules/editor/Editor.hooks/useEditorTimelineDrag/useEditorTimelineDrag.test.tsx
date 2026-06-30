import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/main/modules/editor";

const storeMocks = vi.hoisted(() => ({
  beginHistoryTransaction: vi.fn(),
  commitHistoryTransaction: vi.fn(),
  moveTimelineClip: vi.fn(),
  selectTimelineClip: vi.fn(),
  setPlaybackSeconds: vi.fn(),
  trimTimelineClipEdge: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { useEditorTimelineDrag } from "./useEditorTimelineDrag";

const project: EditorProject = {
  activeClipId: "timeline-1",
  assets: [
    {
      assetKey: "clip:asset-1",
      category: "death-clip",
      createdAt: "2026-06-18T00:00:00.000Z",
      durationSeconds: 10,
      exists: true,
      id: "asset-1",
      kind: "clip",
      mediaUrl: "hinekora-media://replay-clip/asset-1",
      name: "asset-1.mp4",
      sizeBytes: 1024,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      status: "ready",
      subtitle: "Death clip - Standard",
    },
  ],
  createdAt: "2026-06-18T00:00:00.000Z",
  durationSeconds: 10,
  id: "project-1",
  selectedAssetKey: null,
  title: "Test edit",
  tracks: [
    {
      clips: [
        {
          assetKey: "clip:asset-1",
          color: "primary",
          durationSeconds: 4,
          id: "timeline-1",
          inSeconds: 0,
          mediaUrl: "hinekora-media://replay-clip/asset-1",
          name: "asset-1.mp4",
          outSeconds: 4,
          sourceInSeconds: 0,
          sourceOutSeconds: 10,
          startSeconds: 0,
          trackId: "video-track",
        },
      ],
      id: "video-track",
      kind: "video",
      label: "Video",
    },
  ],
  updatedAt: "2026-06-18T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;

function configureEditorState(projectOverride = project) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      beginHistoryTransaction: storeMocks.beginHistoryTransaction,
      commitHistoryTransaction: storeMocks.commitHistoryTransaction,
      moveTimelineClip: storeMocks.moveTimelineClip,
      project: projectOverride,
      selectTimelineClip: storeMocks.selectTimelineClip,
      setPlaybackSeconds: storeMocks.setPlaybackSeconds,
      trimTimelineClipEdge: storeMocks.trimTimelineClipEdge,
      zoom: 1,
    }),
  );
}

function TimelineDragHarness() {
  const {
    activeTimelineMarkerKind,
    activeTimelineMarkerSeconds,
    clipDragPreview,
    handleTimelinePointerDown,
    handleTimelinePointerEnd,
    handleTimelinePointerMove,
    timelineGridRef,
  } = useEditorTimelineDrag({
    railPaddingPixels: 100,
    visibleDurationSeconds: 10,
  });

  return (
    <div
      data-testid="timeline"
      ref={timelineGridRef}
      onPointerCancel={handleTimelinePointerEnd}
      onPointerDown={handleTimelinePointerDown}
      onPointerMove={handleTimelinePointerMove}
      onPointerUp={handleTimelinePointerEnd}
    >
      <div data-testid="marker-zone" data-timeline-marker-zone="true">
        <button
          data-gap-delete-button="true"
          data-testid="gap-delete"
          type="button"
        >
          Delete gap
        </button>
      </div>
      <button
        data-playhead-handle="true"
        data-testid="playhead"
        type="button"
      />
      <div data-testid="clip" data-timeline-clip="timeline-1">
        <button
          data-clip-body="true"
          data-clip-duration-seconds="4"
          data-clip-id="timeline-1"
          data-clip-start-seconds="0"
          data-testid="clip-body"
          type="button"
        />
        <button
          data-clip-id="timeline-1"
          data-testid="trim-end"
          data-trim-edge="end"
          type="button"
        />
        <button
          data-clip-id="timeline-1"
          data-testid="trim-start"
          data-trim-edge="start"
          type="button"
        />
      </div>
      {clipDragPreview && (
        <output data-testid="drag-preview">
          {clipDragPreview.startSeconds.toFixed(2)}
        </output>
      )}
      {activeTimelineMarkerSeconds !== null && (
        <output data-testid="active-marker">
          {activeTimelineMarkerSeconds.toFixed(2)}
        </output>
      )}
      {activeTimelineMarkerKind !== null && (
        <output data-testid="active-marker-kind">
          {activeTimelineMarkerKind}
        </output>
      )}
    </div>
  );
}

async function renderHarness() {
  await act(async () => {
    root.render(<TimelineDragHarness />);
  });
  configureTimelineGeometry();
}

function configureTimelineGeometry() {
  const timeline = getElement("timeline");
  const clip = getElement("clip");
  Object.assign(timeline, {
    getBoundingClientRect: () =>
      createRect({ height: 200, left: 0, top: 0, width: 1_100 }),
    hasPointerCapture: vi.fn(() => true),
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn(),
  });
  Object.assign(clip, {
    getBoundingClientRect: () =>
      createRect({ height: 50, left: 100, top: 80, width: 400 }),
  });
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

function getElement(testId: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `[data-testid="${testId}"]`,
  );
  if (!element) {
    throw new Error(`Missing element: ${testId}`);
  }

  return element;
}

function dispatchPointer(
  target: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  input: {
    button?: number;
    clientX: number;
    clientY?: number;
    pointerId?: number;
  },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: input.button ?? 0,
    cancelable: true,
    clientX: input.clientX,
    clientY: input.clientY ?? 100,
  });
  Object.defineProperty(event, "pointerId", {
    value: input.pointerId ?? 1,
  });
  act(() => {
    target.dispatchEvent(event);
  });
}

describe("useEditorTimelineDrag", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("seeks from marker zones and ignores gap delete buttons", async () => {
    await renderHarness();

    dispatchPointer(getElement("marker-zone"), "pointerdown", { clientX: 550 });
    dispatchPointer(getElement("gap-delete"), "pointerdown", { clientX: 700 });

    expect(storeMocks.setPlaybackSeconds).toHaveBeenCalledTimes(1);
    expect(storeMocks.setPlaybackSeconds).toHaveBeenCalledWith(5);
  });

  it("moves the playhead without starting playback", async () => {
    await renderHarness();

    dispatchPointer(getElement("playhead"), "pointerdown", { clientX: 280 });
    expect(getElement("active-marker-kind").textContent).toBe("playhead");
    dispatchPointer(getElement("timeline"), "pointermove", { clientX: 460 });
    dispatchPointer(getElement("timeline"), "pointerup", { clientX: 460 });

    expect(storeMocks.setPlaybackSeconds).toHaveBeenNthCalledWith(1, 2);
    expect(storeMocks.setPlaybackSeconds).toHaveBeenNthCalledWith(2, 4);
    expect(storeMocks.commitHistoryTransaction).toHaveBeenCalledTimes(1);
  });

  it("trims a clip edge and commits the history transaction", async () => {
    await renderHarness();

    dispatchPointer(getElement("trim-start"), "pointerdown", { clientX: 280 });
    expect(getElement("active-marker").textContent).toBe("2.00");
    expect(getElement("active-marker-kind").textContent).toBe("trim");
    dispatchPointer(getElement("timeline"), "pointermove", { clientX: 370 });
    expect(getElement("active-marker").textContent).toBe("3.00");
    dispatchPointer(getElement("timeline"), "pointerup", { clientX: 400 });

    expect(storeMocks.beginHistoryTransaction).toHaveBeenCalledTimes(1);
    expect(storeMocks.beginHistoryTransaction).toHaveBeenCalledWith(
      "Trim start",
      "asset-1.mp4",
    );
    expect(storeMocks.selectTimelineClip).toHaveBeenCalledWith("timeline-1");
    expect(storeMocks.trimTimelineClipEdge).toHaveBeenNthCalledWith(
      1,
      "timeline-1",
      "start",
      2,
    );
    expect(storeMocks.trimTimelineClipEdge).toHaveBeenNthCalledWith(
      2,
      "timeline-1",
      "start",
      3,
    );
    expect(storeMocks.commitHistoryTransaction).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-testid='active-marker']")).toBe(null);
    expect(container.querySelector("[data-testid='active-marker-kind']")).toBe(
      null,
    );
  });

  it("uses the visible timeline range when starting a trim drag", async () => {
    configureEditorState({
      ...project,
      activeClipId: "timeline-other",
      durationSeconds: 10,
      tracks: [
        {
          ...project.tracks[0]!,
          clips: [
            {
              ...project.tracks[0]!.clips[0]!,
              durationSeconds: 2,
              inSeconds: 0,
              outSeconds: 2,
              startSeconds: 8,
            },
          ],
        },
      ],
    });
    await renderHarness();

    dispatchPointer(getElement("trim-end"), "pointerdown", { clientX: 1_000 });
    dispatchPointer(getElement("timeline"), "pointermove", { clientX: 1_000 });

    expect(storeMocks.selectTimelineClip).toHaveBeenCalledWith("timeline-1");
    expect(storeMocks.trimTimelineClipEdge).toHaveBeenNthCalledWith(
      1,
      "timeline-1",
      "end",
      10,
    );
    expect(storeMocks.trimTimelineClipEdge).toHaveBeenNthCalledWith(
      2,
      "timeline-1",
      "end",
      10,
    );
  });

  it("moves clips after the activation threshold and exposes a drag preview", async () => {
    await renderHarness();

    dispatchPointer(getElement("clip-body"), "pointerdown", {
      clientX: 145,
      clientY: 90,
    });
    dispatchPointer(getElement("timeline"), "pointermove", {
      clientX: 147,
      clientY: 90,
    });
    expect(storeMocks.moveTimelineClip).not.toHaveBeenCalled();

    dispatchPointer(getElement("timeline"), "pointermove", {
      clientX: 685,
      clientY: 90,
    });

    expect(storeMocks.selectTimelineClip).toHaveBeenCalledWith("timeline-1");
    expect(storeMocks.beginHistoryTransaction).toHaveBeenCalledTimes(1);
    expect(storeMocks.moveTimelineClip).not.toHaveBeenCalled();
    expect(getElement("drag-preview").textContent).toBe("6.00");

    dispatchPointer(getElement("timeline"), "pointerup", {
      clientX: 685,
      clientY: 90,
    });

    expect(storeMocks.moveTimelineClip).toHaveBeenCalledWith(
      "timeline-1",
      6,
      6.5,
    );
    expect(storeMocks.commitHistoryTransaction).toHaveBeenCalledTimes(1);
  });
});
