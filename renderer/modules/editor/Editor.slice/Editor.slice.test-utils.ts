import { beforeEach, vi } from "vitest";

import type {
  EditorExportProgress,
  EditorExportResult,
  EditorMediaAsset,
  EditorProject,
  EditorTimelineClip,
} from "~/main/modules/editor";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createEditorSlice } from "./Editor.slice";

type EditorSliceTestStore = ReturnType<typeof createEditorSliceTestStore>;

function createEditorApiMock() {
  return {
    copyExport: vi.fn(),
    copyProjectToClipboard: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    exportProject: vi.fn(),
    getWorkspace: vi.fn(),
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

function setupEditorSliceTest() {
  let editorApi: ReturnType<typeof createEditorApiMock>;
  let progressTracker: ReturnType<typeof installEditorApiMock>;

  beforeEach(() => {
    vi.clearAllMocks();
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
  let exportProgressCallback:
    | ((progress: EditorExportProgress) => void)
    | null = null;
  let unsubscribeExportProgress = vi.fn();

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
    getExportProgressCallback: () => exportProgressCallback,
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

  return {
    activeClipId: clip.id,
    assets: [asset],
    createdAt: "2026-06-18T00:00:00.000Z",
    durationSeconds,
    id: "project-1",
    selectedAssetKey: asset.assetKey,
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
    sourceInSeconds: 0,
    sourceOutSeconds: asset.durationSeconds ?? 10,
    startSeconds: 0,
    trackId: "video-track",
    ...overrides,
  };
}

export {
  createEditorTestAsset,
  createEditorTestExportResult,
  createEditorTestProject,
  createEditorTestTimelineClip,
  loadEditorProject,
  setupEditorSliceTest,
};
