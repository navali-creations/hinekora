import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEditorTestProject } from "../../Editor.slice/Editor.slice.test-utils";

const dragMocks = vi.hoisted(() => ({
  handleTimelinePointerDown: vi.fn(),
  handleTimelinePointerEnd: vi.fn(),
  handleTimelinePointerMove: vi.fn(),
  useEditorTimelineDrag: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({
  hydrate: vi.fn(),
  redoProjectChange: vi.fn(),
  removeTimelineClip: vi.fn(),
  removeTimelineGap: vi.fn(),
  resetEditorRecordingBookmarks: vi.fn(),
  selectEditorRecordingCategory: vi.fn(),
  setHoveredTimelineGap: vi.fn(),
  setEditorRecordingHoveredBookmarkId: vi.fn(),
  setEditorRecordingPageIndex: vi.fn(),
  setEditorRecordingSelectedBookmarkId: vi.fn(),
  setZoom: vi.fn(),
  undoProjectChange: vi.fn(),
  useBookmarksShallow: vi.fn(),
  useEditorShallow: vi.fn(),
  useSavedEditsShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useBookmarksShallow: storeMocks.useBookmarksShallow,
  useEditorShallow: storeMocks.useEditorShallow,
  useSavedEditsShallow: storeMocks.useSavedEditsShallow,
  useSettingsSelector: storeMocks.useSettingsSelector,
}));

vi.mock("../../Editor.components/EditorAssetRail/EditorAssetRail", () => ({
  EditorAssetRail: () => <div data-testid="asset-rail" />,
}));
vi.mock("../../Editor.components/EditorActionsMenu/EditorActionsMenu", () => ({
  EditorActionsMenu: () => <button type="button">Actions</button>,
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
  EditorHistoryRail: () => <div data-testid="history-rail" />,
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
vi.mock(
  "../../Editor.hooks/useEditorTimelineDrag/useEditorTimelineDrag",
  () => ({
    useEditorTimelineDrag: dragMocks.useEditorTimelineDrag,
  }),
);
vi.mock(
  "../../Editor.components/EditorPlaybackControls/EditorPlaybackControls",
  () => ({
    EditorPlaybackControls: () => <div data-testid="playback-controls" />,
  }),
);
vi.mock(
  "../../Editor.components/EditorTimelineClipDragPreview/EditorTimelineClipDragPreview",
  () => ({
    EditorTimelineClipDragPreview: () => <div data-testid="drag-preview" />,
  }),
);
vi.mock("../../Editor.components/EditorTimelineGap/EditorTimelineGap", () => ({
  EditorTimelineGap: ({ gap }: { gap: { id: string } }) => (
    <div data-testid={`gap-${gap.id}`} />
  ),
}));
vi.mock(
  "../../Editor.components/EditorTimelineHoverMarker/EditorTimelineHoverMarker",
  () => ({
    EditorTimelineHoverMarker: () => <div data-testid="hover-marker" />,
  }),
);
vi.mock(
  "../../Editor.components/EditorTimelinePlayhead/EditorTimelinePlayhead",
  () => ({
    EditorTimelinePlayhead: () => <div data-testid="playhead" />,
  }),
);
vi.mock(
  "../../Editor.components/EditorTimelineTools/EditorTimelineTools",
  () => ({
    EditorTimelineTools: () => <div data-testid="timeline-tools" />,
  }),
);
vi.mock(
  "../../Editor.components/EditorTimelineVideoTrack/EditorTimelineVideoTrack",
  () => ({
    EditorTimelineVideoTrack: ({ track }: { track: { id: string } }) => (
      <div data-testid={`track-${track.id}`} />
    ),
  }),
);
vi.mock(
  "../../Editor.components/EditorTimelineZoomControls/EditorTimelineZoomControls",
  () => ({
    EditorTimelineZoomControls: () => <div data-testid="zoom-controls" />,
  }),
);

import { EditorPage } from "./EditorPage";

let container: HTMLDivElement;
let root: Root;
let editorState: Record<string, unknown>;
const settingsState = {
  value: {
    activeGame: "poe2",
    poe2SelectedLeague: "Standard",
  },
};
const savedEditsState = {
  libraryPage: {
    availableLeagues: [],
    globalTotalCount: 0,
    totalCount: 0,
  },
};

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
    project: createEditorTestProject(),
    redoProjectChange: storeMocks.redoProjectChange,
    removeTimelineClip: storeMocks.removeTimelineClip,
    removeTimelineGap: storeMocks.removeTimelineGap,
    selectedClipId: "timeline-1",
    setHoveredTimelineGap: storeMocks.setHoveredTimelineGap,
    setZoom: storeMocks.setZoom,
    undoProjectChange: storeMocks.undoProjectChange,
    zoom: 1,
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

describe("EditorPage integration", () => {
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
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector(settingsState),
    );
    storeMocks.useSavedEditsShallow.mockImplementation((selector) =>
      selector(savedEditsState),
    );
    storeMocks.useBookmarksShallow.mockImplementation((selector) =>
      selector({
        editorRecording: {
          categoryFilter: "__all__",
          hasInteracted: false,
          hoveredBookmarkId: null,
          pageIndex: 0,
          selectedBookmarkId: null,
        },
        resetEditorRecordingBookmarks: storeMocks.resetEditorRecordingBookmarks,
        selectEditorRecordingCategory: storeMocks.selectEditorRecordingCategory,
        setEditorRecordingHoveredBookmarkId:
          storeMocks.setEditorRecordingHoveredBookmarkId,
        setEditorRecordingPageIndex: storeMocks.setEditorRecordingPageIndex,
        setEditorRecordingSelectedBookmarkId:
          storeMocks.setEditorRecordingSelectedBookmarkId,
      }),
    );
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("keeps timeline zoom, delete shortcut, and copy lockout wired together", async () => {
    await renderEditorPage();
    const scrollContainer = container.querySelector<HTMLElement>(
      "[data-timeline-scroll]",
    );

    await act(async () => {
      scrollContainer?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -100,
        }),
      );
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));

    expect(storeMocks.setZoom).toHaveBeenCalledWith(1.25);
    expect(storeMocks.removeTimelineClip).toHaveBeenCalledWith("timeline-1");

    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
    });
    await renderEditorPage();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));

    expect(container.textContent).toContain("Processing");
    expect(storeMocks.removeTimelineClip).toHaveBeenCalledTimes(1);
  });
});
