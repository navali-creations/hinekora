import { beforeEach, vi } from "vitest";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import type {
  EditorExportLifecycle,
  EditorExportLifecycleUpdate,
  EditorExportProgress,
  EditorExportResult,
  EditorMediaAsset,
  EditorProject,
  EditorTimelineClip,
} from "~/main/modules/editor";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { defaultEditorTimelinePlaybackRate } from "~/types";
import { createEditorSlice } from "./Editor.slice";

type EditorSliceTestStore = ReturnType<typeof createEditorSliceTestStore>;

function createEditorApiMock() {
  return {
    cancelExport: vi.fn(),
    copyExport: vi.fn(),
    copyProjectToClipboard: vi.fn(),
    createProject: vi.fn(),
    deleteAllProjects: vi.fn(),
    deleteProject: vi.fn(),
    dismissExport: vi.fn(),
    exportProject: vi.fn(),
    getExportLifecycle: vi.fn(),
    getWorkspace: vi.fn(),
    listMediaAssets: vi.fn(),
    onExportLifecycleChanged: vi.fn(),
    onExportProgress: vi.fn(),
    revealExport: vi.fn(),
    saveProject: vi.fn(),
  };
}

function createEditorSliceTestStore() {
  return createBoundStoreForTests((set, get, api) => {
    const editorSlice = createEditorSlice(set, get, api);

    return {
      ...editorSlice,
    } as BoundStore;
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function setupEditorSliceTest() {
  let editorApi: ReturnType<typeof createEditorApiMock>;
  let progressTracker: ReturnType<typeof installEditorApiMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    editorApi = createEditorApiMock();
    progressTracker = installEditorApiMock(editorApi);
  });

  return {
    createTestStore: createEditorSliceTestStore,
    getEditorApi: () => editorApi,
    getProgressTracker: () => progressTracker,
  };
}

function installEditorApiMock(
  editorApi: ReturnType<typeof createEditorApiMock>,
) {
  let exportLifecycleCallback:
    | ((lifecycle: EditorExportLifecycleUpdate) => void)
    | null = null;
  let exportProgressCallback:
    | ((progress: EditorExportProgress) => void)
    | null = null;
  let unsubscribeExportProgress = vi.fn();
  const unsubscribeExportLifecycle = vi.fn();

  editorApi.dismissExport.mockResolvedValue(undefined);
  editorApi.getExportLifecycle.mockResolvedValue(
    createEditorTestExportLifecycle(),
  );
  editorApi.onExportLifecycleChanged.mockImplementation((callback) => {
    exportLifecycleCallback = callback;

    return unsubscribeExportLifecycle;
  });
  editorApi.onExportProgress.mockImplementation((callback) => {
    exportProgressCallback = callback;

    return unsubscribeExportProgress;
  });
  editorApi.saveProject.mockImplementation(({ project }) =>
    Promise.resolve(project),
  );

  Object.defineProperty(window, "electron", {
    configurable: true,
    value: {
      editor: editorApi,
    },
  });

  return {
    getExportLifecycleCallback: () => exportLifecycleCallback,
    getExportProgressCallback: () => exportProgressCallback,
    getExportLifecycleUnsubscribe: () => unsubscribeExportLifecycle,
    setExportProgressUnsubscribe: (
      unsubscribe: typeof unsubscribeExportProgress,
    ) => {
      unsubscribeExportProgress = unsubscribe;
    },
  };
}

function loadEditorProject(
  store: EditorSliceTestStore,
  project: EditorProject,
  assets: EditorMediaAsset[] = project.assets,
  overrides: Partial<BoundStore["editor"]> = {},
) {
  store.setState((state) => ({
    editor: {
      ...state.editor,
      ...overrides,
      project,
      workspace: {
        assets,
        hasMoreProjects: false,
        project,
        projects: [],
      },
    },
  }));
}

function createEditorTestAsset(
  overrides: Partial<EditorMediaAsset> = {},
): EditorMediaAsset {
  return {
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
    ...overrides,
  };
}

function createEditorTestProject(
  asset: EditorMediaAsset = createEditorTestAsset(),
  overrides: Partial<EditorProject> = {},
): EditorProject {
  const durationSeconds = asset.durationSeconds ?? 10;
  const clip = createEditorTestTimelineClip(asset, {
    durationSeconds,
    outSeconds: durationSeconds,
  });
  const assets = overrides.assets ?? [asset];
  const firstAsset = assets[0] ?? asset;

  return {
    activeClipId: clip.id,
    assets,
    createdAt: "2026-06-18T00:00:00.000Z",
    durationSeconds,
    id: "project-1",
    selectedAssetKey: asset.assetKey,
    sourceGame: firstAsset.sourceGame,
    sourceLeague: firstAsset.sourceLeague,
    title: `${asset.name} edit`,
    tracks: [
      {
        clips: [clip],
        id: "video-track",
        kind: "video",
        label: "Video",
      },
    ],
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function createEditorTestExportResult(
  overrides: Partial<EditorExportResult> = {},
): EditorExportResult {
  return {
    createdAt: "2026-06-18T00:00:00.000Z",
    durationSeconds: 10,
    exportId: "export-1",
    fileName: "asset-1.mp4",
    mediaUrl: "hinekora-editor-export://export/export-1",
    mode: "new-file",
    resolution: "1080p",
    sizeBytes: 2048,
    ...overrides,
  };
}

function createEditorTestExportLifecycle(
  overrides: Partial<EditorExportLifecycle> = {},
): EditorExportLifecycle {
  return {
    canCancel: false,
    error: null,
    exportRequestId: null,
    fileName: null,
    previewClips: [],
    progress: 0,
    projectId: null,
    result: null,
    startedAt: null,
    status: "idle",
    ...overrides,
  };
}

function createEditorTestTimelineClip(
  asset: EditorMediaAsset = createEditorTestAsset(),
  overrides: Partial<EditorTimelineClip> = {},
): EditorTimelineClip {
  return {
    assetKey: asset.assetKey,
    color: "primary",
    durationSeconds: 5,
    id: "timeline-1",
    inSeconds: 0,
    mediaUrl: asset.mediaUrl,
    name: asset.name,
    outSeconds: 5,
    playbackRate: defaultEditorTimelinePlaybackRate,
    sourceInSeconds: 0,
    sourceOutSeconds: asset.durationSeconds ?? 10,
    startSeconds: 0,
    trackId: "video-track",
    ...overrides,
  };
}

function createEditorTestRecordingBookmark(
  overrides: Partial<RecordingBookmark> = {},
): RecordingBookmark {
  return {
    category: "map",
    createdAt: "2026-07-03T10:00:00.000Z",
    durationSeconds: 6,
    id: "bookmark-1",
    label: "Qimah Reservoir",
    note: null,
    occurredAt: "2026-07-03T10:00:05.000Z",
    offsetSeconds: 7,
    sceneName: "Qimah Reservoir",
    source: "client-log",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    subcategory: null,
    updatedAt: "2026-07-03T10:00:00.000Z",
    ...overrides,
  };
}

export {
  createDeferred,
  createEditorTestAsset,
  createEditorTestExportLifecycle,
  createEditorTestExportResult,
  createEditorTestProject,
  createEditorTestRecordingBookmark,
  createEditorTestTimelineClip,
  loadEditorProject,
  setupEditorSliceTest,
};
