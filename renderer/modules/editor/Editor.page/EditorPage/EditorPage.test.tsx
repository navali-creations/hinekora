import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/main/modules/editor";

const storeMocks = vi.hoisted(() => ({
  hydrate: vi.fn(),
  redoProjectChange: vi.fn(),
  removeTimelineClip: vi.fn(),
  removeTimelineGap: vi.fn(),
  setHoveredTimelineGap: vi.fn(),
  undoProjectChange: vi.fn(),
  useEditorShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
  useSettingsSelector: storeMocks.useSettingsSelector,
}));

vi.mock("../../Editor.components/EditorAssetRail/EditorAssetRail", () => ({
  EditorAssetRail: () => <div data-testid="asset-rail" />,
}));
vi.mock("../../Editor.components/EditorActionsMenu/EditorActionsMenu", () => ({
  EditorActionsMenu: ({
    onToggleHistory,
  }: {
    isHistoryVisible: boolean;
    onToggleHistory: () => void;
  }) => (
    <button type="button" onClick={onToggleHistory}>
      Toggle history
    </button>
  ),
}));
vi.mock(
  "../../Editor.components/EditorDragDropProvider/EditorDragDropProvider",
  () => ({
    EditorDragDropProvider: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  }),
);
vi.mock(
  "../../Editor.components/EditorExportActions/EditorExportActions",
  () => ({
    EditorExportActions: () => <button type="button">Export action</button>,
  }),
);
vi.mock("../../Editor.components/EditorExportView/EditorExportView", () => ({
  EditorExportView: () => <div data-testid="export-view" />,
}));
vi.mock("../../Editor.components/EditorHistoryRail/EditorHistoryRail", () => ({
  EditorHistoryRail: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="history-rail">
      <button type="button" onClick={onClose}>
        Close history
      </button>
    </div>
  ),
}));
vi.mock(
  "../../Editor.components/EditorPreviewStage/EditorPreviewStage",
  () => ({
    EditorPreviewStage: () => <div data-testid="preview-stage" />,
  }),
);
vi.mock(
  "../../Editor.components/EditorProjectPicker/EditorProjectPicker",
  () => ({
    EditorProjectPicker: () => <div data-testid="project-picker" />,
  }),
);
vi.mock("../../Editor.components/EditorTimeline/EditorTimeline", () => ({
  EditorTimeline: () => <div data-testid="timeline" />,
}));

import { EditorPage } from "./EditorPage";

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
  selectedAssetKey: "clip:asset-1",
  title: "asset-1.mp4 edit",
  tracks: [],
  updatedAt: "2026-06-18T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;
let editorState: Record<string, unknown>;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  editorState = {
    clipboardState: { error: null, requestId: null, status: "idle" },
    error: null,
    exportState: {
      fileName: null,
      result: null,
      status: "idle",
    },
    hoveredTimelineGap: null,
    hydrate: storeMocks.hydrate,
    isLoading: false,
    project,
    redoProjectChange: storeMocks.redoProjectChange,
    removeTimelineClip: storeMocks.removeTimelineClip,
    removeTimelineGap: storeMocks.removeTimelineGap,
    selectedClipId: "timeline-1",
    setHoveredTimelineGap: storeMocks.setHoveredTimelineGap,
    undoProjectChange: storeMocks.undoProjectChange,
    ...overrides,
  };
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector(editorState),
  );
}

async function renderEditorPage() {
  await act(async () => {
    root.render(<EditorPage />);
  });
}

async function renderEditorPageWithSource(
  source: { id: string; kind: "clip" | "recording" } | null,
) {
  await act(async () => {
    root.render(<EditorPage source={source} />);
  });
}

describe("EditorPage shortcuts", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureEditorState();
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector({
        value: {
          activeGame: "poe2",
        },
      }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("deletes the selected clip with the Delete key", async () => {
    await renderEditorPage();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));

    expect(storeMocks.removeTimelineClip).toHaveBeenCalledWith("timeline-1");
    expect(storeMocks.removeTimelineGap).not.toHaveBeenCalled();
  });

  it("deletes the active clip when focus is inside timeline controls", async () => {
    configureEditorState({ selectedClipId: null });
    await renderEditorPage();
    const focusedButton = document.createElement("button");
    document.body.append(focusedButton);
    focusedButton.focus();

    focusedButton.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        code: "Delete",
        key: "Del",
      }),
    );

    expect(storeMocks.removeTimelineClip).toHaveBeenCalledWith("timeline-1");
  });

  it("prioritizes deleting a hovered gap over the selected clip", async () => {
    const gap = {
      durationSeconds: 2,
      endSeconds: 5,
      id: "gap-3-5",
      startSeconds: 3,
    };
    configureEditorState({ hoveredTimelineGap: gap });
    await renderEditorPage();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));

    expect(storeMocks.removeTimelineGap).toHaveBeenCalledWith({
      endSeconds: 5,
      startSeconds: 3,
    });
    expect(storeMocks.setHoveredTimelineGap).toHaveBeenCalledWith(null);
    expect(storeMocks.removeTimelineClip).not.toHaveBeenCalled();
  });

  it("supports undo and redo shortcuts", async () => {
    await renderEditorPage();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { ctrlKey: true, key: "z" }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", { ctrlKey: true, key: "y" }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        ctrlKey: true,
        key: "z",
        shiftKey: true,
      }),
    );

    expect(storeMocks.undoProjectChange).toHaveBeenCalledTimes(1);
    expect(storeMocks.redoProjectChange).toHaveBeenCalledTimes(2);
  });

  it("blocks editor shortcuts while copying to clipboard", async () => {
    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
    });
    await renderEditorPage();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));

    expect(container.textContent).toContain("Processing");
    expect(storeMocks.removeTimelineClip).not.toHaveBeenCalled();
  });

  it("hydrates when no editor project exists", async () => {
    configureEditorState({ project: null });

    await renderEditorPage();

    expect(storeMocks.hydrate).toHaveBeenCalledWith(null);
  });

  it("does not rehydrate over an existing local editor project", async () => {
    await renderEditorPage();

    expect(storeMocks.hydrate).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Editing asset-1.mp4");
  });

  it("toggles the history rail from the action menu", async () => {
    await renderEditorPage();

    expect(container.querySelector("[data-testid='history-rail']")).toBe(null);

    const toggleButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Toggle history",
    );
    await act(async () => {
      toggleButton?.click();
    });

    expect(container.querySelector("[data-testid='history-rail']")).not.toBe(
      null,
    );

    const closeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Close history",
    );
    await act(async () => {
      closeButton?.click();
    });

    expect(container.querySelector("[data-testid='history-rail']")).toBe(null);
  });

  it("rehydrates when opening a different editor source", async () => {
    await renderEditorPageWithSource({ id: "asset-2", kind: "clip" });

    expect(storeMocks.hydrate).toHaveBeenCalledWith({
      id: "asset-2",
      kind: "clip",
    });
  });
});
