import { existsSync } from "node:fs";
import {
  type link,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  type rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { app, shell } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import type { RunRecordingDetail } from "~/main/modules/recording-storage";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import type { ReplayClipSourceDetail } from "~/main/modules/replay-clips";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import { fetchLocalFileForTests } from "~/main/test/local-file-fetch";
import * as FileClipboard from "~/main/utils/file-clipboard";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import {
  createEditorMediaAsset,
  createEditorProject,
  createEditorTimelineClip,
  createEditorExportClipInput as createExportClip,
  createEditorExportInput as createExportInput,
  createEditorExportProject as createExportProject,
} from "./Editor.test-factories";

const electronMocks = vi.hoisted(() => ({
  getPath: vi.fn(() => process.cwd()),
  handleProtocol: vi.fn(),
  isProtocolHandled: vi.fn(() => false),
  netFetch: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: electronMocks.getPath,
  },
  net: {
    fetch: electronMocks.netFetch,
  },
  protocol: {
    handle: electronMocks.handleProtocol,
    isProtocolHandled: electronMocks.isProtocolHandled,
  },
  shell: {
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

import { EditorChannel } from "../Editor.channels";
import type {
  EditorCopyToClipboardInput,
  EditorExportClipInput,
  EditorExportInput,
  EditorProject,
  EditorWorkspace,
} from "../Editor.dto";
import type { EditorResolvedExportClip } from "../Editor.export";
import {
  renderEditorExportWithFfmpeg,
  resolveEditorFfmpegPath,
  runEditorFfmpeg,
} from "../Editor.ffmpeg";
import * as EditorFiles from "../Editor.files";
import { EditorService } from "../Editor.service";

const emptyProject: EditorProject = {
  activeClipId: null,
  assets: [],
  createdAt: "2026-06-12T10:00:00.000Z",
  durationSeconds: 0,
  id: "project-1",
  selectedAssetKey: null,
  title: "Untitled edit",
  tracks: [{ clips: [], id: "video-track", kind: "video", label: "Video" }],
  updatedAt: "2026-06-12T10:00:00.000Z",
};

const emptyWorkspace: EditorWorkspace = {
  assets: [],
  hasMoreProjects: false,
  project: emptyProject,
  projects: [],
};

function createResolvedExportClip(
  path: string,
  overrides: Partial<EditorResolvedExportClip> = {},
): EditorResolvedExportClip {
  return {
    durationSeconds: 1,
    inSeconds: 0,
    outSeconds: 1,
    playbackRate: 1,
    source: { path },
    startSeconds: 0,
    ...overrides,
  };
}

function createCopyToClipboardInput(
  overrides: {
    fileName?: string;
    project?: EditorCopyToClipboardInput["project"];
    resolution?: EditorCopyToClipboardInput["resolution"];
  } = {},
): EditorCopyToClipboardInput {
  return {
    fileName: overrides.fileName ?? "copy.mp4",
    project: overrides.project ?? createExportProject(),
    resolution: overrides.resolution ?? "720p",
  };
}

function createReplayClipDetail(
  overrides: Partial<ReplayClipSourceDetail["clip"]> = {},
): ReplayClipSourceDetail {
  const id = overrides.id ?? "clip-1";

  return {
    durationSeconds: overrides.targetDurationSeconds ?? 10,
    mediaUrl: `hinekora-media://replay-clip/${id}`,
    clip: {
      id,
      kind: "death",
      status: "ready",
      sourceGame: "poe2",
      sourceLeague: "Standard",
      deathTimestamp: "2026-06-12T10:00:00.000Z",
      triggerLineHash: "hash",
      originalObsPath: `C:\\Videos\\${id}.mp4`,
      processedClipPath: `C:\\Videos\\${id}.mp4`,
      targetDurationSeconds: 10,
      durationSeconds: overrides.durationSeconds ?? null,
      sizeBytes: 1024,
      error: null,
      createdAt: "2026-06-12T10:00:00.000Z",
      updatedAt: "2026-06-12T10:00:00.000Z",
      ...overrides,
    },
  };
}

function createRecordingDetail(
  overrides: Partial<RunRecordingDetail["recording"]> = {},
): RunRecordingDetail {
  const id = overrides.id ?? "recording-1";

  return {
    mediaUrl: `hinekora-media://run-recording/${id}`,
    recording: {
      id,
      path: `C:\\Videos\\${id}.mp4`,
      fileName: `${id}.mp4`,
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T09:00:00.000Z",
      stoppedAt: "2026-06-12T09:10:00.000Z",
      createdAt: "2026-06-12T09:10:00.000Z",
      updatedAt: "2026-06-12T09:10:00.000Z",
      durationSeconds: 600,
      sizeBytes: 2048,
      exists: true,
      ...overrides,
    },
  };
}

function mockEditorLibraries(
  input: {
    clips?: Record<string, ReplayClipSourceDetail | null>;
    editorAutoPruneProjects?: boolean;
    leakedIncludedClips?: ReplayClipSourceDetail[];
    recordings?: Record<string, RunRecordingDetail | null>;
    storageRoot?: string | null;
  } = {},
) {
  const clipDetails = Object.values(input.clips ?? {}).filter(
    (detail): detail is ReplayClipSourceDetail => detail !== null,
  );
  const recordingItems = Object.values(input.recordings ?? {})
    .filter((detail): detail is RunRecordingDetail => detail !== null)
    .map((detail) => detail.recording);

  vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
    getClip: (id: string) => input.clips?.[id] ?? null,
    listEditorReplayDetailPage: (query: {
      createdAfter?: string;
      excludeIds?: string[];
      game?: "poe1" | "poe2";
      includeIds?: string[];
      kind: "death" | "manual";
      league?: string;
      pageIndex: number;
      pageSize: number;
    }) => {
      const offset = query.pageIndex * query.pageSize;
      const items = clipDetails.filter(
        (detail) =>
          detail.clip.kind === query.kind &&
          (!query.createdAfter ||
            Date.parse(detail.clip.createdAt) >=
              Date.parse(query.createdAfter)) &&
          !query.excludeIds?.includes(detail.clip.id) &&
          (!query.game || detail.clip.sourceGame === query.game) &&
          (!query.includeIds || query.includeIds.includes(detail.clip.id)) &&
          (!query.league || detail.clip.sourceLeague === query.league),
      );
      const pageItems =
        query.includeIds && input.leakedIncludedClips
          ? [...items, ...input.leakedIncludedClips]
          : items;

      return {
        items: pageItems.slice(offset, offset + query.pageSize),
        totalCount: pageItems.length,
      };
    },
  } as unknown as ReplayClipsService);
  vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
    getRecording: (id: string) => input.recordings?.[id] ?? null,
    getRecordingMediaPath: (id: string) =>
      input.recordings?.[id]?.recording.path ?? null,
    listEditorRecordingDetailPage: (query: {
      createdAfter?: string;
      excludeIds?: string[];
      game?: "poe1" | "poe2";
      includeIds?: string[];
      league?: string;
      pageIndex: number;
      pageSize: number;
    }) => {
      const offset = query.pageIndex * query.pageSize;
      const items = recordingItems.filter(
        (recording) =>
          (!query.createdAfter ||
            Date.parse(recording.createdAt) >=
              Date.parse(query.createdAfter)) &&
          !query.excludeIds?.includes(recording.id) &&
          (!query.game || recording.sourceGame === query.game) &&
          (!query.includeIds || query.includeIds.includes(recording.id)) &&
          (!query.league || recording.sourceLeague === query.league),
      );

      return {
        items: items
          .slice(offset, offset + query.pageSize)
          .map((recording) => ({
            mediaUrl: `hinekora-media://run-recording/${recording.id}`,
            recording,
          })),
        totalCount: items.length,
      };
    },
  } as unknown as RecordingStorageService);
  vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
    get: () => ({
      editorAutoPruneProjects: input.editorAutoPruneProjects ?? false,
      recordingStoragePath: input.storageRoot ?? null,
    }),
  } as unknown as SettingsStoreService);
}

describe("EditorService IPC", () => {
  beforeEach(() => {
    DatabaseService.resetForTests();
    clearIpcWindowRolesForTests();
    electronMocks.getPath.mockImplementation(() => process.cwd());
    electronMocks.handleProtocol.mockClear();
    electronMocks.isProtocolHandled.mockReset();
    electronMocks.isProtocolHandled.mockReturnValue(false);
    electronMocks.netFetch.mockReset();
    electronMocks.netFetch.mockImplementation(fetchLocalFileForTests);
    electronMocks.showItemInFolder.mockClear();
  });

  afterEach(() => {
    DatabaseService.resetForTests();
  });

  it("returns and resets the singleton instance", () => {
    EditorService.resetForTests();
    const first = EditorService.getInstance();
    const second = EditorService.getInstance();

    EditorService.resetForTests();

    expect(second).toBe(first);
    expect(EditorService.getInstance()).not.toBe(first);
  });

  it("cleans abandoned export artifacts without blocking startup", async () => {
    const recordingStoragePath = join(process.cwd(), "custom-recordings");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({ recordingStoragePath }),
    } as unknown as SettingsStoreService);
    const cleanup = vi
      .spyOn(EditorFiles, "cleanupAbandonedEditorExportFiles")
      .mockResolvedValueOnce({ failedCount: 1, removedCount: 2 })
      .mockResolvedValueOnce({ failedCount: 0, removedCount: 0 })
      .mockRejectedValueOnce(new Error("cleanup unavailable"));

    await expect(
      EditorService.cleanupAbandonedExports(),
    ).resolves.toBeUndefined();
    await expect(
      EditorService.cleanupAbandonedExports(),
    ).resolves.toBeUndefined();
    await expect(
      EditorService.cleanupAbandonedExports(),
    ).resolves.toBeUndefined();

    expect(cleanup).toHaveBeenCalledTimes(3);
    expect(cleanup).toHaveBeenCalledWith([process.cwd(), recordingStoragePath]);
  });

  it("does not register an export media protocol twice and logs registration failures", async () => {
    electronMocks.isProtocolHandled.mockReturnValueOnce(true);
    new EditorService();
    expect(electronMocks.handleProtocol).not.toHaveBeenCalled();

    electronMocks.handleProtocol.mockClear();
    new EditorService();
    const protocolHandler = electronMocks.handleProtocol.mock.calls[0]?.[1] as
      | ((request: Request) => Promise<Response>)
      | undefined;
    expect(
      (await protocolHandler?.(new Request("hinekora-editor-export://export/")))
        ?.status,
    ).toBe(404);

    electronMocks.isProtocolHandled.mockImplementationOnce(() => {
      throw new Error("protocol failed");
    });
    new EditorService();
  });

  it("registers guarded handlers with runtime validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    const service = new EditorService();
    vi.spyOn(service, "getWorkspace").mockReturnValue(emptyWorkspace);
    vi.spyOn(service, "listMediaAssets").mockResolvedValue({
      items: [],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      totalCount: 0,
    });
    vi.spyOn(service, "createProject").mockReturnValue(emptyProject);
    vi.spyOn(service, "cancelExport").mockResolvedValue({ cancelled: true });
    vi.spyOn(service, "deleteAllProjects").mockReturnValue(emptyWorkspace);
    vi.spyOn(service, "deleteProject").mockReturnValue(emptyWorkspace);
    vi.spyOn(service, "saveProject").mockReturnValue(emptyProject);

    expect(await handlers.get(EditorChannel.GetWorkspace)?.({})).toEqual(
      emptyWorkspace,
    );
    expect(
      await handlers.get(EditorChannel.GetWorkspace)?.(
        {},
        { source: { kind: "clip", id: "clip-1" } },
      ),
    ).toEqual(emptyWorkspace);
    expect(
      await handlers.get(EditorChannel.CreateProject)?.(
        {},
        {
          assetKeys: ["clip:clip-1"],
          source: { kind: "recording", id: "recording-1" },
          title: "Boss run edit",
        },
      ),
    ).toEqual(emptyProject);
    expect(service.getWorkspace).toHaveBeenCalledWith({
      source: { kind: "clip", id: "clip-1" },
    });
    expect(
      await handlers.get(EditorChannel.ListMediaAssets)?.(
        {},
        {
          category: "death-clip",
          game: "poe2",
          league: "Standard",
          pageIndex: 0,
          pageSize: 5,
        },
      ),
    ).toEqual({
      items: [],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      totalCount: 0,
    });
    expect(service.listMediaAssets).toHaveBeenCalledWith({
      category: "death-clip",
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
    });
    expect(service.createProject).toHaveBeenCalledWith({
      assetKeys: ["clip:clip-1"],
      source: { kind: "recording", id: "recording-1" },
      title: "Boss run edit",
    });
    expect(
      await handlers.get(EditorChannel.DeleteProject)?.({}, "project-1"),
    ).toEqual(emptyWorkspace);
    expect(service.deleteProject).toHaveBeenCalledWith("project-1");
    expect(await handlers.get(EditorChannel.DeleteAllProjects)?.({})).toEqual(
      emptyWorkspace,
    );
    expect(service.deleteAllProjects).toHaveBeenCalledTimes(1);
    expect(
      await handlers.get(EditorChannel.SaveProject)?.(
        {},
        { project: emptyProject },
      ),
    ).toEqual(emptyProject);
    expect(service.saveProject).toHaveBeenCalledWith({ project: emptyProject });
    expect(
      await handlers.get(EditorChannel.CancelExport)?.(
        {},
        { exportRequestId: "export-request-1" },
      ),
    ).toEqual({ cancelled: true });
    expect(service.cancelExport).toHaveBeenCalledWith({
      exportRequestId: "export-request-1",
    });

    expect(
      await handlers.get(EditorChannel.GetWorkspace)?.({}, { projectId: "" }),
    ).toEqual({ ok: false, error: "project id is too short" });
    expect(
      await handlers.get(EditorChannel.GetWorkspace)?.(
        {},
        { source: { kind: "boss", id: "clip-1" } },
      ),
    ).toEqual({ ok: false, error: "media kind is invalid" });
    expect(
      await handlers.get(EditorChannel.GetWorkspace)?.(
        {},
        { source: { kind: "clip", id: "" } },
      ),
    ).toEqual({ ok: false, error: "media id is too short" });
    expect(
      await handlers.get(EditorChannel.ListMediaAssets)?.(
        {},
        { category: "saved-edits", game: "poe2" },
      ),
    ).toEqual({ ok: false, error: "asset category is invalid" });
    expect(
      await handlers.get(EditorChannel.ListMediaAssets)?.(
        {},
        { category: "death-clip", game: "poe3" },
      ),
    ).toEqual({ ok: false, error: "asset source game is invalid" });
    expect(
      await handlers.get(EditorChannel.ListMediaAssets)?.(
        {},
        { category: "death-clip", game: "poe2", pageSize: 51 },
      ),
    ).toEqual({ ok: false, error: "page size is too large" });
    expect(
      await handlers.get(EditorChannel.CreateProject)?.(
        {},
        { assetKeys: "clip:clip-1" },
      ),
    ).toEqual({ ok: false, error: "asset keys must be an array" });
    expect(
      await handlers.get(EditorChannel.CreateProject)?.(
        {},
        {
          assetKeys: Array.from({ length: 101 }, (_, index) => `clip:${index}`),
        },
      ),
    ).toEqual({ ok: false, error: "asset keys is too large" });
    expect(
      await handlers.get(EditorChannel.CreateProject)?.(
        {},
        { assetKeys: [""] },
      ),
    ).toEqual({ ok: false, error: "asset key is too short" });
    expect(
      await handlers.get(EditorChannel.CreateProject)?.({}, { title: "" }),
    ).toEqual({ ok: false, error: "title is too short" });
    expect(await handlers.get(EditorChannel.DeleteProject)?.({}, "")).toEqual({
      ok: false,
      error: "project id is too short",
    });
    expect(
      await handlers.get(EditorChannel.SaveProject)?.(
        {},
        { project: { ...emptyProject, title: "" } },
      ),
    ).toEqual({ ok: false, error: "project title is too short" });
    expect(await handlers.get(EditorChannel.CopyExport)?.({}, "")).toEqual({
      ok: false,
      error: "export id is too short",
    });
    expect(await handlers.get(EditorChannel.CancelExport)?.({}, null)).toEqual({
      ok: false,
      error: "editor cancel export input must be an object",
    });
    expect(await handlers.get(EditorChannel.RevealExport)?.({}, "")).toEqual({
      ok: false,
      error: "export id is too short",
    });
  });

  it("builds workspaces from clips and recordings", async () => {
    mockEditorLibraries({
      clips: {
        "clip-death": createReplayClipDetail({
          createdAt: "2026-06-12T10:00:00.000Z",
          id: "clip-death",
          kind: "death",
        }),
        "clip-manual": createReplayClipDetail({
          createdAt: "2026-06-12T11:00:00.000Z",
          id: "clip-manual",
          kind: "manual",
        }),
      },
      leakedIncludedClips: [
        createReplayClipDetail({
          id: "clip-manual-extra",
          kind: "manual",
        }),
        createReplayClipDetail({
          id: "clip-manual-unordered",
          kind: "manual",
        }),
      ],
      recordings: {
        "recording-1": createRecordingDetail({
          createdAt: "2026-06-12T09:00:00.000Z",
          durationSeconds: null,
          id: "recording-1",
        }),
      },
    });
    const service = new EditorService();

    const workspace = service.getWorkspace();
    const sourceWorkspace = service.getWorkspace({
      source: { id: "clip-death", kind: "clip" },
    });
    const selectedProject = service.createProject({
      assetKeys: ["clip:clip-manual", "recording:recording-1"],
      title: "Custom edit",
    });
    const sourceProject = service.createProject({
      source: { id: "clip-death", kind: "clip" },
    });
    const missingSourceProject = service.createProject({
      source: { id: "missing", kind: "clip" },
    });
    const missingRecordingSourceProject = service.createProject({
      source: { id: "missing", kind: "recording" },
    });
    const missingAssetKeysProject = service.createProject({
      assetKeys: ["clip:missing"],
    });

    const deathAssets = await service.listMediaAssets({
      category: "death-clip",
      game: "poe2",
      pageSize: 5,
    });
    const manualAssets = await service.listMediaAssets({
      category: "manual-replay",
      game: "poe2",
      pageSize: 5,
    });
    const recordingAssets = await service.listMediaAssets({
      category: "recording",
      game: "poe1",
      pageSize: 5,
    });
    const scopedDeathAssets = await service.listMediaAssets({
      category: "death-clip",
      game: "poe2",
      league: "Standard",
      pageSize: 5,
    });
    const scopedRecordingAssets = await service.listMediaAssets({
      category: "recording",
      game: "poe1",
      league: "Standard",
      pageSize: 5,
    });
    const defaultSizedAssets = await service.listMediaAssets({
      category: "death-clip",
      game: "poe2",
    });
    const includedTimelineAssets = await service.listMediaAssets({
      category: "manual-replay",
      game: "poe2",
      includeAssetKeys: [
        "clip:clip-manual",
        "clip:clip-manual",
        "clip:clip-manual-missing",
        "clip:clip-manual-missing-again",
        "recording:recording-1",
      ],
      league: "Different League",
      pageSize: 5,
    });
    const includedRecordingAssets = await service.listMediaAssets({
      category: "recording",
      game: "poe2",
      includeAssetKeys: ["clip:clip-manual", "recording:recording-1"],
      pageSize: 5,
    });
    const emptyIncludedRecordingAssets = await service.listMediaAssets({
      category: "recording",
      game: "poe2",
      includeAssetKeys: ["clip:clip-manual"],
      pageSize: 5,
    });
    const excludedDeathAssets = await service.listMediaAssets({
      category: "death-clip",
      excludeAssetKeys: [
        "bad-key",
        "clip:clip-death",
        "clip:clip-death",
        "recording:recording-1",
        "recording:recording-1",
      ],
      game: "poe2",
      pageSize: 5,
    });
    const recentDeathAssets = await service.listMediaAssets({
      category: "death-clip",
      createdAfter: "2026-06-12T09:30:00.000Z",
      game: "poe2",
      pageSize: 5,
    });
    const recentRecordingAssets = await service.listMediaAssets({
      category: "recording",
      createdAfter: "2026-06-12T08:30:00.000Z",
      game: "poe1",
      pageSize: 5,
    });

    expect(workspace.assets).toEqual([]);
    expect(deathAssets.items.map((asset) => asset.assetKey)).toEqual([
      "clip:clip-death",
    ]);
    expect(manualAssets.items.map((asset) => asset.assetKey)).toEqual([
      "clip:clip-manual",
    ]);
    expect(recordingAssets.items.map((asset) => asset.assetKey)).toEqual([
      "recording:recording-1",
    ]);
    expect(scopedDeathAssets.items.map((asset) => asset.assetKey)).toEqual([
      "clip:clip-death",
    ]);
    expect(scopedRecordingAssets.items.map((asset) => asset.assetKey)).toEqual([
      "recording:recording-1",
    ]);
    expect(defaultSizedAssets.pageSize).toBe(5);
    expect(defaultSizedAssets.items.map((asset) => asset.assetKey)).toEqual([
      "clip:clip-death",
    ]);
    expect(includedTimelineAssets.items.map((asset) => asset.assetKey)).toEqual(
      [
        "clip:clip-manual",
        "clip:clip-manual-extra",
        "clip:clip-manual-unordered",
      ],
    );
    expect(
      includedRecordingAssets.items.map((asset) => asset.assetKey),
    ).toEqual(["recording:recording-1"]);
    expect(emptyIncludedRecordingAssets.items).toEqual([]);
    expect(emptyIncludedRecordingAssets.totalCount).toBe(0);
    expect(excludedDeathAssets.items).toEqual([]);
    expect(recentDeathAssets.items.map((asset) => asset.assetKey)).toEqual([
      "clip:clip-death",
    ]);
    expect(recentRecordingAssets.items.map((asset) => asset.assetKey)).toEqual([
      "recording:recording-1",
    ]);
    expect(workspace.project.assets).toEqual([]);
    expect(workspace.projects).toEqual([]);
    expect(
      sourceWorkspace.project.assets.map((asset) => asset.assetKey),
    ).toEqual(["clip:clip-death"]);
    expect(selectedProject.title).toBe("Custom edit");
    expect(selectedProject.assets.map((asset) => asset.assetKey)).toEqual([
      "clip:clip-manual",
      "recording:recording-1",
    ]);
    expect(sourceProject.assets.map((asset) => asset.assetKey)).toEqual([
      "clip:clip-death",
    ]);
    expect(missingSourceProject.assets).toEqual([]);
    expect(missingRecordingSourceProject.assets).toEqual([]);
    expect(missingAssetKeysProject.assets).toEqual([]);
  });

  it("saves, lists, and reopens editor projects", () => {
    const clip = createReplayClipDetail({
      id: "clip-1",
      processedClipPath: "C:\\Videos\\clip-1.mp4",
    });
    mockEditorLibraries({
      clips: {
        "clip-1": clip,
      },
    });
    const service = new EditorService();
    const project = createEditorProject({
      id: "saved-project",
      title: "Saved edit",
      updatedAt: "2026-06-18T00:00:00.000Z",
    });

    const savedProject = service.saveProject({ project });
    const workspace = service.getWorkspace({ projectId: savedProject.id });

    expect(savedProject).toMatchObject({
      id: "saved-project",
      title: "Saved edit",
    });
    expect(savedProject.updatedAt).not.toBe(project.updatedAt);
    expect(workspace.project).toMatchObject({
      id: "saved-project",
      title: "Saved edit",
    });
    expect(workspace.project.assets[0]).toMatchObject({
      assetKey: "clip:clip-1",
      mediaUrl: "hinekora-media://replay-clip/clip-1",
      name: "clip-1.mp4",
    });
    expect(workspace.project.tracks[0]?.clips[0]).toMatchObject({
      mediaUrl: "hinekora-media://replay-clip/clip-1",
      name: "clip-1.mp4",
    });
    expect(workspace.projects).toEqual([
      {
        clipCount: 1,
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 10,
        id: "saved-project",
        title: "Saved edit",
        updatedAt: savedProject.updatedAt,
      },
    ]);

    const resetWorkspace = service.deleteProject(savedProject.id);
    expect(resetWorkspace.projects).toEqual([]);
    expect(resetWorkspace.project).toMatchObject({
      assets: [],
      durationSeconds: 0,
      title: "Untitled edit",
    });

    const staleAsset = createEditorMediaAsset({
      assetKey: "clip:stale",
      id: "stale",
      mediaUrl: "hinekora-media://replay-clip/stale",
      name: "stale.mp4",
    });
    const staleClip = createEditorTimelineClip(staleAsset, {
      id: "timeline-stale",
    });
    const staleProject = createEditorProject({
      activeClipId: staleClip.id,
      assets: [staleAsset],
      id: "stale-project",
      selectedAssetKey: staleAsset.assetKey,
      tracks: [
        {
          clips: [staleClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });

    service.saveProject({ project: staleProject });

    expect(
      service.getWorkspace({ projectId: staleProject.id }).project.tracks[0]
        ?.clips[0],
    ).toMatchObject({
      assetKey: staleAsset.assetKey,
      mediaUrl: staleAsset.mediaUrl,
      name: staleAsset.name,
    });

    expect(
      service.createProject({
        assetKeys: ["malformed", "unknown:source"],
      }).assets,
    ).toEqual([]);

    expect(
      service.getWorkspace({ projectId: "missing-project" }).project,
    ).toMatchObject({
      assets: [],
      durationSeconds: 0,
      title: "Untitled edit",
    });
  });

  it("normalizes timeline clip order and overlaps before persisting projects", () => {
    const source = createReplayClipDetail({
      id: "clip-1",
      processedClipPath: "C:\\Videos\\clip-1.mp4",
    });
    mockEditorLibraries({
      clips: {
        "clip-1": source,
      },
    });
    const asset = createEditorMediaAsset();
    const earlyClip = createEditorTimelineClip(asset, {
      durationSeconds: 2,
      id: "timeline-a",
      outSeconds: 2,
      startSeconds: 0,
    });
    const overlappingClip = createEditorTimelineClip(asset, {
      durationSeconds: 2,
      id: "timeline-b",
      outSeconds: 2,
      startSeconds: 1,
    });
    const lateClip = createEditorTimelineClip(asset, {
      durationSeconds: 1,
      id: "timeline-c",
      outSeconds: 1,
      startSeconds: 4,
    });
    const project = createEditorProject({
      durationSeconds: 4,
      id: "normalized-project",
      tracks: [
        {
          clips: [lateClip, overlappingClip, earlyClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    const service = new EditorService();

    const savedProject = service.saveProject({ project });
    const savedClips = savedProject.tracks[0]?.clips ?? [];
    const reopenedClips =
      service.getWorkspace({ projectId: savedProject.id }).project.tracks[0]
        ?.clips ?? [];

    expect(
      savedClips.map((clip) => ({
        id: clip.id,
        startSeconds: clip.startSeconds,
      })),
    ).toEqual([
      { id: "timeline-a", startSeconds: 0 },
      { id: "timeline-b", startSeconds: 2 },
      { id: "timeline-c", startSeconds: 4 },
    ]);
    expect(savedProject.durationSeconds).toBe(5);
    expect(savedProject.activeClipId).toBeNull();
    expect(
      reopenedClips.map((clip) => ({
        id: clip.id,
        startSeconds: clip.startSeconds,
      })),
    ).toEqual([
      { id: "timeline-a", startSeconds: 0 },
      { id: "timeline-b", startSeconds: 2 },
      { id: "timeline-c", startSeconds: 4 },
    ]);
  });

  it("deletes all saved editor projects", () => {
    mockEditorLibraries();
    const service = new EditorService();

    service.saveProject({
      project: createEditorProject({
        id: "saved-project-1",
        title: "Saved edit 1",
      }),
    });
    service.saveProject({
      project: createEditorProject({
        id: "saved-project-2",
        title: "Saved edit 2",
      }),
    });

    const workspace = service.deleteAllProjects();

    expect(workspace.projects).toEqual([]);
    expect(workspace.project).toMatchObject({
      assets: [],
      durationSeconds: 0,
      title: "Untitled edit",
    });
  });

  it("recovers placeholder recording durations when saving editor projects", () => {
    mockEditorLibraries({
      recordings: {
        "recording-1": createRecordingDetail({
          durationSeconds: 78.117,
          id: "recording-1",
        }),
      },
    });
    const service = new EditorService();
    const staleAsset = createEditorMediaAsset({
      assetKey: "recording:recording-1",
      category: "recording",
      durationSeconds: null,
      id: "recording-1",
      kind: "recording",
      mediaUrl: "hinekora-media://run-recording/recording-1",
      name: "recording-1.mp4",
    });
    const staleClip = createEditorTimelineClip(staleAsset);
    const staleProject = createEditorProject({
      assets: [staleAsset],
      durationSeconds: 10,
      id: "stale-duration-project",
      tracks: [
        {
          clips: [staleClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });

    const savedProject = service.saveProject({ project: staleProject });

    expect(savedProject.assets[0]).toEqual(
      expect.objectContaining({ durationSeconds: 78.117 }),
    );
    expect(savedProject.durationSeconds).toBe(78.117);
    expect(savedProject.tracks[0]?.clips[0]).toEqual(
      expect.objectContaining({
        durationSeconds: 78.117,
        outSeconds: 78.117,
        sourceOutSeconds: 78.117,
      }),
    );

    const trimmedClip = createEditorTimelineClip(staleAsset, {
      durationSeconds: 5,
      outSeconds: 5,
      sourceOutSeconds: 10,
    });
    const savedTrimmedProject = service.saveProject({
      project: createEditorProject({
        assets: [staleAsset],
        durationSeconds: 5,
        id: "trimmed-stale-duration-project",
        tracks: [
          {
            clips: [trimmedClip],
            id: "video-track",
            kind: "video",
            label: "Video",
          },
        ],
      }),
    });

    expect(savedTrimmedProject.tracks[0]?.clips[0]).toEqual(
      expect.objectContaining({
        durationSeconds: 5,
        outSeconds: 5,
        sourceOutSeconds: 78.117,
      }),
    );
  });

  it("clamps stale replay clip durations to refreshed media duration", () => {
    const staleAsset = createEditorMediaAsset({
      assetKey: "clip:clip-1",
      durationSeconds: 10,
      id: "clip-1",
      mediaUrl: "hinekora-media://replay-clip/clip-1",
      name: "clip-1.mp4",
    });
    const staleClip = createEditorTimelineClip(staleAsset, {
      durationSeconds: 5.36,
      outSeconds: 5.36,
      sourceOutSeconds: 10,
    });
    const staleProject = createEditorProject({
      assets: [staleAsset],
      durationSeconds: 5.36,
      id: "stale-replay-duration-project",
      tracks: [
        {
          clips: [staleClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    mockEditorLibraries({
      clips: {
        "clip-1": {
          ...createReplayClipDetail({
            id: "clip-1",
            targetDurationSeconds: 10,
          }),
          durationSeconds: 3.11,
        },
      },
    });
    const service = new EditorService();

    const savedProject = service.saveProject({ project: staleProject });

    expect(savedProject.assets[0]).toEqual(
      expect.objectContaining({ durationSeconds: 3.11 }),
    );
    expect(savedProject.durationSeconds).toBe(3.11);
    expect(savedProject.tracks[0]?.clips[0]).toEqual(
      expect.objectContaining({
        durationSeconds: 3.11,
        inSeconds: 0,
        outSeconds: 3.11,
        sourceOutSeconds: 3.11,
      }),
    );
  });

  it("keeps clip durations when refreshed media duration is unavailable", () => {
    const staleAsset = createEditorMediaAsset({
      assetKey: "clip:clip-no-duration",
      durationSeconds: 10,
      id: "clip-no-duration",
      mediaUrl: "hinekora-media://replay-clip/clip-no-duration",
      name: "clip-no-duration.mp4",
    });
    const staleClip = createEditorTimelineClip(staleAsset, {
      durationSeconds: 4,
      outSeconds: 4,
      sourceOutSeconds: 10,
    });
    const staleProject = createEditorProject({
      assets: [staleAsset],
      durationSeconds: 4,
      id: "refreshed-missing-duration-project",
      tracks: [
        {
          clips: [staleClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    const refreshedAsset = {
      ...staleAsset,
      durationSeconds: null,
      mediaUrl: "hinekora-media://replay-clip/clip-no-duration-new",
      name: "clip-no-duration-new.mp4",
    };
    const service = new EditorService();
    const internals = service as unknown as {
      refreshEditorProjectMedia: (
        project: EditorProject,
        refreshedAssets: (typeof refreshedAsset)[],
      ) => EditorProject;
    };

    const refreshedProject = internals.refreshEditorProjectMedia(staleProject, [
      refreshedAsset,
    ]);

    expect(refreshedProject.tracks[0]?.clips[0]).toEqual(
      expect.objectContaining({
        durationSeconds: 4,
        inSeconds: 0,
        mediaUrl: refreshedAsset.mediaUrl,
        name: refreshedAsset.name,
        outSeconds: 4,
        sourceOutSeconds: 10,
      }),
    );
  });

  it("clamps invalid refreshed clip bounds to the refreshed media range", () => {
    const staleAsset = createEditorMediaAsset({
      assetKey: "clip:clip-tiny-duration",
      durationSeconds: 10,
      id: "clip-tiny-duration",
      mediaUrl: "hinekora-media://replay-clip/clip-tiny-duration",
      name: "clip-tiny-duration.mp4",
    });
    const staleClip = createEditorTimelineClip(staleAsset, {
      durationSeconds: Number.NaN,
      inSeconds: Number.NaN,
      outSeconds: 20,
      sourceOutSeconds: 10,
    });
    const staleProject = createEditorProject({
      assets: [staleAsset],
      durationSeconds: 10,
      id: "tiny-duration-project",
      tracks: [
        {
          clips: [staleClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    const refreshedAsset = {
      ...staleAsset,
      durationSeconds: 0.0004,
    };
    const service = new EditorService();
    const internals = service as unknown as {
      refreshEditorProjectMedia: (
        project: EditorProject,
        refreshedAssets: (typeof refreshedAsset)[],
      ) => EditorProject;
    };

    const refreshedProject = internals.refreshEditorProjectMedia(staleProject, [
      refreshedAsset,
    ]);

    expect(refreshedProject.tracks[0]?.clips[0]).toEqual(
      expect.objectContaining({
        durationSeconds: 0.001,
        inSeconds: 0,
        outSeconds: 0.001,
        playbackRate: 1,
        sourceInSeconds: 0,
        sourceOutSeconds: 0.001,
      }),
    );

    const roundingAsset = createEditorMediaAsset({
      assetKey: "clip:clip-rounding-boundary",
      durationSeconds: 10,
      id: "clip-rounding-boundary",
      mediaUrl: "hinekora-media://replay-clip/clip-rounding-boundary",
      name: "clip-rounding-boundary.mp4",
    });
    const roundingClip = createEditorTimelineClip(roundingAsset, {
      durationSeconds: 5,
      inSeconds: 1.233,
      outSeconds: 1.234,
      sourceOutSeconds: 10,
    });
    const roundingProject = createEditorProject({
      assets: [roundingAsset],
      durationSeconds: 5,
      id: "rounding-duration-project",
      tracks: [
        {
          clips: [roundingClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    const refreshedRoundingAsset = {
      ...roundingAsset,
      durationSeconds: 1.234,
    };

    const refreshedRoundingProject = internals.refreshEditorProjectMedia(
      roundingProject,
      [refreshedRoundingAsset],
    );

    expect(refreshedRoundingProject.tracks[0]?.clips[0]).toEqual(
      expect.objectContaining({
        durationSeconds: 0.001,
        inSeconds: 1.233,
        outSeconds: 1.234,
        sourceOutSeconds: 1.234,
      }),
    );
  });

  it("limits editor project summaries and signals when more are available", () => {
    vi.useFakeTimers();
    mockEditorLibraries();
    const service = new EditorService();

    try {
      for (let index = 0; index < 6; index += 1) {
        vi.setSystemTime(new Date(`2026-06-18T00:0${index}:00.000Z`));
        service.saveProject({
          project: createEditorProject({
            id: `saved-project-${index}`,
            title: `Saved edit ${index}`,
            updatedAt: "2026-06-01T00:00:00.000Z",
          }),
        });
      }

      const workspace = service.getWorkspace({ projectLimit: 5 });
      const expandedWorkspace = service.getWorkspace({ projectLimit: 10 });

      expect(workspace.projects).toHaveLength(5);
      expect(workspace.hasMoreProjects).toBe(true);
      expect(workspace.projects.map((project) => project.title)).toEqual([
        "Saved edit 5",
        "Saved edit 4",
        "Saved edit 3",
        "Saved edit 2",
        "Saved edit 1",
      ]);
      expect(expandedWorkspace.projects).toHaveLength(6);
      expect(expandedWorkspace.hasMoreProjects).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("prunes saved editor projects when the retention setting is enabled", () => {
    vi.useFakeTimers();
    mockEditorLibraries({ editorAutoPruneProjects: true });
    const service = new EditorService();

    try {
      for (let index = 0; index < 7; index += 1) {
        vi.setSystemTime(new Date(`2026-06-18T00:0${index}:00.000Z`));
        service.saveProject({
          project: createEditorProject({
            id: `saved-project-${index}`,
            title: `Saved edit ${index}`,
            updatedAt: "2026-06-01T00:00:00.000Z",
          }),
        });
      }

      const workspace = service.getWorkspace({ projectLimit: 10 });

      expect(workspace.hasMoreProjects).toBe(false);
      expect(workspace.projects.map((project) => project.title)).toEqual([
        "Saved edit 6",
        "Saved edit 5",
        "Saved edit 4",
        "Saved edit 3",
        "Saved edit 2",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("logs pruning without a protected project id", () => {
    mockEditorLibraries({ editorAutoPruneProjects: true });
    const service = new EditorService();
    const internals = service as unknown as {
      projectRepository: {
        deleteOlderThanLimit: (input: {
          limit: number;
          protectedProjectId: string | null;
          protectedProjectIds: string[];
        }) => number;
      };
      pruneStoredProjects: (protectedProjectId: string | null) => void;
    };
    const deleteOlderThanLimit = vi
      .spyOn(internals.projectRepository, "deleteOlderThanLimit")
      .mockReturnValue(1);

    internals.pruneStoredProjects(null);

    expect(deleteOlderThanLimit).toHaveBeenCalledWith({
      limit: 5,
      protectedProjectId: null,
      protectedProjectIds: [],
    });
  });

  it("protects active export snapshots while pruning saved projects", () => {
    mockEditorLibraries({ editorAutoPruneProjects: true });
    const service = new EditorService();
    const internals = service as unknown as {
      editorExportService: {
        activeExports: Map<string, unknown>;
        createActiveExport: (
          exportRequestId: string,
          projectId: string,
        ) => unknown;
      };
      projectRepository: {
        deleteOlderThanLimit: (input: unknown) => number;
      };
      pruneStoredProjects: (protectedProjectId: string | null) => void;
    };
    const deleteOlderThanLimit = vi
      .spyOn(internals.projectRepository, "deleteOlderThanLimit")
      .mockReturnValue(0);
    internals.editorExportService.createActiveExport(
      "export-request-active",
      "project-active",
    );

    internals.pruneStoredProjects("project-current");

    expect(deleteOlderThanLimit).toHaveBeenCalledWith({
      limit: 5,
      protectedProjectId: "project-current",
      protectedProjectIds: ["project-active"],
    });
    internals.editorExportService.activeExports.clear();
  });

  it("orders export preview clips by normalized timeline position", async () => {
    const asset = createEditorMediaAsset();
    const project = createEditorProject({
      assets: [asset],
      tracks: [
        {
          clips: [
            createEditorTimelineClip(asset, {
              id: "timeline-late",
              inSeconds: 0,
              startSeconds: 2,
            }),
            createEditorTimelineClip(asset, {
              id: "timeline-c",
              inSeconds: 1,
              startSeconds: 0,
            }),
            createEditorTimelineClip(asset, {
              id: "timeline-b",
              inSeconds: 1,
              startSeconds: 0,
            }),
            createEditorTimelineClip(asset, {
              id: "timeline-source-first",
              inSeconds: 0,
              startSeconds: 0,
            }),
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    const service = new EditorService();
    const internals = service as unknown as {
      createExportClips: () => [];
    };
    vi.spyOn(internals, "createExportClips").mockReturnValue([]);
    const lifecycleUpdates: Array<{ previewClips?: Array<{ id: string }> }> =
      [];

    await expect(
      service.exportProject(createExportInput({ project }), {
        onLifecycleChanged: (lifecycle) => lifecycleUpdates.push(lifecycle),
      }),
    ).rejects.toThrow("No timeline clips are available to export");
    expect(lifecycleUpdates[0]?.previewClips?.map((clip) => clip.id)).toEqual([
      "timeline-b",
      "timeline-c",
      "timeline-source-first",
      "timeline-late",
    ]);
  });

  it("exports new files and exposes export actions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-export-"));
    const videosPath = join(directory, "videos");
    const sourcePath = join(directory, "source.mp4");
    await writeFile(sourcePath, "source");
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? videosPath : directory,
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "rendered");
      },
    );
    const service = new EditorService({ renderExportWithFfmpeg });
    const internals = service as unknown as {
      createExportClips: () => Array<{
        durationSeconds: number;
        inSeconds: number;
        outSeconds: number;
        source: { path: string };
        startSeconds: number;
      }>;
      editorExportService: { exportPaths: Map<string, string> };
      handleExportMediaRequest: (request: Request) => Promise<Response>;
    };
    vi.spyOn(internals, "createExportClips").mockReturnValue([
      {
        durationSeconds: 1,
        inSeconds: 0,
        outSeconds: 1,
        source: { path: sourcePath },
        startSeconds: 0,
      },
    ]);
    const showItemInFolder = vi
      .spyOn(shell, "showItemInFolder")
      .mockImplementation(() => undefined);
    const copyFileToClipboard = vi
      .spyOn(FileClipboard, "copyFileToClipboard")
      .mockResolvedValue({ ok: true, error: null });

    try {
      const result = await service.exportProject(
        createExportInput({
          project: createExportProject({ muteAudio: true }),
        }),
      );
      const outputPath = internals.editorExportService.exportPaths.get(
        result.exportId,
      );

      expect(result).toMatchObject({
        durationSeconds: 5,
        fileName: "source.mp4",
        mode: "new-file",
      });
      expect(outputPath).toBeTruthy();
      await expect(readFile(outputPath ?? "", "utf8")).resolves.toBe(
        "rendered",
      );
      expect(service.revealExport(result.exportId)).toEqual({
        ok: true,
        error: null,
      });
      expect(showItemInFolder).toHaveBeenCalledWith(outputPath);
      await expect(service.copyExport(result.exportId)).resolves.toEqual({
        ok: true,
        error: null,
      });
      expect(copyFileToClipboard).toHaveBeenCalledWith(outputPath);
      expect(renderExportWithFfmpeg).toHaveBeenCalledWith(
        expect.objectContaining({ muteAudio: true }),
      );
      expect(
        (
          await internals.handleExportMediaRequest(
            new Request((result.mediaUrl ?? "").replace("://export/", ":///")),
          )
        ).status,
      ).toBe(200);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("does not overwrite a destination created while an export renders", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-export-"));
    const videosPath = join(directory, "videos");
    const sourcePath = join(directory, "source.mp4");
    const occupiedOutputPath = join(
      videosPath,
      "Hinekora",
      "Exports",
      "source.mp4",
    );
    await writeFile(sourcePath, "source");
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? videosPath : directory,
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "rendered");
        await writeFile(occupiedOutputPath, "external");
      },
    );
    const service = new EditorService({
      createExportClips: () => [createResolvedExportClip(sourcePath)],
      renderExportWithFfmpeg,
    });

    try {
      const result = await service.exportProject(createExportInput());
      const outputPath = join(
        videosPath,
        "Hinekora",
        "Exports",
        result.fileName,
      );

      expect(result.fileName).toBe("source (2).mp4");
      await expect(readFile(occupiedOutputPath, "utf8")).resolves.toBe(
        "external",
      );
      await expect(readFile(outputPath, "utf8")).resolves.toBe("rendered");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("fails exports before rendering when their project snapshot cannot persist", async () => {
    const renderExportWithFfmpeg = vi.fn();
    const service = new EditorService({ renderExportWithFfmpeg });
    const internals = service as unknown as {
      projectRepository: { upsert: (project: EditorProject) => void };
    };
    vi.spyOn(internals.projectRepository, "upsert").mockImplementationOnce(
      () => {
        throw new Error("project persistence failed");
      },
    );

    await expect(service.exportProject(createExportInput())).rejects.toThrow(
      "project persistence failed",
    );
    expect(renderExportWithFfmpeg).not.toHaveBeenCalled();
    expect(service.getExportLifecycle()).toMatchObject({
      error: "project persistence failed",
      status: "failed",
    });
  });

  it("sends export progress to the invoking window", async () => {
    const { handlers } = mockIpcMainHandlers();
    const directory = await mkdtemp(
      join(tmpdir(), "hinekora-editor-progress-"),
    );
    const videosPath = join(directory, "videos");
    const sourcePath = join(directory, "source.mp4");
    await writeFile(sourcePath, "source");
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? videosPath : directory,
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: {
        onProgress?: (progress: number) => void;
        outputPath: string;
      }) => {
        input.onProgress?.(0.5);
        input.onProgress?.(0.5);
        input.onProgress?.(0.51);
        input.onProgress?.(1);
        await writeFile(input.outputPath, "rendered");
      },
    );
    const service = new EditorService({ renderExportWithFfmpeg });
    const internals = service as unknown as {
      createExportClips: () => Array<{
        durationSeconds: number;
        inSeconds: number;
        outSeconds: number;
        source: { path: string };
        startSeconds: number;
      }>;
      sendExportProgress: (
        sender:
          | {
              isDestroyed: () => boolean;
              send: (
                channel: EditorChannel,
                progress: { exportRequestId: string; progress: number },
              ) => void;
            }
          | undefined,
        progress: { exportRequestId: string; progress: number },
      ) => void;
      sendExportLifecycle: (
        sender:
          | {
              isDestroyed: () => boolean;
              send: (channel: EditorChannel, lifecycle: unknown) => void;
            }
          | undefined,
        lifecycle: {
          error: string | null;
          exportRequestId: string | null;
          fileName: string | null;
          progress: number;
          projectId: string | null;
          result: null;
          status: "idle";
        },
      ) => void;
    };
    vi.spyOn(internals, "createExportClips").mockReturnValue([
      {
        durationSeconds: 1,
        inSeconds: 0,
        outSeconds: 1,
        source: { path: sourcePath },
        startSeconds: 0,
      },
    ]);
    const sender = {
      id: 45,
      isDestroyed: vi.fn(() => false),
      send: vi.fn(),
    };
    registerIpcWindowRole(sender, WindowName.Main);

    try {
      await expect(
        handlers.get(EditorChannel.ExportProject)?.(
          { sender },
          createExportInput(),
        ),
      ).resolves.toMatchObject({
        fileName: "source.mp4",
        mode: "new-file",
      });
      expect(sender.send).toHaveBeenCalledWith(EditorChannel.ExportProgress, {
        exportRequestId: "export-request-1",
        progress: 0.5,
      });
      expect(
        sender.send.mock.calls.filter(
          ([channel, payload]) =>
            channel === EditorChannel.ExportProgress &&
            (payload as { progress?: number }).progress !== 1,
        ),
      ).toHaveLength(1);
      expect(
        sender.send.mock.calls.filter(
          ([channel, payload]) =>
            channel === EditorChannel.ExportLifecycleChanged &&
            (payload as { progress?: number }).progress === 0.5,
        ),
      ).toEqual([]);
      expect(sender.send).toHaveBeenCalledWith(
        EditorChannel.ExportLifecycleChanged,
        expect.objectContaining({
          exportRequestId: "export-request-1",
          progress: 0.98,
          status: "exporting",
        }),
      );
      const lifecyclePayloads = sender.send.mock.calls
        .filter(([channel]) => channel === EditorChannel.ExportLifecycleChanged)
        .map(([, payload]) => payload as Record<string, unknown>);
      expect(lifecyclePayloads[0]).toHaveProperty("previewClips");
      expect(lifecyclePayloads.slice(1)).not.toContainEqual(
        expect.objectContaining({ previewClips: expect.anything() }),
      );
      expect(
        await handlers.get(EditorChannel.GetExportLifecycle)?.({ sender }),
      ).toMatchObject({
        exportRequestId: "export-request-1",
        progress: 1,
        projectId: "project-1",
        status: "ready",
      });
      expect(
        await handlers.get(EditorChannel.DismissExport)?.({ sender }),
      ).toBeUndefined();
      expect(
        await handlers.get(EditorChannel.GetExportLifecycle)?.({ sender }),
      ).toEqual({
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
      });

      internals.sendExportProgress(undefined, {
        exportRequestId: "export-request-1",
        progress: 0.25,
      });
      internals.sendExportProgress(
        { isDestroyed: () => true, send: vi.fn() },
        { exportRequestId: "export-request-1", progress: 0.25 },
      );
      const idleLifecycle = {
        canCancel: false,
        error: null,
        exportRequestId: null,
        fileName: null,
        previewClips: [],
        progress: 0,
        projectId: null,
        result: null,
        startedAt: null,
        status: "idle" as const,
      };
      internals.sendExportLifecycle(undefined, idleLifecycle);
      internals.sendExportLifecycle(
        { isDestroyed: () => true, send: vi.fn() },
        idleLifecycle,
      );
      internals.sendExportLifecycle(
        {
          isDestroyed: () => false,
          send: () => {
            throw new Error("send failed");
          },
        },
        idleLifecycle,
      );
      internals.sendExportProgress(
        {
          isDestroyed: () => false,
          send: () => {
            throw new Error("send failed");
          },
        },
        { exportRequestId: "export-request-1", progress: 0.25 },
      );
    } finally {
      clearIpcWindowRolesForTests();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("cancels active exports and removes their partial output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-cancel-"));
    const videosPath = join(directory, "videos");
    const sourcePath = join(directory, "source.mp4");
    await writeFile(sourcePath, "source");
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? videosPath : directory,
    );
    let resolveRenderStarted: () => void = () => undefined;
    const renderStarted = new Promise<void>((resolve) => {
      resolveRenderStarted = resolve;
    });
    const renderExportWithFfmpeg = vi.fn(
      async (input: {
        outputPath: string;
        queueOptions?: { signal?: AbortSignal };
        signal?: AbortSignal;
      }) => {
        await writeFile(input.outputPath, "partial");
        resolveRenderStarted();
        const signal = input.signal;
        if (!signal) {
          throw new Error("Expected an export cancellation signal");
        }
        await new Promise<void>((_resolve, reject) => {
          if (signal.aborted) {
            reject(signal.reason);
            return;
          }
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
    );
    const service = new EditorService({
      createExportClips: () => [createResolvedExportClip(sourcePath)],
      renderExportWithFfmpeg,
    });

    try {
      const exportResult = service.exportProject(createExportInput()).then(
        () => null,
        (error: unknown) => error,
      );
      await renderStarted;
      expect(service.getExportLifecycle()).toMatchObject({
        exportRequestId: "export-request-1",
        status: "exporting",
      });
      service.dismissExport();
      expect(service.getExportLifecycle().status).toBe("exporting");
      await expect(
        service.exportProject(
          createExportInput({ exportRequestId: "export-request-2" }),
        ),
      ).rejects.toThrow("Another editor video is already processing");
      await expect(
        service.copyProjectToClipboard(
          createCopyToClipboardInput({
            project: createExportProject({ durationSeconds: 1 }),
          }),
        ),
      ).resolves.toEqual({
        error: "Wait for the current video save to finish",
        ok: false,
      });
      vi.mocked(console.error).mockClear();
      vi.mocked(console.info).mockClear();

      await expect(
        service.cancelExport({ exportRequestId: "export-request-1" }),
      ).resolves.toEqual({ cancelled: true });
      expect(await exportResult).toMatchObject({ name: "AbortError" });
      expect(console.error).not.toHaveBeenCalled();
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining("INFO [editor] Editor export cancelled"),
        expect.objectContaining({ exportRequestId: "export-request-1" }),
      );
      expect(renderExportWithFfmpeg).toHaveBeenCalledWith(
        expect.objectContaining({
          queueOptions: { signal: expect.any(AbortSignal) },
          signal: expect.any(AbortSignal),
        }),
      );
      await expect(
        readdir(join(videosPath, "Hinekora", "Exports")),
      ).resolves.toEqual([]);
      expect(service.getExportLifecycle().status).toBe("idle");
      await expect(
        service.cancelExport({ exportRequestId: "export-request-1" }),
      ).resolves.toEqual({ cancelled: false });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("reports cancellation cleanup failures and keeps the failed status visible", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-cancel-"));
    const videosPath = join(directory, "videos");
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? videosPath : directory,
    );
    let resolveRenderStarted: () => void = () => undefined;
    const renderStarted = new Promise<void>((resolve) => {
      resolveRenderStarted = resolve;
    });
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string; signal?: AbortSignal }) => {
        await writeFile(input.outputPath, "partial");
        resolveRenderStarted();
        await new Promise<void>((_resolve, reject) => {
          input.signal?.addEventListener(
            "abort",
            () => reject(input.signal?.reason),
            { once: true },
          );
        });
      },
    );
    const removeExportFile = vi
      .fn<typeof rm>()
      .mockRejectedValue(new Error("file is locked"));
    const service = new EditorService({
      createExportClips: () => [
        createResolvedExportClip(join(directory, "source.mp4")),
      ],
      removeExportFile,
      renderExportWithFfmpeg,
    });

    try {
      const exportRequest = service
        .exportProject(createExportInput())
        .catch((error: unknown) => error);
      await renderStarted;

      await expect(
        service.cancelExport({ exportRequestId: "export-request-1" }),
      ).rejects.toThrow("Temporary video files could not be removed");
      await expect(exportRequest).resolves.toMatchObject({
        message: "Temporary video files could not be removed",
      });
      expect(removeExportFile).toHaveBeenCalledTimes(1);
      expect(service.getExportLifecycle()).toMatchObject({
        error:
          "Video processing stopped, but temporary files could not be removed",
        exportRequestId: "export-request-1",
        status: "failed",
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("does not cancel an export while its completed file is being committed", async () => {
    const service = new EditorService();
    const abortController = new AbortController();
    const internals = service as unknown as {
      editorExportService: {
        activeExports: Map<
          string,
          {
            abortController: AbortController;
            cleanupError: null;
            completion: Promise<void>;
            phase: "committing";
            projectId: null;
            resolveCompletion: () => void;
          }
        >;
      };
    };
    internals.editorExportService.activeExports.set("export-request-1", {
      abortController,
      cleanupError: null,
      completion: Promise.resolve(),
      phase: "committing",
      projectId: null,
      resolveCompletion: () => undefined,
    });

    await expect(
      service.cancelExport({ exportRequestId: "export-request-1" }),
    ).resolves.toEqual({ cancelled: false });
    expect(abortController.signal.aborted).toBe(false);
  });

  it("waits for committing exports during shutdown without aborting them", async () => {
    const service = new EditorService();
    const abortController = new AbortController();
    let resolveCompletion: () => void = () => undefined;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    const internals = service as unknown as {
      editorExportService: {
        activeExports: Map<
          string,
          {
            abortController: AbortController;
            cleanupError: null;
            completion: Promise<void>;
            phase: "committing";
            projectId: null;
            resolveCompletion: () => void;
          }
        >;
      };
    };
    internals.editorExportService.activeExports.set("export-request-1", {
      abortController,
      cleanupError: null,
      completion,
      phase: "committing",
      projectId: null,
      resolveCompletion,
    });
    let shutdownFinished = false;

    const shutdown = service.shutdown().then(() => {
      shutdownFinished = true;
    });
    await Promise.resolve();

    expect(abortController.signal.aborted).toBe(false);
    expect(shutdownFinished).toBe(false);

    resolveCompletion();
    await shutdown;

    expect(shutdownFinished).toBe(true);
  });

  it("bounds shutdown waiting when an export commit does not settle", async () => {
    vi.useFakeTimers();
    const service = new EditorService({ shutdownTimeoutMs: 25 });
    const abortController = new AbortController();
    const clipboardAbortController = new AbortController();
    const internals = service as unknown as {
      activeClipboardCopy: {
        abortController: AbortController;
        completion: Promise<void>;
        resolveCompletion: () => void;
      } | null;
      editorExportService: {
        activeExports: Map<string, unknown>;
        exportProject: (input: EditorExportInput) => Promise<unknown>;
      };
    };
    internals.editorExportService.activeExports.set("export-request-1", {
      abortController,
      cleanupError: null,
      completion: new Promise<void>(() => undefined),
      phase: "committing",
      projectId: "project-1",
      resolveCompletion: () => undefined,
    });
    internals.activeClipboardCopy = {
      abortController: clipboardAbortController,
      completion: new Promise<void>(() => undefined),
      resolveCompletion: () => undefined,
    };

    try {
      const shutdown = service.shutdown();
      await vi.advanceTimersByTimeAsync(25);
      await expect(shutdown).resolves.toBeUndefined();
      expect(abortController.signal.aborted).toBe(false);
      expect(clipboardAbortController.signal.aborted).toBe(true);
      await expect(
        internals.editorExportService.exportProject(createExportInput()),
      ).rejects.toThrow("Editor is shutting down");
    } finally {
      vi.useRealTimers();
      internals.editorExportService.activeExports.clear();
      internals.activeClipboardCopy = null;
    }
  });

  it("aborts active renders and waits for cleanup during shutdown", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "hinekora-editor-shutdown-"),
    );
    const videosPath = join(directory, "videos");
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? videosPath : directory,
    );
    let resolveRenderStarted: () => void = () => undefined;
    const renderStarted = new Promise<void>((resolve) => {
      resolveRenderStarted = resolve;
    });
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string; signal?: AbortSignal }) => {
        await writeFile(input.outputPath, "partial");
        resolveRenderStarted();
        await new Promise<void>((_resolve, reject) => {
          input.signal?.addEventListener(
            "abort",
            () => reject(input.signal?.reason),
            { once: true },
          );
        });
      },
    );
    const service = new EditorService({
      createExportClips: () => [
        createResolvedExportClip(join(directory, "source.mp4")),
      ],
      renderExportWithFfmpeg,
    });

    try {
      const exportResult = service
        .exportProject(createExportInput())
        .catch((error: unknown) => error);
      await renderStarted;
      await service.shutdown();

      await expect(exportResult).resolves.toMatchObject({ name: "AbortError" });
      await expect(
        readdir(join(videosPath, "Hinekora", "Exports")),
      ).resolves.toEqual([]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects duplicate active export request ids", () => {
    const service = new EditorService();
    const internals = service as unknown as {
      editorExportService: {
        activeExports: Map<string, unknown>;
        createActiveExport: (exportRequestId: string) => {
          resolveCompletion: () => void;
        };
      };
    };
    const activeExport =
      internals.editorExportService.createActiveExport("export-request-1");

    expect(() =>
      internals.editorExportService.createActiveExport("export-request-1"),
    ).toThrow("Editor export request is already active");

    activeExport.resolveCompletion();
    internals.editorExportService.activeExports.clear();
  });

  it("reports export finalization failures through the lifecycle", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "hinekora-editor-finalization-"),
    );
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? directory : tmpdir(),
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "rendered");
      },
    );
    const statExportFile = vi
      .fn<(path: string) => Promise<{ size: number }>>()
      .mockRejectedValue(new Error("stat failed"));
    const service = new EditorService({
      createExportClips: () => [
        createResolvedExportClip(join(directory, "source.mp4")),
      ],
      renderExportWithFfmpeg,
      statExportFile,
    });

    try {
      await expect(service.exportProject(createExportInput())).rejects.toThrow(
        "stat failed",
      );
      expect(service.getExportLifecycle()).toMatchObject({
        error: "stat failed",
        exportRequestId: "export-request-1",
        status: "failed",
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("keeps the export active until validation and commit finish", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-commit-"));
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? directory : tmpdir(),
    );
    let resolveStat: (value: { size: number }) => void = () => undefined;
    const statExportFile = vi.fn(
      () =>
        new Promise<{ size: number }>((resolve) => {
          resolveStat = resolve;
        }),
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "rendered");
      },
    );
    const service = new EditorService({
      createExportClips: () => [
        createResolvedExportClip(join(directory, "source.mp4")),
      ],
      renderExportWithFfmpeg,
      statExportFile,
    });

    try {
      const exportResult = service.exportProject(createExportInput());
      await vi.waitFor(() => {
        expect(statExportFile).toHaveBeenCalledTimes(1);
      });
      await expect(
        service.exportProject(
          createExportInput({ exportRequestId: "export-request-2" }),
        ),
      ).rejects.toThrow("Another editor video is already processing");

      resolveStat({ size: 8 });
      await expect(exportResult).resolves.toMatchObject({ sizeBytes: 8 });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("handles export and export action failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-export-"));
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? directory : tmpdir(),
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "partial");
        throw new Error("render failed");
      },
    );
    const removeExportFile: typeof rm = vi.fn(
      async (...args: Parameters<typeof rm>) => {
        await rm(...args);
        throw new Error("cleanup warning");
      },
    );
    const service = new EditorService({
      createExportClips: () => [
        createResolvedExportClip(join(directory, "source.mp4")),
      ],
      removeExportFile,
      renderExportWithFfmpeg,
    });
    const internals = service as unknown as {
      editorExportService: {
        exportPaths: Map<string, string>;
        rememberExportPath: (exportId: string, outputPath: string) => void;
      };
      handleExportMediaRequest: (request: Request) => Promise<Response>;
      resolveExportMediaRequestId: (url: string) => string | null;
    };
    vi.spyOn(shell, "showItemInFolder").mockImplementation(() => {
      throw new Error("shell failed");
    });

    try {
      await expect(service.exportProject(createExportInput())).rejects.toThrow(
        "Temporary video files could not be removed",
      );
      expect(service.getExportLifecycle()).toMatchObject({
        error: "Video saving failed, and temporary files could not be removed",
        exportRequestId: "export-request-1",
        status: "failed",
      });
      await expect(
        readdir(join(directory, "Hinekora", "Exports")),
      ).resolves.toEqual([]);
      await expect(
        new EditorService({ renderExportWithFfmpeg }).exportProject(
          createExportInput({ project: createExportProject({ clips: [] }) }),
        ),
      ).rejects.toThrow("No timeline clips are available to export");
      const noTrackInput = createExportInput();
      await expect(
        new EditorService({ renderExportWithFfmpeg }).exportProject({
          ...noTrackInput,
          project: { ...noTrackInput.project, tracks: [] },
        }),
      ).rejects.toThrow("No timeline clips are available to export");
      const missingAssetInput = createExportInput();
      await expect(
        new EditorService({ renderExportWithFfmpeg }).exportProject({
          ...missingAssetInput,
          project: { ...missingAssetInput.project, assets: [] },
        }),
      ).rejects.toThrow("No timeline clips are available to export");
      await expect(
        service.exportProject(
          createExportInput({
            mode: "overwrite",
            project: createExportProject({ activeSource: null }),
          }),
        ),
      ).rejects.toThrow("No overwrite source is available to export");
      expect(service.revealExport("missing")).toEqual({
        ok: false,
        error: "Saved video is not available",
      });
      internals.editorExportService.rememberExportPath(
        "export-1",
        join(directory, "missing.mp4"),
      );
      expect(service.revealExport("export-1")).toEqual({
        ok: false,
        error: "Saved video is not available",
      });
      const existingExportPath = join(directory, "existing.mp4");
      await writeFile(existingExportPath, "video");
      internals.editorExportService.rememberExportPath(
        "export-2",
        existingExportPath,
      );
      expect(service.revealExport("export-2")).toEqual({
        ok: false,
        error: "shell failed",
      });
      vi.spyOn(FileClipboard, "copyFileToClipboard")
        .mockResolvedValueOnce({ ok: false, error: "copy failed" })
        .mockRejectedValueOnce(new Error("copy crashed"));
      await expect(service.copyExport("missing")).resolves.toEqual({
        ok: false,
        error: "Saved video is not available",
      });
      await expect(service.copyExport("export-2")).resolves.toEqual({
        ok: false,
        error: "copy failed",
      });
      await expect(service.copyExport("export-2")).resolves.toEqual({
        ok: false,
        error: "copy crashed",
      });
      expect(
        (
          await internals.handleExportMediaRequest(
            new Request("hinekora-editor-export://export/"),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await internals.handleExportMediaRequest(
            new Request("hinekora-editor-export://export/export-1"),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await internals.handleExportMediaRequest(
            new Request("hinekora-editor-export://export/not-remembered"),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await internals.handleExportMediaRequest(
            new Request("https://example.test/export-2"),
          )
        ).status,
      ).toBe(404);
      expect(internals.resolveExportMediaRequestId("not a url")).toBeNull();
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("prevents competing renders and cancels clipboard work at shutdown", async () => {
    const tempPath = await mkdtemp(
      join(tmpdir(), "hinekora-editor-copy-shutdown-"),
    );
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "temp" ? tempPath : tmpdir(),
    );
    let resolveRenderStarted: () => void = () => undefined;
    const renderStarted = new Promise<void>((resolve) => {
      resolveRenderStarted = resolve;
    });
    let renderedPath: string | null = null;
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string; signal?: AbortSignal }) => {
        renderedPath = input.outputPath;
        await writeFile(input.outputPath, "partial");
        resolveRenderStarted();
        await new Promise<void>((_resolve, reject) => {
          input.signal?.addEventListener(
            "abort",
            () => reject(input.signal?.reason),
            { once: true },
          );
        });
      },
    );
    const service = new EditorService({ renderExportWithFfmpeg });
    const internals = service as unknown as {
      activeClipboardCopy: unknown;
      createExportClips: () => Array<{
        durationSeconds: number;
        inSeconds: number;
        outSeconds: number;
        source: { path: string };
        startSeconds: number;
      }>;
    };
    vi.spyOn(internals, "createExportClips").mockReturnValue([
      {
        durationSeconds: 1,
        inSeconds: 0,
        outSeconds: 1,
        source: { path: join(tempPath, "source.mp4") },
        startSeconds: 0,
      },
    ]);
    const copyInput = createCopyToClipboardInput({
      project: createExportProject({ durationSeconds: 1 }),
    });

    try {
      const copyRequest = service.copyProjectToClipboard(copyInput);
      await renderStarted;

      await expect(service.copyProjectToClipboard(copyInput)).resolves.toEqual({
        error: "Wait for the current video save to finish",
        ok: false,
      });
      await expect(service.exportProject(createExportInput())).rejects.toThrow(
        "Another editor video is already processing",
      );

      await service.shutdown();

      await expect(copyRequest).resolves.toEqual({
        error: "Application is shutting down",
        ok: false,
      });
      expect(internals.activeClipboardCopy).toBeNull();
      await expect(stat(renderedPath ?? "")).rejects.toThrow();
      await expect(service.exportProject(createExportInput())).rejects.toThrow(
        "Editor is shutting down",
      );
      await expect(service.copyProjectToClipboard(copyInput)).resolves.toEqual({
        error: "Editor is shutting down",
        ok: false,
      });
    } finally {
      await rm(tempPath, { force: true, recursive: true });
    }
  });

  it("copies current projects to the clipboard and cleans up failures", async () => {
    const tempPath = await mkdtemp(join(tmpdir(), "hinekora-editor-copy-"));
    const sourcePath = join(tempPath, "source.mp4");
    await writeFile(sourcePath, "source");
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "temp" ? tempPath : tmpdir(),
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "clipboard");
      },
    );
    const service = new EditorService({ renderExportWithFfmpeg });
    const internals = service as unknown as {
      createExportClips: () => Array<{
        durationSeconds: number;
        inSeconds: number;
        outSeconds: number;
        source: { path: string };
        startSeconds: number;
      }>;
    };
    vi.spyOn(internals, "createExportClips").mockReturnValue([
      {
        durationSeconds: 1,
        inSeconds: 0,
        outSeconds: 1,
        source: { path: sourcePath },
        startSeconds: 0,
      },
    ]);
    const copyFileToClipboard = vi
      .spyOn(FileClipboard, "copyFileToClipboard")
      .mockResolvedValueOnce({ ok: true, error: null })
      .mockResolvedValueOnce({ ok: false, error: "copy failed" });

    try {
      await expect(
        service.copyProjectToClipboard(
          createCopyToClipboardInput({
            project: createExportProject({
              durationSeconds: 1,
              muteAudio: true,
            }),
          }),
        ),
      ).resolves.toEqual({ ok: true, error: null });
      const copiedPath = copyFileToClipboard.mock.calls[0]?.[0];
      expect(copiedPath).toBeTruthy();
      expect(renderExportWithFfmpeg).toHaveBeenCalledWith(
        expect.objectContaining({ muteAudio: true }),
      );
      await expect(readFile(copiedPath ?? "", "utf8")).resolves.toBe(
        "clipboard",
      );

      await expect(
        service.copyProjectToClipboard(
          createCopyToClipboardInput({
            project: createExportProject({ durationSeconds: 1 }),
          }),
        ),
      ).resolves.toEqual({ ok: false, error: "copy failed" });
      const failedPath = copyFileToClipboard.mock.calls[1]?.[0];
      await expect(readFile(failedPath ?? "", "utf8")).rejects.toThrow();

      vi.spyOn(internals, "createExportClips").mockReturnValueOnce([]);
      await expect(
        service.copyProjectToClipboard(
          createCopyToClipboardInput({
            project: createExportProject({ clips: [], durationSeconds: 0 }),
          }),
        ),
      ).resolves.toEqual({
        ok: false,
        error: "No timeline clips are available to copy",
      });
    } finally {
      await rm(tempPath, { force: true, recursive: true });
    }
  });

  it("keeps clipboard success even when stale cleanup fails", async () => {
    const tempPath = await mkdtemp(join(tmpdir(), "hinekora-editor-copy-"));
    const cleanupTempPath = await mkdtemp(
      join(tmpdir(), "hinekora-editor-copy-cleanup-"),
    );
    await mkdir(join(cleanupTempPath, "Hinekora"), { recursive: true });
    await writeFile(join(cleanupTempPath, "Hinekora", "Editor Clipboard"), "");
    vi.spyOn(app, "getPath")
      .mockReturnValueOnce(tempPath)
      .mockReturnValueOnce(cleanupTempPath);
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "clipboard");
      },
    );
    const service = new EditorService({ renderExportWithFfmpeg });
    const internals = service as unknown as {
      createExportClips: () => Array<{
        durationSeconds: number;
        inSeconds: number;
        outSeconds: number;
        source: { path: string };
        startSeconds: number;
      }>;
    };
    vi.spyOn(internals, "createExportClips").mockReturnValue([
      {
        durationSeconds: 1,
        inSeconds: 0,
        outSeconds: 1,
        source: { path: join(tempPath, "source.mp4") },
        startSeconds: 0,
      },
    ]);
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });

    try {
      await expect(
        service.copyProjectToClipboard(
          createCopyToClipboardInput({
            project: createExportProject({ durationSeconds: 1 }),
          }),
        ),
      ).resolves.toEqual({ ok: true, error: null });
    } finally {
      await rm(tempPath, { force: true, recursive: true });
      await rm(cleanupTempPath, { force: true, recursive: true });
    }
  });

  it("survives clipboard cleanup failures during copy", async () => {
    const tempPath = await mkdtemp(
      join(tmpdir(), "hinekora-editor-copy-cleanup-"),
    );
    const cleanupEditorClipboardOutputDirectory = vi
      .spyOn(EditorFiles, "cleanupEditorClipboardOutputDirectory")
      .mockRejectedValue(new Error("cleanup crashed"));
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "clipboard");
      },
    );
    const service = new EditorService({ renderExportWithFfmpeg });
    const internals = service as unknown as {
      createExportClips: () => Array<{
        durationSeconds: number;
        inSeconds: number;
        outSeconds: number;
        source: { path: string };
        startSeconds: number;
      }>;
    };
    vi.spyOn(internals, "createExportClips").mockReturnValue([
      {
        durationSeconds: 1,
        inSeconds: 0,
        outSeconds: 1,
        source: { path: join(tempPath, "source.mp4") },
        startSeconds: 0,
      },
    ]);
    vi.spyOn(app, "getPath").mockReturnValue(tempPath);
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });

    try {
      await expect(
        service.copyProjectToClipboard(
          createCopyToClipboardInput({
            project: createExportProject({ durationSeconds: 1 }),
          }),
        ),
      ).resolves.toEqual({ ok: true, error: null });
      expect(cleanupEditorClipboardOutputDirectory).toHaveBeenCalledTimes(1);
    } finally {
      cleanupEditorClipboardOutputDirectory.mockRestore?.();
      await rm(tempPath, { force: true, recursive: true });
    }
  });

  it("returns clipboard errors when render or cleanup crashes", async () => {
    const tempPath = await mkdtemp(join(tmpdir(), "hinekora-editor-copy-"));
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "temp" ? tempPath : tmpdir(),
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "partial");
        throw new Error("render crashed");
      },
    );
    const service = new EditorService({ renderExportWithFfmpeg });
    const internals = service as unknown as {
      createExportClips: () => Array<{
        durationSeconds: number;
        inSeconds: number;
        outSeconds: number;
        source: { path: string };
        startSeconds: number;
      }>;
    };
    vi.spyOn(internals, "createExportClips").mockReturnValue([
      {
        durationSeconds: 1,
        inSeconds: 0,
        outSeconds: 1,
        source: { path: join(tempPath, "source.mp4") },
        startSeconds: 0,
      },
    ]);

    try {
      await expect(
        service.copyProjectToClipboard(
          createCopyToClipboardInput({
            project: createExportProject({ durationSeconds: 1 }),
            resolution: "1080p",
          }),
        ),
      ).resolves.toEqual({ ok: false, error: "render crashed" });
      const clipboardDirectory = join(tempPath, "Hinekora", "Editor Clipboard");
      expect(
        existsSync(clipboardDirectory) ? await readdir(clipboardDirectory) : [],
      ).toEqual([]);
    } finally {
      await rm(tempPath, { force: true, recursive: true });
    }
  });

  it("resolves export sources for recordings and replay clips", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-source-"));
    const clipPath = join(directory, "Death Clips", "clip.mp4");
    const recordingPath = join(directory, "recording.mp4");
    await mkdir(join(directory, "Death Clips"), { recursive: true });
    await writeFile(clipPath, "clip");
    await writeFile(recordingPath, "recording");
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? directory : tmpdir(),
    );
    mockEditorLibraries({
      clips: {
        "clip-1": createReplayClipDetail({
          id: "clip-1",
          originalObsPath: clipPath,
          processedClipPath: null,
        }),
      },
      recordings: {
        "recording-1": createRecordingDetail({
          id: "recording-1",
          path: recordingPath,
        }),
      },
      storageRoot: directory,
    });
    const service = new EditorService();
    const internals = service as unknown as {
      createExportClips: (clips: EditorExportClipInput[]) => Array<{
        durationSeconds: number;
        inSeconds: number;
        outSeconds: number;
        playbackRate: number;
        source: { path: string };
        startSeconds: number;
      }>;
      resolveExportSource: (source: {
        id: string;
        kind: "clip" | "recording";
      }) => { mediaUrl: string | null; path: string };
    };

    try {
      expect(
        internals.resolveExportSource({ id: "recording-1", kind: "recording" }),
      ).toMatchObject({ path: recordingPath, storageRoot: directory });
      expect(
        internals.resolveExportSource({ id: "clip-1", kind: "clip" }),
      ).toMatchObject({ path: clipPath, storageRoot: directory });
      expect(
        internals.createExportClips([
          createExportClip({
            durationSeconds: 1,
            inSeconds: 2,
            outSeconds: 3,
            source: { id: "recording-1", kind: "recording" },
            startSeconds: 2,
          }),
          createExportClip({
            durationSeconds: 5,
            outSeconds: 3,
            source: { id: "clip-1", kind: "clip" },
            startSeconds: 2,
          }),
          createExportClip({
            durationSeconds: 1,
            inSeconds: 1,
            outSeconds: 1,
            source: { id: "recording-1", kind: "recording" },
            startSeconds: 0,
          }),
        ]),
      ).toMatchObject([
        {
          inSeconds: 0,
          durationSeconds: 3,
          source: { path: clipPath },
          startSeconds: 2,
        },
        {
          inSeconds: 2,
          durationSeconds: 1,
          playbackRate: 1,
          source: { path: recordingPath },
          startSeconds: 2,
        },
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("throws safe errors for unavailable export sources", () => {
    mockEditorLibraries({
      clips: {
        "outside-clip": createReplayClipDetail({
          id: "outside-clip",
          originalObsPath: "C:\\outside\\clip.mp4",
          processedClipPath: null,
        }),
      },
      recordings: {
        missing: null,
      },
      storageRoot: "C:\\Videos",
    });
    const service = new EditorService();
    const internals = service as unknown as {
      resolveExportSource: (source: {
        id: string;
        kind: "clip" | "recording";
      }) => { mediaUrl: string | null; path: string };
    };

    expect(() =>
      internals.resolveExportSource({ id: "missing", kind: "recording" }),
    ).toThrow("Recording file is not available");
    expect(() =>
      internals.resolveExportSource({ id: "missing", kind: "clip" }),
    ).toThrow("Clip file is not available");
    expect(() =>
      internals.resolveExportSource({ id: "outside-clip", kind: "clip" }),
    ).toThrow("Clip file is not available");
  });

  it("removes the temporary render file after overwrite export succeeds", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-export-"));
    const outputPath = join(directory, "source.mp4");
    await writeFile(outputPath, "original");
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "rendered");
      },
    );
    const removeExportFile: typeof rm = vi.fn(
      async (...args: Parameters<typeof rm>) => {
        await rm(...args);
        throw new Error("cleanup warning");
      },
    );
    const service = new EditorService({
      createExportClips: () => [createResolvedExportClip(outputPath)],
      removeExportFile,
      renderExportWithFfmpeg,
      resolveExportSource: () => ({ path: outputPath }),
    });

    const input: EditorExportInput = createExportInput({
      mode: "overwrite",
    });

    await expect(service.exportProject(input)).resolves.toMatchObject({
      fileName: "source.mp4",
      mode: "overwrite",
    });
    await expect(readFile(outputPath, "utf8")).resolves.toBe("rendered");
    expect((await readdir(directory)).sort()).toEqual([
      ".hinekora-editor-exports",
      "source.mp4",
    ]);
    await expect(
      readdir(join(directory, ".hinekora-editor-exports")),
    ).resolves.toEqual([]);
    expect(renderExportWithFfmpeg).toHaveBeenCalledTimes(1);

    await rm(directory, { force: true, recursive: true });
  });

  it("keeps the original overwrite file when the atomic commit fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-commit-"));
    const outputPath = join(directory, "source.mp4");
    await writeFile(outputPath, "original");
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "rendered");
      },
    );
    const renameExportFile: typeof rename = vi.fn(async () => {
      throw new Error("commit failed");
    });
    const service = new EditorService({
      createExportClips: () => [createResolvedExportClip(outputPath)],
      renameExportFile,
      renderExportWithFfmpeg,
      resolveExportSource: () => ({ path: outputPath }),
    });

    try {
      await expect(
        service.exportProject(
          createExportInput({
            mode: "overwrite",
          }),
        ),
      ).rejects.toThrow("commit failed");
      await expect(readFile(outputPath, "utf8")).resolves.toBe("original");
      expect((await readdir(directory)).sort()).toEqual([
        ".hinekora-editor-exports",
        "source.mp4",
      ]);
      await expect(
        readdir(join(directory, ".hinekora-editor-exports")),
      ).resolves.toEqual([]);
      expect(service.getExportLifecycle()).toMatchObject({
        error: "commit failed",
        status: "failed",
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("removes a temporary new-file render when its atomic commit fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-commit-"));
    vi.spyOn(app, "getPath").mockImplementation((name) =>
      name === "videos" ? directory : tmpdir(),
    );
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "rendered");
      },
    );
    const linkExportFile: typeof link = vi.fn(async () => {
      throw new Error("commit failed");
    });
    const createService = (removeExportFile?: typeof rm) => {
      const service = new EditorService({
        createExportClips: () => [
          createResolvedExportClip(join(directory, "source.mp4")),
        ],
        ...(removeExportFile ? { removeExportFile } : {}),
        linkExportFile,
        renderExportWithFfmpeg,
      });
      return service;
    };

    try {
      const service = createService();
      await expect(service.exportProject(createExportInput())).rejects.toThrow(
        "commit failed",
      );
      await expect(
        readdir(join(directory, "Hinekora", "Exports")),
      ).resolves.toEqual([]);

      const removeExportFile = vi
        .fn<typeof rm>()
        .mockRejectedValue(new Error("file is locked"));
      const cleanupFailureService = createService(removeExportFile);
      await expect(
        cleanupFailureService.exportProject(
          createExportInput({ exportRequestId: "export-request-2" }),
        ),
      ).rejects.toThrow("Temporary video files could not be removed");
      expect(cleanupFailureService.getExportLifecycle()).toMatchObject({
        error: "Video saving failed, and temporary files could not be removed",
        status: "failed",
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("overwrites the explicit source instead of the first timeline clip", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-target-"));
    const firstPath = join(directory, "first.mp4");
    const targetPath = join(directory, "target.mp4");
    await writeFile(firstPath, "first");
    await writeFile(targetPath, "target");
    const renderExportWithFfmpeg = vi.fn(
      async (input: { outputPath: string }) => {
        await writeFile(input.outputPath, "rendered");
      },
    );
    const service = new EditorService({
      createExportClips: () => [
        createResolvedExportClip(firstPath),
        createResolvedExportClip(targetPath, { startSeconds: 1 }),
      ],
      renderExportWithFfmpeg,
      resolveExportSource: () => ({ path: targetPath }),
    });

    await service.exportProject(
      createExportInput({
        fileName: "target.mp4",
        mode: "overwrite",
        project: createExportProject({
          activeSource: { id: "clip-2", kind: "clip" },
          clips: [
            createExportClip({ source: { id: "clip-1", kind: "clip" } }),
            createExportClip({
              source: { id: "clip-2", kind: "clip" },
              startSeconds: 1,
            }),
          ],
          durationSeconds: 2,
        }),
      }),
    );

    await expect(readFile(firstPath, "utf8")).resolves.toBe("first");
    await expect(readFile(targetPath, "utf8")).resolves.toBe("rendered");

    await rm(directory, { force: true, recursive: true });
  });

  it("caps remembered export media paths", () => {
    const service = new EditorService();
    const internals = service as unknown as {
      editorExportService: {
        exportPaths: Map<string, string>;
        rememberExportPath: (exportId: string, outputPath: string) => void;
      };
    };

    for (let index = 0; index < 25; index += 1) {
      internals.editorExportService.rememberExportPath(
        `export-${index}`,
        `output-${index}.mp4`,
      );
    }

    expect(internals.editorExportService.exportPaths.size).toBe(20);
    expect(
      Array.from(internals.editorExportService.exportPaths.keys()).at(0),
    ).toBe("export-5");
    expect(
      Array.from(internals.editorExportService.exportPaths.keys()).at(-1),
    ).toBe("export-24");
  });

  it("rejects invalid export timeline payloads before rendering", async () => {
    const { handlers } = mockIpcMainHandlers();
    new EditorService();

    await expect(
      handlers.get(EditorChannel.ExportProject)?.(
        {},
        createExportInput({
          mode: "overwrite",
          project: createExportProject({ activeSource: null }),
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "overwrite source must be included in clips",
    });

    await expect(
      handlers.get(EditorChannel.ExportProject)?.(
        {},
        createExportInput({
          project: createExportProject({
            clips: [
              createExportClip({ durationSeconds: 5, outSeconds: 5 }),
              createExportClip({
                durationSeconds: 3,
                outSeconds: 3,
                source: { id: "clip-2", kind: "clip" },
                startSeconds: 4,
              }),
            ],
            durationSeconds: 10,
          }),
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "timeline clips must not overlap",
    });

    await expect(
      handlers.get(EditorChannel.CopyProjectToClipboard)?.(
        {},
        {
          fileName: "source.mp4",
          project: createExportProject({
            clips: [createExportClip({ durationSeconds: 5, outSeconds: 5 })],
            durationSeconds: 4,
          }),
          resolution: "1080p",
        },
      ),
    ).resolves.toEqual({
      ok: false,
      error: "clip range must fit project duration",
    });

    await expect(
      handlers.get(EditorChannel.ExportProject)?.(
        {},
        createExportInput({
          project: createExportProject({ durationSeconds: 86_401 }),
        }),
      ),
    ).resolves.toEqual({ ok: false, error: "project duration is too large" });
  });

  it("renders a gap and audio-less clip with the ffmpeg export graph", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-editor-smoke-"));
    const sourcePath = join(directory, "source.mp4");
    const outputPath = join(directory, "output.mp4");
    const ffmpegPath = resolveEditorFfmpegPath();
    if (!ffmpegPath) {
      await rm(directory, { force: true, recursive: true });
      return;
    }

    try {
      await runEditorFfmpeg(ffmpegPath, [
        "-hide_banner",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=160x90:r=30:d=0.5",
        "-an",
        "-pix_fmt",
        "yuv420p",
        sourcePath,
      ]);

      await renderEditorExportWithFfmpeg({
        outputPath,
        resolution: "720p",
        segments: [
          { durationSeconds: 0.2, kind: "gap", startSeconds: 0 },
          {
            durationSeconds: 0.4,
            inSeconds: 0,
            kind: "clip",
            outSeconds: 0.4,
            playbackRate: 1,
            source: { path: sourcePath },
            sourceDurationSeconds: 0.4,
            startSeconds: 0.2,
          },
        ],
      });

      expect((await stat(outputPath)).size).toBeGreaterThan(0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
