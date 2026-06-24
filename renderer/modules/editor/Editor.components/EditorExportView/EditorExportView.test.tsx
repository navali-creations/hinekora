import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestExportResult,
  createEditorTestProject,
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
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("shows export progress while rendering", async () => {
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
    expect(container.querySelector("progress")?.value).toBe(42);
  });

  it("shows a failed export message", async () => {
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

    expect(container.textContent).toContain("Export failed");
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
