import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReplayClipPreviewService } from "../ReplayClips.preview";
import * as ReplayRender from "../ReplayClips.render";

const electronMocks = vi.hoisted(() => ({ getPath: vi.fn() }));

vi.mock("electron", () => ({
  app: { getPath: electronMocks.getPath },
}));

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "hinekora-preview-service-"));
  electronMocks.getPath.mockReturnValue(root);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { force: true, recursive: true });
});

describe("ReplayClipPreviewService", () => {
  it("renders and reuses a bounded 720p preview proxy", async () => {
    const render = vi
      .spyOn(ReplayRender, "renderReplayClipQuickTrim")
      .mockImplementation(async (input) => {
        await writeFile(input.outputPath, "preview");
      });
    const service = new ReplayClipPreviewService();
    const onProgress = vi.fn();
    const input = {
      clipId: "clip-1",
      durationSeconds: 20,
      onProgress,
      sourcePath: join(root, "source.mp4"),
      version: "revision-1",
    };

    const first = await service.prepare(input);
    const repeated = await service.prepare(input);

    expect(first).toBe(repeated);
    expect(first && existsSync(first)).toBe(true);
    expect(service.getPath("clip-1")).toBe(first);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        queuePolicy: "preview",
        resolution: "720p",
        onProgress,
        trim: { inSeconds: 0, outSeconds: 20 },
      }),
    );

    await service.remove("clip-1");
    await service.remove("missing");
    expect(service.getPath("clip-1")).toBeNull();
    expect(first && existsSync(first)).toBe(false);
  });

  it("coalesces pending renders and replaces changed previews", async () => {
    let releaseRender!: () => void;
    const renderGate = new Promise<void>((resolve) => {
      releaseRender = resolve;
    });
    const render = vi
      .spyOn(ReplayRender, "renderReplayClipQuickTrim")
      .mockImplementationOnce(async (input) => {
        await renderGate;
        await writeFile(input.outputPath, "first");
      })
      .mockImplementation(async (input) => {
        await writeFile(input.outputPath, "second");
      });
    const service = new ReplayClipPreviewService();
    const first = service.prepare({
      clipId: "clip-1",
      durationSeconds: 20,
      sourcePath: join(root, "source.mp4"),
      version: "revision-1",
    });
    const changed = service.prepare({
      clipId: "clip-1",
      durationSeconds: 20,
      sourcePath: join(root, "source.mp4"),
      version: "revision-2",
    });

    releaseRender();
    const firstPath = await first;
    const changedPath = await changed;

    expect(render).toHaveBeenCalledTimes(2);
    expect(changedPath).not.toBe(firstPath);
    expect(firstPath && existsSync(firstPath)).toBe(false);
    expect(service.getPath("clip-1")).toBe(changedPath);
  });

  it("falls back cleanly when proxy rendering fails", async () => {
    vi.spyOn(ReplayRender, "renderReplayClipQuickTrim").mockRejectedValue(
      new Error("render failed"),
    );
    const service = new ReplayClipPreviewService();

    await expect(
      service.prepare({
        clipId: "clip-1",
        durationSeconds: 20,
        sourcePath: join(root, "source.mp4"),
        version: "revision-1",
      }),
    ).resolves.toBeNull();
    expect(service.getPath("clip-1")).toBeNull();
  });

  it("falls back from preview directory failures and retries initialization", async () => {
    const previewDirectory = join(root, "hinekora-clip-previews");
    await writeFile(previewDirectory, "not a directory");
    const render = vi
      .spyOn(ReplayRender, "renderReplayClipQuickTrim")
      .mockImplementation(async (input) => {
        await writeFile(input.outputPath, "preview");
      });
    const service = new ReplayClipPreviewService();
    const input = {
      clipId: "clip-1",
      durationSeconds: 20,
      sourcePath: join(root, "source.mp4"),
      version: "revision-1",
    };

    await expect(service.prepare(input)).resolves.toBeNull();
    expect(render).not.toHaveBeenCalled();

    await rm(previewDirectory, { force: true });
    await expect(service.prepare(input)).resolves.toEqual(expect.any(String));
    expect(render).toHaveBeenCalledOnce();
  });

  it("ignores preview cleanup failures", async () => {
    vi.spyOn(ReplayRender, "renderReplayClipQuickTrim").mockImplementation(
      async (input) => {
        await writeFile(input.outputPath, "preview");
      },
    );
    const removePreviewFile = vi.fn().mockRejectedValue(new Error("locked"));
    const service = new ReplayClipPreviewService(removePreviewFile);
    await service.prepare({
      clipId: "clip-1",
      durationSeconds: 20,
      sourcePath: join(root, "source.mp4"),
      version: "revision-1",
    });

    await expect(service.remove("clip-1")).resolves.toBeUndefined();
    expect(removePreviewFile).toHaveBeenCalledOnce();
  });

  it("removes orphaned and least-recently-created preview files", async () => {
    const previewDirectory = join(root, "hinekora-clip-previews");
    await mkdir(previewDirectory, { recursive: true });
    const orphanPath = join(previewDirectory, "orphan.mp4");
    await writeFile(orphanPath, "orphan");
    vi.spyOn(ReplayRender, "renderReplayClipQuickTrim").mockImplementation(
      async (input) => {
        await writeFile(input.outputPath, "preview");
      },
    );
    const service = new ReplayClipPreviewService();
    const paths: Array<string | null> = [];
    for (let index = 0; index < 9; index += 1) {
      paths.push(
        await service.prepare({
          clipId: `clip-${index}`,
          durationSeconds: 10 + index,
          sourcePath: join(root, `source-${index}.mp4`),
          version: `revision-${index}`,
        }),
      );
    }

    expect(existsSync(orphanPath)).toBe(false);
    expect(service.getPath("clip-0")).toBeNull();
    expect(paths[0] && existsSync(paths[0])).toBe(false);
    expect(service.getPath("clip-8")).toBe(paths[8]);
  });
});
