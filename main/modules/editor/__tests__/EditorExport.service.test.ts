import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  getPath: vi.fn<(name: string) => string>(() => process.cwd()),
}));

vi.mock("electron", () => ({
  app: { getPath: electronMocks.getPath },
}));

import type { EditorExportClipInput, EditorProject } from "../Editor.dto";
import { EditorTemporaryFileCleanupError } from "../Editor.files";
import { EditorExportService } from "../EditorExport.service";
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
    removeExportFile?: typeof rm;
    renderExportWithFfmpeg?: (input: { outputPath: string }) => Promise<void>;
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
    ...(input.removeExportFile
      ? { removeExportFile: input.removeExportFile }
      : {}),
    renderExportWithFfmpeg:
      input.renderExportWithFfmpeg ??
      (async ({ outputPath }) => writeFile(outputPath, "rendered")),
    resolveExportSource: (source) => ({ path: `${source.id}.mp4` }),
    shutdownTimeoutMs: 100,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  electronMocks.getPath.mockImplementation(() => process.cwd());
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
    const videosPath = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    electronMocks.getPath.mockImplementation((name) =>
      name === "videos" ? videosPath : tmpdir(),
    );
    const service = createService();

    try {
      const result = await service.exportProject(createEditorExportInput());
      const outputDirectory = join(videosPath, "Hinekora", "Exports");

      await expect(
        readFile(join(outputDirectory, result.fileName), "utf8"),
      ).resolves.toBe("rendered");
      await expect(readdir(outputDirectory)).resolves.toEqual([
        result.fileName,
      ]);
    } finally {
      await rm(videosPath, { force: true, recursive: true });
    }
  });

  it("keeps a valid committed video when temporary cleanup is deferred", async () => {
    const videosPath = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    electronMocks.getPath.mockImplementation((name) =>
      name === "videos" ? videosPath : tmpdir(),
    );
    const removeExportFile = vi.fn(async () => {
      throw new Error("file is locked");
    });
    const service = createService({ removeExportFile });

    try {
      const result = await service.exportProject(
        createEditorExportInput({ project: createEditorExportProject() }),
      );
      const outputDirectory = join(videosPath, "Hinekora", "Exports");

      await expect(
        readFile(join(outputDirectory, result.fileName), "utf8"),
      ).resolves.toBe("rendered");
      expect(removeExportFile).toHaveBeenCalledTimes(1);
      expect(service.getExportLifecycle().status).toBe("ready");
    } finally {
      await rm(videosPath, { force: true, recursive: true });
    }
  });

  it("preserves render cleanup failures in the export lifecycle", async () => {
    const videosPath = await mkdtemp(
      join(tmpdir(), "hinekora-export-service-"),
    );
    electronMocks.getPath.mockImplementation((name) =>
      name === "videos" ? videosPath : tmpdir(),
    );
    const service = createService({
      renderExportWithFfmpeg: async ({ outputPath }) => {
        await writeFile(outputPath, "partial");
        throw new EditorTemporaryFileCleanupError(
          "Temporary filter files could not be removed",
        );
      },
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
      await rm(videosPath, { force: true, recursive: true });
    }
  });
});
