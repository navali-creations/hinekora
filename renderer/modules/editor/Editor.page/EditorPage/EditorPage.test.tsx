import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/main/modules/editor";

const storeMocks = vi.hoisted(() => ({
  copyProjectToClipboard: vi.fn(),
  createProject: vi.fn(),
  hydrate: vi.fn(),
  openProject: vi.fn(),
  redoProjectChange: vi.fn(),
  removeAllTimelineGaps: vi.fn(),
  removeTimelineClip: vi.fn(),
  removeTimelineGap: vi.fn(),
  setHoveredTimelineGap: vi.fn(),
  splitTimelineClipAt: vi.fn(),
  toggleProjectAudioMuted: vi.fn(),
  undoProjectChange: vi.fn(),
  useEditorShallow: vi.fn(),
  useSavedEditsShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
  useSavedEditsShallow: storeMocks.useSavedEditsShallow,
  useSettingsSelector: storeMocks.useSettingsSelector,
}));

vi.mock("../../Editor.components/EditorAssetRail/EditorAssetRail", () => ({
  EditorAssetRail: () => <div data-testid="asset-rail" />,
}));
vi.mock("../../Editor.components/EditorActionsMenu/EditorActionsMenu", () => ({
  EditorActionsMenu: ({
    onToggleHistory,
    onToggleShortcuts,
  }: {
    isHistoryVisible: boolean;
    isShortcutsVisible: boolean;
    onToggleHistory: () => void;
    onToggleShortcuts: () => void;
  }) => (
    <>
      <button type="button" onClick={onToggleHistory}>
        Toggle history
      </button>
      <button type="button" onClick={onToggleShortcuts}>
        Toggle shortcuts
      </button>
    </>
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
  "../../Editor.components/EditorShortcutsRail/EditorShortcutsRail",
  () => ({
    EditorShortcutsRail: ({ onClose }: { onClose: () => void }) => (
      <div data-testid="shortcuts-rail">
        <button type="button" onClick={onClose}>
          Close shortcuts
        </button>
      </div>
    ),
  }),
);
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

import { editorShortcutEventNames } from "../../Editor.utils/EditorShortcuts.utils";
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
const settingsSlice = {
  value: {
    activeGame: "poe2",
    poe1SelectedLeague: "Standard",
    poe2SelectedLeague: "Standard",
  },
} as const;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  editorState = {
    clipboardState: { error: null, requestId: null, status: "idle" },
    copyProjectToClipboard: storeMocks.copyProjectToClipboard,
    createProject: storeMocks.createProject,
    error: null,
    exportState: {
      fileName: null,
      result: null,
      status: "idle",
    },
    hoveredTimelineGap: null,
    hydrate: storeMocks.hydrate,
    isLoading: false,
    openProject: storeMocks.openProject,
    playbackSeconds: 4,
    previewHasAudio: true,
    project,
    redoProjectChange: storeMocks.redoProjectChange,
    removeAllTimelineGaps: storeMocks.removeAllTimelineGaps,
    removeTimelineClip: storeMocks.removeTimelineClip,
    removeTimelineGap: storeMocks.removeTimelineGap,
    selectedClipId: "timeline-1",
    setHoveredTimelineGap: storeMocks.setHoveredTimelineGap,
    splitTimelineClipAt: storeMocks.splitTimelineClipAt,
    toggleProjectAudioMuted: storeMocks.toggleProjectAudioMuted,
    undoProjectChange: storeMocks.undoProjectChange,
    workspace: {
      assets: project.assets,
      hasMoreProjects: false,
      project,
      projects: [],
    },
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
    storeMocks.hydrate.mockResolvedValue(true);
    storeMocks.openProject.mockResolvedValue(true);
    configureEditorState();
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector(settingsSlice),
    );
    storeMocks.useSavedEditsShallow.mockImplementation((selector) =>
      selector({
        libraryPage: {
          availableLeagues: ["Standard"],
          globalTotalCount: 0,
          totalCount: 0,
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

  it("supports editor command shortcuts", async () => {
    const openSaveDialog = vi.fn();
    const openDeleteEditDialog = vi.fn();
    window.addEventListener(
      editorShortcutEventNames.openSaveDialog,
      openSaveDialog,
    );
    window.addEventListener(
      editorShortcutEventNames.openDeleteEditDialog,
      openDeleteEditDialog,
    );
    await renderEditorPage();

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "c",
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "s",
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "n",
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "d",
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "h",
        }),
      );
    });

    expect(storeMocks.copyProjectToClipboard).toHaveBeenCalledTimes(1);
    expect(openSaveDialog).toHaveBeenCalledTimes(1);
    expect(storeMocks.createProject).toHaveBeenCalledWith({ assetKeys: [] });
    expect(openDeleteEditDialog).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-testid='history-rail']")).not.toBe(
      null,
    );

    window.removeEventListener(
      editorShortcutEventNames.openSaveDialog,
      openSaveDialog,
    );
    window.removeEventListener(
      editorShortcutEventNames.openDeleteEditDialog,
      openDeleteEditDialog,
    );
  });

  it("ignores editor shortcuts while a dialog is focused", async () => {
    const openSaveDialog = vi.fn();
    const openDeleteEditDialog = vi.fn();
    window.addEventListener(
      editorShortcutEventNames.openSaveDialog,
      openSaveDialog,
    );
    window.addEventListener(
      editorShortcutEventNames.openDeleteEditDialog,
      openDeleteEditDialog,
    );
    await renderEditorPage();

    const dialog = document.createElement("dialog");
    const dialogButton = document.createElement("button");
    dialog.setAttribute("open", "");
    dialog.append(dialogButton);
    document.body.append(dialog);
    dialogButton.focus();

    await act(async () => {
      dialogButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Delete",
        }),
      );
      dialogButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "c",
        }),
      );
      dialogButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "s",
        }),
      );
      dialogButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "d",
        }),
      );
    });

    expect(storeMocks.removeTimelineClip).not.toHaveBeenCalled();
    expect(storeMocks.copyProjectToClipboard).not.toHaveBeenCalled();
    expect(openSaveDialog).not.toHaveBeenCalled();
    expect(openDeleteEditDialog).not.toHaveBeenCalled();

    window.removeEventListener(
      editorShortcutEventNames.openSaveDialog,
      openSaveDialog,
    );
    window.removeEventListener(
      editorShortcutEventNames.openDeleteEditDialog,
      openDeleteEditDialog,
    );
  });

  it("supports focused timeline single-key shortcuts", async () => {
    await renderEditorPage();

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "s" }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "m" }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "c" }),
      );
    });

    expect(storeMocks.splitTimelineClipAt).toHaveBeenCalledWith(4);
    expect(storeMocks.toggleProjectAudioMuted).toHaveBeenCalledTimes(1);
    expect(storeMocks.removeAllTimelineGaps).toHaveBeenCalledTimes(1);
  });

  it("blocks mutating editor shortcuts while processing", async () => {
    const openSaveDialog = vi.fn();
    const openDeleteEditDialog = vi.fn();
    window.addEventListener(
      editorShortcutEventNames.openSaveDialog,
      openSaveDialog,
    );
    window.addEventListener(
      editorShortcutEventNames.openDeleteEditDialog,
      openDeleteEditDialog,
    );
    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
    });
    await renderEditorPage();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "c",
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "s",
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "n",
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "d",
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "s" }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "m" }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "c" }),
      );
    });

    expect(container.textContent).toContain("Processing");
    expect(storeMocks.removeTimelineClip).not.toHaveBeenCalled();
    expect(storeMocks.copyProjectToClipboard).not.toHaveBeenCalled();
    expect(openSaveDialog).not.toHaveBeenCalled();
    expect(storeMocks.createProject).not.toHaveBeenCalled();
    expect(openDeleteEditDialog).not.toHaveBeenCalled();
    expect(storeMocks.splitTimelineClipAt).not.toHaveBeenCalled();
    expect(storeMocks.toggleProjectAudioMuted).not.toHaveBeenCalled();
    expect(storeMocks.removeAllTimelineGaps).not.toHaveBeenCalled();

    window.removeEventListener(
      editorShortcutEventNames.openSaveDialog,
      openSaveDialog,
    );
    window.removeEventListener(
      editorShortcutEventNames.openDeleteEditDialog,
      openDeleteEditDialog,
    );
  });

  it("hydrates when no editor project exists", async () => {
    configureEditorState({ project: null });

    await renderEditorPage();

    expect(storeMocks.hydrate).toHaveBeenCalledWith(null);
  });

  it("opens a saved edit from the editor route project id", async () => {
    await act(async () => {
      root.render(<EditorPage projectId="project-2" />);
    });

    expect(storeMocks.openProject).toHaveBeenCalledWith("project-2");
    expect(storeMocks.hydrate).not.toHaveBeenCalled();
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

  it("shows shortcuts in the right rail in place of history", async () => {
    await renderEditorPage();

    const shortcutsButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Toggle shortcuts");
    await act(async () => {
      shortcutsButton?.click();
    });

    expect(container.querySelector("[data-testid='shortcuts-rail']")).not.toBe(
      null,
    );
    expect(container.querySelector("[data-testid='history-rail']")).toBe(null);

    const historyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Toggle history",
    );
    await act(async () => {
      historyButton?.click();
    });

    expect(container.querySelector("[data-testid='history-rail']")).not.toBe(
      null,
    );
    expect(container.querySelector("[data-testid='shortcuts-rail']")).toBe(
      null,
    );
  });

  it("rehydrates when opening a different editor source", async () => {
    await renderEditorPageWithSource({ id: "asset-2", kind: "clip" });

    expect(storeMocks.hydrate).toHaveBeenCalledWith({
      id: "asset-2",
      kind: "clip",
    });
  });

  it("does not rehydrate the same redirected source after local timeline changes", async () => {
    const source = { id: "asset-1", kind: "clip" } as const;

    await renderEditorPageWithSource(source);

    expect(storeMocks.hydrate).toHaveBeenCalledWith(source);
    storeMocks.hydrate.mockClear();
    configureEditorState({
      project: {
        ...project,
        activeClipId: null,
        selectedAssetKey: null,
        tracks: [],
      },
      selectedClipId: null,
    });

    await renderEditorPageWithSource(source);

    expect(storeMocks.hydrate).not.toHaveBeenCalled();
  });

  it("hydrates a new source after consuming a previous source", async () => {
    await renderEditorPageWithSource({ id: "asset-2", kind: "clip" });
    storeMocks.hydrate.mockClear();

    await renderEditorPageWithSource({ id: "asset-3", kind: "clip" });

    expect(storeMocks.hydrate).toHaveBeenCalledWith({
      id: "asset-3",
      kind: "clip",
    });
  });
});
