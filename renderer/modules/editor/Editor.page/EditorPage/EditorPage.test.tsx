import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RecordingBookmark,
  RecordingBookmarksPage,
} from "~/main/modules/bookmarks";
import type { EditorProject } from "~/main/modules/editor";

import {
  createDeferred,
  createEditorTestRecordingBookmark,
} from "../../Editor.slice/Editor.slice.test-utils";

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
  setMediaFilter: vi.fn(),
  setPlaybackSeconds: vi.fn(),
  splitTimelineClipAt: vi.fn(),
  toggleProjectAudioMuted: vi.fn(),
  undoProjectChange: vi.fn(),
  useSavedEditsShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
}));
const bookmarkStoreMocks = vi.hoisted(() => {
  const allCategory = "__all__";
  const listeners = new Set<() => void>();
  const createInitialEditorRecording = () => ({
    categoryFilter: allCategory,
    hasInteracted: false,
    hoveredBookmarkId: null as string | null,
    pageIndex: 0,
    selectedBookmarkId: null as string | null,
  });
  let editorRecording = createInitialEditorRecording();
  let snapshot: unknown;
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  const setEditorRecording = (nextEditorRecording: typeof editorRecording) => {
    editorRecording = nextEditorRecording;
    snapshot = createSnapshot();
    notify();
  };
  const actions = {
    resetEditorRecordingBookmarks: () => {
      setEditorRecording(createInitialEditorRecording());
    },
    selectEditorRecordingCategory: (category: string) => {
      const isActive =
        editorRecording.hasInteracted &&
        editorRecording.categoryFilter === category;
      setEditorRecording({
        ...editorRecording,
        categoryFilter: isActive ? allCategory : category,
        hasInteracted: !isActive,
        pageIndex: 0,
      });
    },
    setEditorRecordingHoveredBookmarkId: (id: string | null) => {
      setEditorRecording({ ...editorRecording, hoveredBookmarkId: id });
    },
    setEditorRecordingPageIndex: (
      pageIndex: number | ((currentPageIndex: number) => number),
    ) => {
      const nextPageIndex =
        typeof pageIndex === "function"
          ? pageIndex(editorRecording.pageIndex)
          : pageIndex;
      setEditorRecording({
        ...editorRecording,
        pageIndex: Math.max(0, nextPageIndex),
      });
    },
    setEditorRecordingSelectedBookmarkId: (id: string | null) => {
      setEditorRecording({ ...editorRecording, selectedBookmarkId: id });
    },
  };
  const createSnapshot = () => ({
    ...actions,
    editorRecording,
  });
  snapshot = createSnapshot();

  return {
    getSnapshot: () => snapshot,
    reset: () => {
      editorRecording = createInitialEditorRecording();
      snapshot = createSnapshot();
      listeners.clear();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
});
const assetRailMocks = vi.hoisted(() => ({
  props: [] as Array<{
    isHydrationEnabled?: boolean;
    scope: { game: string; league: string };
  }>,
}));
const bookmarkApiMocks = vi.hoisted(() => ({
  listRecording: vi.fn(),
}));
const timelineMocks = vi.hoisted(() => ({
  props: [] as Array<{
    bookmarks?: {
      hoveredBookmark: RecordingBookmark | null;
      markerBookmarks: RecordingBookmark[];
      pinnedBookmark?: RecordingBookmark | null;
      showBookmarkMarkers: boolean;
    };
  }>,
}));

vi.mock("~/renderer/store", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const { createPoeLeagueFixtureCatalog: createPoeLeagueTestCatalog } =
    await import("~/types/test-fixtures/poe-leagues");

  return {
    useBookmarksShallow: (selector: (bookmarks: unknown) => unknown) => {
      const bookmarks = React.useSyncExternalStore(
        bookmarkStoreMocks.subscribe,
        bookmarkStoreMocks.getSnapshot,
        bookmarkStoreMocks.getSnapshot,
      );

      return selector(bookmarks);
    },
    useEditorShallow: (selector: (editor: unknown) => unknown) => {
      const editor = React.useSyncExternalStore(
        subscribeEditorState,
        getEditorStateSnapshot,
        getEditorStateSnapshot,
      );

      return selector(editor);
    },
    usePoeLeaguesShallow: (selector: (value: unknown) => unknown) =>
      selector({
        byGame: createPoeLeagueTestCatalog(),
        errors: {},
        isFetchingByGame: { poe1: false, poe2: false },
      }),
    useSavedEditsShallow: storeMocks.useSavedEditsShallow,
    useSettingsShallow: (selector: (settings: unknown) => unknown) =>
      storeMocks.useSettingsSelector((settings: unknown) =>
        selector({
          ...(settings as object),
          preferenceErrors: {},
          updatePreference: vi.fn(),
        }),
      ),
    useSettingsSelector: storeMocks.useSettingsSelector,
  };
});

vi.mock("../../Editor.components/EditorAssetRail/EditorAssetRail", () => ({
  EditorAssetRail: (props: {
    isHydrationEnabled?: boolean;
    scope: { game: string; league: string };
  }) => {
    assetRailMocks.props.push(props);

    return (
      <div
        data-hydration-enabled={String(props.isHydrationEnabled)}
        data-testid="asset-rail"
      />
    );
  },
}));
vi.mock("../../Editor.components/EditorActionsMenu/EditorActionsMenu", () => ({
  EditorActionsMenu: () => (
    <>
      <button type="button" onClick={() => toggleEditorSidePanel("bookmarks")}>
        Toggle bookmarks
      </button>
      <button type="button" onClick={() => toggleEditorSidePanel("history")}>
        Toggle history
      </button>
      <button type="button" onClick={() => toggleEditorSidePanel("shortcuts")}>
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
  EditorHistoryRail: () => (
    <div data-testid="history-rail">
      <button type="button" onClick={closeEditorSidePanel}>
        Close history
      </button>
    </div>
  ),
}));
vi.mock(
  "../../Editor.components/EditorShortcutsRail/EditorShortcutsRail",
  () => ({
    EditorShortcutsRail: () => (
      <div data-testid="shortcuts-rail">
        <button type="button" onClick={closeEditorSidePanel}>
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
  EditorTimeline: (props: {
    bookmarks?: {
      hoveredBookmark: RecordingBookmark | null;
      markerBookmarks: RecordingBookmark[];
      pinnedBookmark?: RecordingBookmark | null;
      showBookmarkMarkers: boolean;
    };
  }) => {
    timelineMocks.props.push(props);

    return (
      <div
        data-show-bookmark-markers={String(
          props.bookmarks?.showBookmarkMarkers ?? false,
        )}
        data-timeline-bookmark-id={
          props.bookmarks?.pinnedBookmark?.id ??
          props.bookmarks?.hoveredBookmark?.id ??
          ""
        }
        data-testid="timeline"
      />
    );
  },
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

const recordingBookmark = createEditorTestRecordingBookmark({
  id: "bookmark-map",
});

const trimmedOverlapBookmark = createEditorTestRecordingBookmark({
  durationSeconds: 6,
  id: "bookmark-overlap",
  label: "Caer Blaidd",
  occurredAt: "2026-07-03T10:02:00.000Z",
  offsetSeconds: 7,
  sceneName: "Caer Blaidd",
});
const trimmedBeforeBookmark = createEditorTestRecordingBookmark({
  category: "hideout",
  durationSeconds: 4,
  id: "bookmark-before-trim",
  label: "Atlas Hideout",
  occurredAt: "2026-07-03T10:03:00.000Z",
  offsetSeconds: 0,
  sceneName: "Atlas Hideout",
});
const trimmedAfterBookmark = createEditorTestRecordingBookmark({
  durationSeconds: 3,
  id: "bookmark-after-trim",
  label: "The Well of Souls",
  occurredAt: "2026-07-03T10:01:00.000Z",
  offsetSeconds: 22,
  sceneName: "The Well of Souls",
});
const trimmedManualBookmark = createEditorTestRecordingBookmark({
  category: "manual",
  durationSeconds: null,
  id: "bookmark-manual-visible",
  label: "Manual bookmark",
  occurredAt: "2026-07-03T10:04:00.000Z",
  offsetSeconds: 17,
  sceneName: null,
});
const trimmedDeathBookmark = createEditorTestRecordingBookmark({
  category: "death",
  durationSeconds: null,
  id: "bookmark-death-visible",
  label: "Death bookmark",
  occurredAt: "2026-07-03T10:05:00.000Z",
  offsetSeconds: 12,
  sceneName: "Death at Shrine",
});

const recordingProject: EditorProject = {
  ...project,
  activeClipId: "timeline-recording",
  assets: [
    {
      assetKey: "recording:recording-1",
      category: "recording",
      createdAt: "2026-06-18T00:00:00.000Z",
      durationSeconds: 20,
      exists: true,
      id: "recording-1",
      kind: "recording",
      mediaUrl: "hinekora-media://run-recording/recording-1",
      name: "recording-1.mp4",
      sizeBytes: 1024,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      status: "ready",
      subtitle: "Run recording - Standard",
    },
  ],
  durationSeconds: 18,
  selectedAssetKey: "recording:recording-1",
  tracks: [
    {
      clips: [
        {
          assetKey: "recording:recording-1",
          color: "secondary",
          durationSeconds: 8,
          id: "timeline-recording",
          inSeconds: 3,
          mediaUrl: "hinekora-media://run-recording/recording-1",
          name: "recording-1.mp4",
          outSeconds: 11,
          playbackRate: 1,
          sourceInSeconds: 0,
          sourceOutSeconds: 20,
          startSeconds: 10,
          trackId: "video-track",
        },
      ],
      id: "video-track",
      kind: "video",
      label: "Video",
    },
  ],
};

const trimmedRecordingProject: EditorProject = {
  ...recordingProject,
  durationSeconds: 10,
  tracks: [
    {
      clips: [
        {
          assetKey: "recording:recording-1",
          color: "secondary",
          durationSeconds: 10,
          id: "timeline-recording",
          inSeconds: 10,
          mediaUrl: "hinekora-media://run-recording/recording-1",
          name: "recording-1.mp4",
          outSeconds: 20,
          playbackRate: 1,
          sourceInSeconds: 0,
          sourceOutSeconds: 30,
          startSeconds: 30,
          trackId: "video-track",
        },
      ],
      id: "video-track",
      kind: "video",
      label: "Video",
    },
  ],
};

const secondRecordingProject: EditorProject = {
  ...recordingProject,
  activeClipId: "timeline-recording-2",
  assets: [
    {
      assetKey: "recording:recording-2",
      category: "recording",
      createdAt: "2026-06-18T00:00:00.000Z",
      durationSeconds: 20,
      exists: true,
      id: "recording-2",
      kind: "recording",
      mediaUrl: "hinekora-media://run-recording/recording-2",
      name: "recording-2.mp4",
      sizeBytes: 1024,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      status: "ready",
      subtitle: "Run recording - Standard",
    },
  ],
  selectedAssetKey: "recording:recording-2",
  tracks: [
    {
      clips: [
        {
          assetKey: "recording:recording-2",
          color: "secondary",
          durationSeconds: 12,
          id: "timeline-recording-2",
          inSeconds: 0,
          mediaUrl: "hinekora-media://run-recording/recording-2",
          name: "recording-2.mp4",
          outSeconds: 12,
          playbackRate: 1,
          sourceInSeconds: 0,
          sourceOutSeconds: 20,
          startSeconds: 20,
          trackId: "video-track",
        },
      ],
      id: "video-track",
      kind: "video",
      label: "Video",
    },
  ],
};

let container: HTMLDivElement;
let root: Root;
let editorState: Record<string, unknown>;
const editorStateListeners = new Set<() => void>();
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
    closeSidePanel: closeEditorSidePanel,
    copyProjectToClipboard: storeMocks.copyProjectToClipboard,
    createProject: storeMocks.createProject,
    error: null,
    exportState: {
      dismissedNoticeIds: [],
      fileName: null,
      result: null,
      status: "idle",
    },
    hoveredTimelineGap: null,
    hydrate: storeMocks.hydrate,
    isLoading: false,
    mediaFilter: "death-clip",
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
    setMediaFilter: storeMocks.setMediaFilter,
    setPlaybackSeconds: storeMocks.setPlaybackSeconds,
    splitTimelineClipAt: storeMocks.splitTimelineClipAt,
    toggleProjectAudioMuted: storeMocks.toggleProjectAudioMuted,
    toggleSidePanel: toggleEditorSidePanel,
    undoProjectChange: storeMocks.undoProjectChange,
    visibleSidePanel: null,
    workspace: {
      assets: project.assets,
      hasMoreProjects: false,
      project,
      projects: [],
    },
    ...overrides,
  };
}

function closeEditorSidePanel(): void {
  updateEditorState({ visibleSidePanel: null });
}

function getEditorStateSnapshot(): Record<string, unknown> {
  return editorState;
}

function subscribeEditorState(listener: () => void): () => void {
  editorStateListeners.add(listener);

  return () => {
    editorStateListeners.delete(listener);
  };
}

function toggleEditorSidePanel(
  panel: "bookmarks" | "history" | "shortcuts",
): void {
  updateEditorState({
    visibleSidePanel: editorState.visibleSidePanel === panel ? null : panel,
  });
}

function updateEditorState(update: Record<string, unknown>): void {
  editorState = { ...editorState, ...update };
  for (const listener of editorStateListeners) {
    listener();
  }
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
    storeMocks.setMediaFilter.mockImplementation((filter) => {
      updateEditorState({ mediaFilter: filter });
    });
    configureEditorState();
    assetRailMocks.props = [];
    bookmarkStoreMocks.reset();
    timelineMocks.props = [];
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
    bookmarkApiMocks.listRecording.mockResolvedValue({
      availableCategories: ["map"],
      items: [recordingBookmark],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      timelineItems: [recordingBookmark],
      timelineItemsTruncated: false,
      totalCount: 1,
    });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        bookmarks: {
          listRecording: bookmarkApiMocks.listRecording,
        },
      } as unknown as Window["electron"],
    });
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

  it("opens recording bookmarks with Ctrl+B and seeks the mapped timeline time", async () => {
    configureEditorState({
      project: recordingProject,
      selectedClipId: "timeline-recording",
    });
    await renderEditorPage();

    expect(bookmarkApiMocks.listRecording).not.toHaveBeenCalled();

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "b",
        }),
      );
    });

    await vi.waitFor(() => {
      expect(bookmarkApiMocks.listRecording).toHaveBeenCalledWith(
        "recording-1",
        {
          includeTimeline: true,
          pageIndex: 0,
          pageSize: 5,
        },
      );
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Qimah Reservoir");
    });

    const bookmarkButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Qimah Reservoir"));
    await act(async () => {
      bookmarkButton?.dispatchEvent(
        new MouseEvent("pointerover", { bubbles: true }),
      );
      bookmarkButton?.click();
      bookmarkButton?.dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true }),
      );
    });

    expect(storeMocks.setPlaybackSeconds).toHaveBeenCalledWith(14);
    expect(
      container
        .querySelector("[data-testid='timeline']")
        ?.getAttribute("data-timeline-bookmark-id"),
    ).toBe("bookmark-map");
  });

  it("toggles editor bookmark category chips off when clicked again", async () => {
    configureEditorState({
      project: recordingProject,
      selectedClipId: "timeline-recording",
    });
    await renderEditorPage();

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "b",
        }),
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Qimah Reservoir");
    });
    expect(
      container
        .querySelector("[data-testid='timeline']")
        ?.getAttribute("data-show-bookmark-markers"),
    ).toBe("false");

    const findMapButton = () =>
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Map",
      );

    await act(async () => {
      findMapButton()?.click();
    });
    await vi.waitFor(() => {
      expect(
        container
          .querySelector("[data-testid='timeline']")
          ?.getAttribute("data-show-bookmark-markers"),
      ).toBe("true");
    });

    await act(async () => {
      findMapButton()?.click();
    });
    await vi.waitFor(() => {
      expect(
        container
          .querySelector("[data-testid='timeline']")
          ?.getAttribute("data-show-bookmark-markers"),
      ).toBe("false");
    });

    const bookmarkButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Qimah Reservoir"));

    await act(async () => {
      bookmarkButton?.click();
    });
    expect(
      container
        .querySelector("[data-testid='timeline']")
        ?.getAttribute("data-show-bookmark-markers"),
    ).toBe("false");
    expect(
      container
        .querySelector("[data-testid='timeline']")
        ?.getAttribute("data-timeline-bookmark-id"),
    ).toBe("bookmark-map");
  });

  it("clears the selected editor bookmark with Escape", async () => {
    configureEditorState({
      project: recordingProject,
      selectedClipId: "timeline-recording",
    });
    await renderEditorPage();

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "b",
        }),
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Qimah Reservoir");
    });

    const bookmarkButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Qimah Reservoir"));
    await act(async () => {
      bookmarkButton?.click();
    });

    await vi.waitFor(() => {
      expect(
        container
          .querySelector("[data-testid='timeline']")
          ?.getAttribute("data-timeline-bookmark-id"),
      ).toBe("bookmark-map");
    });

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Escape",
        }),
      );
    });

    expect(
      container
        .querySelector("[data-testid='timeline']")
        ?.getAttribute("data-timeline-bookmark-id"),
    ).toBe("");
  });

  it("filters editor bookmarks to the selected clip trim range", async () => {
    bookmarkApiMocks.listRecording.mockResolvedValue({
      availableCategories: ["death", "hideout", "manual", "map"],
      items: [
        trimmedBeforeBookmark,
        trimmedOverlapBookmark,
        trimmedAfterBookmark,
        trimmedManualBookmark,
        trimmedDeathBookmark,
      ],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      timelineItems: [
        trimmedBeforeBookmark,
        trimmedOverlapBookmark,
        trimmedAfterBookmark,
        trimmedManualBookmark,
        trimmedDeathBookmark,
      ],
      timelineItemsTruncated: false,
      totalCount: 5,
    });
    configureEditorState({
      project: trimmedRecordingProject,
      selectedClipId: "timeline-recording",
    });
    await renderEditorPage();

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "b",
        }),
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Caer Blaidd");
    });

    expect(container.textContent).toContain("Manual bookmark");
    expect(container.textContent).toContain("Death at Shrine");
    expect(container.textContent).not.toContain("Atlas Hideout");
    expect(container.textContent).not.toContain("The Well of Souls");
    expect(container.textContent).toContain("3 items");

    const bookmarkButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Caer Blaidd"));
    await act(async () => {
      bookmarkButton?.click();
    });

    expect(storeMocks.setPlaybackSeconds).toHaveBeenCalledWith(30);
    expect(
      container
        .querySelector("[data-testid='timeline']")
        ?.getAttribute("data-timeline-bookmark-id"),
    ).toBe("bookmark-overlap");
  });

  it("hides stale bookmark markers immediately when switching recordings", async () => {
    const secondBookmarksRequest = createDeferred<RecordingBookmarksPage>();
    bookmarkApiMocks.listRecording.mockImplementation((recordingId: string) => {
      if (recordingId === "recording-2") {
        return secondBookmarksRequest.promise;
      }

      return Promise.resolve({
        availableCategories: ["map"],
        items: [recordingBookmark],
        pageCount: 1,
        pageIndex: 0,
        pageSize: 5,
        timelineItems: [recordingBookmark],
        timelineItemsTruncated: false,
        totalCount: 1,
      });
    });
    configureEditorState({
      project: recordingProject,
      selectedClipId: "timeline-recording",
    });
    await renderEditorPage();

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "b",
        }),
      );
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Qimah Reservoir");
    });

    const mapButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Map",
    );
    await act(async () => {
      mapButton?.click();
    });
    await vi.waitFor(() => {
      expect(timelineMocks.props.at(-1)?.bookmarks).toMatchObject({
        markerBookmarks: [expect.objectContaining({ id: "bookmark-map" })],
        showBookmarkMarkers: true,
      });
    });

    const switchRenderStartIndex = timelineMocks.props.length;
    configureEditorState({
      project: secondRecordingProject,
      selectedClipId: "timeline-recording-2",
    });
    await renderEditorPage();

    const switchRenderBookmarkProps = timelineMocks.props
      .slice(switchRenderStartIndex)
      .map((props) => props.bookmarks);
    expect(switchRenderBookmarkProps.length).toBeGreaterThan(0);
    expect(
      switchRenderBookmarkProps.every(
        (bookmarks) =>
          bookmarks !== undefined &&
          bookmarks.showBookmarkMarkers === false &&
          bookmarks.hoveredBookmark === null &&
          bookmarks.markerBookmarks.length === 0,
      ),
    ).toBe(true);
    expect(container.textContent).not.toContain("Qimah Reservoir");

    secondBookmarksRequest.resolve({
      availableCategories: [],
      items: [],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      timelineItems: [],
      timelineItemsTruncated: false,
      totalCount: 0,
    });
    await act(async () => {
      await secondBookmarksRequest.promise;
    });
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

  it("reopens the exported project while recovering after a refresh", async () => {
    configureEditorState({
      exportState: {
        dismissedNoticeIds: [],
        fileName: "export.mp4",
        isViewOpen: true,
        projectId: "project-exporting",
        result: null,
        status: "exporting",
      },
      project: null,
    });

    await renderEditorPage();

    expect(storeMocks.openProject).toHaveBeenCalledWith("project-exporting");
    expect(storeMocks.hydrate).not.toHaveBeenCalled();
  });

  it("opens a saved edit from the editor route project id", async () => {
    await act(async () => {
      root.render(<EditorPage projectId="project-2" />);
    });

    expect(storeMocks.openProject).toHaveBeenCalledWith("project-2");
    expect(storeMocks.hydrate).not.toHaveBeenCalled();
  });

  it("does not open the same saved edit route twice while it is pending", async () => {
    const openProjectRequest = createDeferred<boolean>();
    storeMocks.openProject.mockReturnValue(openProjectRequest.promise);

    await act(async () => {
      root.render(<EditorPage projectId="project-2" />);
    });
    await act(async () => {
      root.render(<EditorPage projectId="project-2" />);
    });

    expect(storeMocks.openProject).toHaveBeenCalledTimes(1);

    openProjectRequest.resolve(true);
    await act(async () => {
      await openProjectRequest.promise;
    });
  });

  it("keeps asset rail hydration disabled until settings are ready", async () => {
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector({ value: null }),
    );
    configureEditorState({
      project: {
        ...project,
        id: "project-2",
      },
    });

    await act(async () => {
      root.render(<EditorPage projectId="project-2" />);
    });

    expect(
      container
        .querySelector("[data-testid='asset-rail']")
        ?.getAttribute("data-hydration-enabled"),
    ).toBe("false");
  });

  it("enables asset rail hydration when settings and the route are ready", async () => {
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector(settingsSlice),
    );
    configureEditorState({
      project: {
        ...project,
        id: "project-2",
      },
    });
    await act(async () => {
      root.render(<EditorPage projectId="project-2" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container
        .querySelector("[data-testid='asset-rail']")
        ?.getAttribute("data-hydration-enabled"),
    ).toBe("true");
    expect(assetRailMocks.props.at(-1)?.scope).toEqual({
      game: "poe2",
      league: "Runes of Aldur",
    });
  });

  it("applies the preferred media filter before enabling asset rail hydration", async () => {
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector({
        value: {
          ...settingsSlice.value,
          editorMediaFilter: "manual-replay",
        },
      }),
    );
    configureEditorState({
      mediaFilter: "death-clip",
      project: {
        ...project,
        id: "project-2",
      },
    });

    await act(async () => {
      root.render(<EditorPage projectId="project-2" />);
    });

    expect(
      assetRailMocks.props.some((props) => props.isHydrationEnabled === false),
    ).toBe(true);
    expect(storeMocks.setMediaFilter).toHaveBeenCalledWith("manual-replay");

    await act(async () => {
      root.render(<EditorPage projectId="project-2" />);
    });

    expect(assetRailMocks.props.at(-1)).toMatchObject({
      isHydrationEnabled: true,
      scope: {
        game: "poe2",
        league: "Runes of Aldur",
      },
    });
  });

  it("enables asset rail hydration after settings become ready on the mounted route", async () => {
    let currentSettings: typeof settingsSlice.value | null = null;
    function SettingsReadyHarness({ renderTick }: { renderTick: number }) {
      void renderTick;

      return <EditorPage projectId="project-2" />;
    }

    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector({ value: currentSettings }),
    );
    configureEditorState({
      project: {
        ...project,
        id: "project-2",
      },
    });

    await act(async () => {
      root.render(<SettingsReadyHarness renderTick={0} />);
    });
    const pendingSettingsRenderCount = assetRailMocks.props.length;
    expect(assetRailMocks.props.at(-1)?.isHydrationEnabled).toBe(false);

    currentSettings = settingsSlice.value;
    await act(async () => {
      root.render(<SettingsReadyHarness renderTick={1} />);
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(assetRailMocks.props.length).toBeGreaterThan(
        pendingSettingsRenderCount,
      );
    });

    expect(assetRailMocks.props.at(-1)).toMatchObject({
      isHydrationEnabled: true,
      scope: {
        game: "poe2",
        league: "Runes of Aldur",
      },
    });
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

  it("shows bookmarks in the right rail in place of history and shortcuts", async () => {
    configureEditorState({
      project: recordingProject,
      selectedClipId: "timeline-recording",
    });
    await renderEditorPage();

    const bookmarksButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Toggle bookmarks");
    await act(async () => {
      bookmarksButton?.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Qimah Reservoir");
    });
    expect(container.querySelector("[data-testid='history-rail']")).toBe(null);
    expect(container.querySelector("[data-testid='shortcuts-rail']")).toBe(
      null,
    );

    const closeButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Close bookmarks panel"]',
    );
    await act(async () => {
      closeButton?.click();
    });

    expect(container.textContent).not.toContain("Qimah Reservoir");
  });

  it("shows an empty bookmark rail when the selected edit has no recording source", async () => {
    await renderEditorPage();

    const bookmarksButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Toggle bookmarks");
    await act(async () => {
      bookmarksButton?.click();
    });

    expect(container.textContent).toContain(
      "Select a recording clip to show its bookmarks.",
    );
    expect(bookmarkApiMocks.listRecording).not.toHaveBeenCalled();
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
