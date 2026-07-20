import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestExportResult,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";

const storeMocks = vi.hoisted(() => ({
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorExportView } from "./EditorExportView";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      exportState: {
        error: null,
        fileName: null,
        progress: 0,
        result: null,
        status: "idle",
      },
      project: createEditorTestProject(),
      ...overrides,
    }),
  );
}

async function renderExportView() {
  await act(async () => {
    root.render(<EditorExportView />);
  });
}

describe("EditorExportView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("shows save progress while rendering", async () => {
    configureEditorState({
      exportState: {
        error: null,
        fileName: "rendering.mp4",
        progress: 0.42,
        result: null,
        status: "exporting",
      },
    });

    await renderExportView();

    expect(container.textContent).toContain("rendering.mp4");
    expect(container.textContent).not.toContain("Saving video");
    expect(
      container
        .querySelector('[aria-label="Video export progress"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("42");
    expect(container.textContent).toContain("Estimating time left...");
    expect(
      container
        .querySelector('[data-testid="editor-export-processing-view"]')
        ?.className.includes(
          "md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]",
        ),
    ).toBe(true);
    expect(
      container.querySelectorAll('[data-testid="media-processing-backdrop"]'),
    ).toHaveLength(1);
    expect(
      container
        .querySelector('[data-testid="editor-export-processing-view"]')
        ?.className.includes("p-6"),
    ).toBe(true);
    const preview = container.querySelector<HTMLVideoElement>(
      '[aria-label="Edited video preview"]',
    );
    expect(preview?.muted).toBe(true);
    expect(preview?.autoplay).toBe(true);
    expect(preview?.controls).toBe(false);
    expect(preview?.parentElement?.className).toContain("z-[2]");
    expect(preview?.getAttribute("src")).toBe(
      "hinekora-media://replay-clip/asset-1",
    );

    const playCallCount = vi.mocked(HTMLMediaElement.prototype.play).mock.calls
      .length;
    await act(async () => {
      preview!.currentTime = 5;
      preview!.dispatchEvent(new Event("ended", { bubbles: true }));
    });
    expect(preview?.currentTime).toBe(0);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(
      playCallCount + 1,
    );
  });

  it("plays edited clips in order while rendering", async () => {
    const firstAsset = createEditorTestAsset({
      assetKey: "clip:first",
      id: "first",
      mediaUrl: "hinekora-media://replay-clip/first",
      name: "first.mp4",
    });
    const secondAsset = createEditorTestAsset({
      assetKey: "clip:second",
      id: "second",
      mediaUrl: "hinekora-media://replay-clip/second",
      name: "second.mp4",
    });
    const firstClip = createEditorTestTimelineClip(firstAsset, {
      durationSeconds: 1,
      id: "timeline-first",
      inSeconds: 1,
      outSeconds: 3,
      playbackRate: 2,
    });
    const secondClip = createEditorTestTimelineClip(secondAsset, {
      durationSeconds: 2,
      id: "timeline-second",
      inSeconds: 2,
      outSeconds: 4,
      playbackRate: 1,
      startSeconds: 1,
    });
    const project = createEditorTestProject(firstAsset, {
      assets: [firstAsset, secondAsset],
      durationSeconds: 3,
      tracks: [
        {
          clips: [secondClip, firstClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    configureEditorState({
      exportState: {
        error: null,
        fileName: "rendering.mp4",
        progress: 0.42,
        result: null,
        status: "exporting",
      },
      project,
    });

    await renderExportView();

    let preview = container.querySelector<HTMLVideoElement>(
      '[aria-label="Edited video preview"]',
    );
    expect(preview?.getAttribute("src")).toBe(firstAsset.mediaUrl);
    expect(preview?.currentTime).toBe(1);
    expect(preview?.playbackRate).toBe(2);

    await act(async () => {
      preview!.currentTime = 2;
      preview!.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });
    expect(
      container
        .querySelector<HTMLVideoElement>('[aria-label="Edited video preview"]')
        ?.getAttribute("src"),
    ).toBe(firstAsset.mediaUrl);

    await act(async () => {
      preview!.currentTime = 3;
      preview!.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });
    preview = container.querySelector<HTMLVideoElement>(
      '[aria-label="Edited video preview"]',
    );
    expect(preview?.getAttribute("src")).toBe(secondAsset.mediaUrl);
    expect(preview?.currentTime).toBe(2);
    expect(preview?.playbackRate).toBe(1);

    await act(async () => {
      preview!.dispatchEvent(new Event("ended", { bubbles: true }));
    });
    expect(
      container
        .querySelector<HTMLVideoElement>('[aria-label="Edited video preview"]')
        ?.getAttribute("src"),
    ).toBe(firstAsset.mediaUrl);
  });

  it("shows a failed save message", async () => {
    configureEditorState({
      exportState: {
        error: "ffmpeg failed",
        fileName: null,
        progress: 0,
        result: null,
        status: "failed",
      },
    });

    await renderExportView();

    expect(container.textContent).toContain("Save failed");
    expect(container.textContent).toContain("ffmpeg failed");
  });

  it("uses the exported media URL when the export is ready", async () => {
    const result = createEditorTestExportResult({
      fileName: "ready.mp4",
      mediaUrl: "hinekora-editor-export://export/ready",
    });
    configureEditorState({
      exportState: {
        error: null,
        fileName: null,
        progress: 1,
        result,
        status: "ready",
      },
    });

    await renderExportView();

    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe(result.mediaUrl);
    expect(video?.getAttribute("title")).toBe("ready.mp4");
    expect(
      container
        .querySelector('[data-testid="editor-export-preview-frame"]')
        ?.className.includes("overflow-hidden"),
    ).toBe(true);
    expect(video?.className).toContain("h-full");
    expect(video?.className).toContain("w-auto");
    expect(video?.className).toContain("max-w-full");
  });

  it("shows preview unavailable without an export or selected media URL", async () => {
    const project = createEditorTestProject(undefined, {
      assets: [],
      selectedAssetKey: null,
    });
    configureEditorState({ project });

    await renderExportView();

    expect(container.textContent).toContain("Preview unavailable");
  });
});
