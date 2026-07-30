import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as appLog from "~/main/utils/app-log";

import type { EditorExportClipInput, EditorProject } from "../Editor.dto";
import { EditorTemporaryFileCleanupError } from "../Editor.files";
import {
  EditorExportService,
  type EditorExportVideoCommit,
  type EditorOverwriteCommit,
} from "../EditorExport.service";
import {
  createEditorExportInput,
  createEditorExportProject,
  createEditorMediaAsset,
  createEditorProject,
  createEditorTimelineClip,
} from "./Editor.test-factories";

function createService(
  input: {
    persistProjectSnapshot?: (project: EditorProject) => EditorProject;
    onExportVideoCommitted?: (commit: EditorExportVideoCommit) => void;
    onOverwriteAccountingFailed?: (commit: EditorOverwriteCommit) => void;
    onOverwriteCommitted?: (commit: EditorOverwriteCommit) => void;
    removeExportFile?: typeof rm;
    renameExportFile?: typeof import("node:fs/promises").rename;
    renderExportWithFfmpeg?: (input: { outputPath: string }) => Promise<void>;
    sourcePath?: string;
    storageRoot?: string;
  } = {},
) {
  return new EditorExportService({
    createExportClips: (clips: EditorExportClipInput[]) =>
      clips.map((clip) => ({
        ...clip,
        source: { path: `${clip.source.id}.mp4` },
      })),
    createMediaUrl: (exportId) => `hinekora-editor-export://${exportId}`,
    persistProjectSnapshot:
      input.persistProjectSnapshot ?? ((project) => project),
    onExportVideoCommitted: input.onExportVideoCommitted ?? (() => undefined),
    ...(input.onOverwriteAccountingFailed
      ? { onOverwriteAccountingFailed: input.onOverwriteAccountingFailed }
      : {}),
    ...(input.onOverwriteCommitted
      ? { onOverwriteCommitted: input.onOverwriteCommitted }
      : {}),
    ...(input.removeExportFile
      ? { removeExportFile: input.removeExportFile }
      : {}),
    renderExportWithFfmpeg:
      input.renderExportWithFfmpeg ??
      (async ({ outputPath }) => writeFile(outputPath, "rendered")),
    ...(input.renameExportFile
      ? { renameExportFile: input.renameExportFile }
      : {}),
    resolveExportSource: (source) => ({
      path: input.sourcePath ?? `${source.id}.mp4`,
    }),
    resolveStorageRoot: () => input.storageRoot ?? process.cwd(),
    shutdownTimeoutMs: 100,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EditorExportService", () => {
  it("does not overwrite a clip outside the rendered video track", async () => {
    const firstAsset = createEditorMediaAsset();
    const secondAsset = createEditorMediaAsset({
      assetKey: "clip:clip-2",
      id: "clip-2",
      name: "second.mp4",
    });
    const firstClip = createEditorTimelineClip(firstAsset);
    const secondClip = createEditorTimelineClip(secondAsset, {
      id: "timeline-2",
      trackId: "video-track-2",
    });
    const project = createEditorProject({
      activeClipId: secondClip.id,
      assets: [firstAsset, secondAsset],
      tracks: [
        {
          clips: [firstClip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
        {
          clips: [secondClip],
          id: "video-track-2",
          kind: "video",
          label: "Secondary video",
        },
      ],
    });
    const renderExportWithFfmpeg = vi.fn();
    const service = createService({ renderExportWithFfmpeg });

    await expect(
      service.exportProject(
        createEditorExportInput({ mode: "overwrite", project }),
      ),
    ).rejects.toThrow("No overwrite source is available to export");
    expect(renderExportWithFfmpeg).not.toHaveBeenCalled();
  });

  it("publishes only a complete new-file render", async () => {
    const storageRoot = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    const onExportVideoCommitted = vi.fn();
    const service = createService({ onExportVideoCommitted, storageRoot });

    try {
      const result = await service.exportProject(createEditorExportInput());
      const outputDirectory = storageRoot;

      await expect(
        readFile(join(outputDirectory, result.fileName), "utf8"),
      ).resolves.toBe("rendered");
      await expect(readdir(outputDirectory)).resolves.toEqual([
        ".hinekora-editor-exports",
        result.fileName,
      ]);
      expect(onExportVideoCommitted).toHaveBeenCalledWith(
        expect.objectContaining({
          path: join(outputDirectory, result.fileName),
          projectId: "project-1",
          sizeBytes: result.sizeBytes,
          sizeDeltaBytes: result.sizeBytes,
        }),
      );
    } finally {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it("keeps a valid committed video when temporary cleanup is deferred", async () => {
    const storageRoot = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    const removeExportFile = vi.fn(async () => {
      throw new Error("file is locked");
    });
    const service = createService({ removeExportFile, storageRoot });

    try {
      const result = await service.exportProject(
        createEditorExportInput({ project: createEditorExportProject() }),
      );
      const outputDirectory = storageRoot;

      await expect(
        readFile(join(outputDirectory, result.fileName), "utf8"),
      ).resolves.toBe("rendered");
      expect(removeExportFile).toHaveBeenCalledTimes(1);
      expect(service.getExportLifecycle().status).toBe("ready");
    } finally {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it("removes a newly committed video when ownership registration fails", async () => {
    const storageRoot = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    const service = createService({
      onExportVideoCommitted: () => {
        throw new Error("ownership unavailable");
      },
      storageRoot,
    });

    try {
      await expect(
        service.exportProject(createEditorExportInput()),
      ).rejects.toThrow("ownership unavailable");
      await expect(readdir(storageRoot)).resolves.toEqual([
        ".hinekora-editor-exports",
      ]);
      expect(service.getExportLifecycle()).toMatchObject({
        error: "ownership unavailable",
        status: "failed",
      });
    } finally {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it("reports when a failed registration cannot roll back its committed video", async () => {
    const storageRoot = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    const outputPath = join(storageRoot, "source.mp4");
    const removeExportFile = vi.fn(
      async (
        path: Parameters<typeof rm>[0],
        options?: Parameters<typeof rm>[1],
      ) => {
        if (path === outputPath) {
          throw new Error("file is locked");
        }
        await rm(path, options);
      },
    );
    const service = createService({
      onExportVideoCommitted: () => {
        throw new Error("ownership unavailable");
      },
      removeExportFile,
      storageRoot,
    });

    try {
      await expect(
        service.exportProject(createEditorExportInput()),
      ).rejects.toThrow(
        "Video registration failed, and the saved file could not be removed",
      );
      await expect(readFile(outputPath, "utf8")).resolves.toBe("rendered");
    } finally {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it("keeps a committed overwrite successful and retries deferred accounting", async () => {
    vi.useFakeTimers();
    const storageRoot = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    const sourcePath = join(storageRoot, "original.mp4");
    await writeFile(sourcePath, "original");
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});
    const onOverwriteCommitted = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("database unavailable");
      })
      .mockImplementation(() => undefined);
    const renameExportFile = vi.fn().mockResolvedValue(undefined);
    const service = createService({
      onOverwriteCommitted,
      renameExportFile,
      sourcePath,
      storageRoot,
    });

    try {
      await expect(
        service.exportProject(
          createEditorExportInput({
            mode: "overwrite",
            project: createEditorExportProject(),
          }),
        ),
      ).resolves.toMatchObject({ mode: "overwrite" });
      expect(service.getExportLifecycle().status).toBe("ready");
      expect(onOverwriteCommitted).toHaveBeenCalledOnce();
      expect(logWarn).toHaveBeenCalledWith(
        "editor",
        "Editor overwrite accounting deferred",
        {
          error: "database unavailable",
          retryCount: 1,
          sourceKind: "clip",
        },
      );
      await vi.advanceTimersByTimeAsync(1_000);
      expect(onOverwriteCommitted).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it("runs overwrite accounting recovery after bounded retry exhaustion", async () => {
    vi.useFakeTimers();
    const storageRoot = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    const sourcePath = join(storageRoot, "original.mp4");
    await writeFile(sourcePath, "original");
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});
    const onOverwriteCommitted = vi.fn(() => {
      throw new Error("database unavailable");
    });
    const onOverwriteAccountingFailed = vi.fn();
    const service = createService({
      onOverwriteAccountingFailed,
      onOverwriteCommitted,
      renameExportFile: vi.fn().mockResolvedValue(undefined),
      sourcePath,
      storageRoot,
    });

    try {
      await expect(
        service.exportProject(
          createEditorExportInput({
            mode: "overwrite",
            project: createEditorExportProject(),
          }),
        ),
      ).resolves.toMatchObject({ mode: "overwrite" });

      for (let index = 0; index < 3; index += 1) {
        await vi.advanceTimersByTimeAsync(1_000);
      }
      await Promise.resolve();

      expect(onOverwriteCommitted).toHaveBeenCalledTimes(4);
      expect(onOverwriteAccountingFailed).toHaveBeenCalledWith({
        modifiedAtMs: expect.any(Number),
        sizeBytes: 8,
        source: { id: "clip-1", kind: "clip" },
      });
      expect(logWarn).toHaveBeenCalledWith(
        "editor",
        "Editor overwrite accounting failed",
        {
          error: "database unavailable",
          retryCount: 3,
          sourceKind: "clip",
        },
      );
    } finally {
      vi.useRealTimers();
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it("handles optional, failed, and cancelled overwrite accounting callbacks", async () => {
    const commit: EditorOverwriteCommit = {
      modifiedAtMs: 1,
      sizeBytes: 2,
      source: { id: "clip-1", kind: "clip" },
    };
    const optionalService = createService();
    const optionalInternals = optionalService as unknown as {
      noteOverwriteAccountingFailed: (value: EditorOverwriteCommit) => void;
      noteOverwriteCommitted: (value: EditorOverwriteCommit) => void;
    };

    expect(() =>
      optionalInternals.noteOverwriteCommitted(commit),
    ).not.toThrow();
    expect(() =>
      optionalInternals.noteOverwriteAccountingFailed(commit),
    ).not.toThrow();

    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});
    const failingRecoveryService = createService({
      onOverwriteAccountingFailed: () => {
        throw new Error("recovery unavailable");
      },
    });
    (
      failingRecoveryService as unknown as {
        noteOverwriteAccountingFailed: (value: EditorOverwriteCommit) => void;
      }
    ).noteOverwriteAccountingFailed(commit);
    await vi.waitFor(() => {
      expect(logWarn).toHaveBeenCalledWith(
        "editor",
        "Editor overwrite accounting recovery failed",
        { error: "recovery unavailable", sourceKind: "clip" },
      );
    });

    vi.useFakeTimers();
    const pendingService = createService({
      onOverwriteCommitted: () => {
        throw new Error("database unavailable");
      },
    });
    try {
      (
        pendingService as unknown as {
          noteOverwriteCommitted: (value: EditorOverwriteCommit) => void;
        }
      ).noteOverwriteCommitted(commit);
      expect(vi.getTimerCount()).toBe(1);

      await pendingService.shutdown();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves render cleanup failures in the export lifecycle", async () => {
    const storageRoot = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    const service = createService({
      renderExportWithFfmpeg: async ({ outputPath }) => {
        await writeFile(outputPath, "partial");
        throw new EditorTemporaryFileCleanupError(
          "Temporary filter files could not be removed",
        );
      },
      storageRoot,
    });

    try {
      await expect(
        service.exportProject(createEditorExportInput()),
      ).rejects.toThrow("Temporary filter files could not be removed");
      expect(service.getExportLifecycle()).toMatchObject({
        error: "Video saving failed, and temporary files could not be removed",
        status: "failed",
      });
    } finally {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });
});
