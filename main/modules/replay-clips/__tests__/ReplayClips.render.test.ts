import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  copyRenderedFileToClipboard: vi.fn(),
  createEditorExportSegments: vi.fn(),
  createOutputPath: vi.fn(),
  renderEditorExportWithFfmpeg: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => "C:\\temp",
  },
}));
vi.mock("~/main/modules/editor/Editor.export", () => ({
  createEditorExportSegments: mocks.createEditorExportSegments,
}));
vi.mock("~/main/modules/editor/Editor.ffmpeg", () => ({
  renderEditorExportWithFfmpeg: mocks.renderEditorExportWithFfmpeg,
}));
vi.mock("~/main/modules/editor/Editor.files", () => ({
  cleanupEditorClipboardOutputDirectory: mocks.cleanup,
  createEditorClipboardOutputPath: mocks.createOutputPath,
}));
vi.mock("~/main/utils/rendered-file-clipboard", () => ({
  copyRenderedFileToClipboard: mocks.copyRenderedFileToClipboard,
}));

import {
  copyTrimmedReplayClipToClipboard,
  renderReplayClipQuickTrim,
} from "../ReplayClips.render";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createEditorExportSegments.mockReturnValue([{ segment: true }]);
  mocks.createOutputPath.mockResolvedValue("C:\\temp\\clip.mp4");
  mocks.copyRenderedFileToClipboard.mockImplementation(async (input) => {
    const outputPath = await input.createOutputPath();
    await input.render(outputPath);
    await input.cleanup(outputPath);
    return { ok: true, error: null };
  });
});

describe("ReplayClips.render", () => {
  it("renders quick trims with and without optional encoding controls", async () => {
    const onProgress = vi.fn();

    await renderReplayClipQuickTrim({
      muteAudio: true,
      onProgress,
      outputPath: "C:\\clips\\muted.mp4",
      sourcePath: "C:\\clips\\source.mp4",
      trim: { inSeconds: 1.111, outSeconds: 4.444 },
    });
    await renderReplayClipQuickTrim({
      outputPath: "C:\\clips\\plain.mp4",
      sourcePath: "C:\\clips\\source.mp4",
      trim: { inSeconds: 0, outSeconds: 2 },
    });

    expect(mocks.createEditorExportSegments).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          durationSeconds: 3.333,
          inSeconds: 1.111,
          outSeconds: 4.444,
        }),
      ],
      3.333,
    );
    expect(mocks.renderEditorExportWithFfmpeg).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        muteAudio: true,
        onProgress,
        resolution: "1080p",
      }),
    );
    expect(mocks.renderEditorExportWithFfmpeg).toHaveBeenNthCalledWith(2, {
      outputPath: "C:\\clips\\plain.mp4",
      resolution: "1080p",
      segments: [{ segment: true }],
    });
  });

  it("uses an injected clipboard renderer when provided", async () => {
    const render = vi.fn().mockResolvedValue(undefined);

    await expect(
      copyTrimmedReplayClipToClipboard({
        render,
        sourcePath: "C:\\clips\\source.mp4",
        trim: { inSeconds: 1, outSeconds: 2 },
      }),
    ).resolves.toEqual({ ok: true, error: null });
    expect(render).toHaveBeenCalledWith("C:\\temp\\clip.mp4");
  });

  it("renders the selected playback rate into the exported clip", async () => {
    await renderReplayClipQuickTrim({
      outputPath: "C:\\clips\\slow.mp4",
      playbackRate: 0.5,
      sourcePath: "C:\\clips\\source.mp4",
      trim: { inSeconds: 2, outSeconds: 5 },
    });

    expect(mocks.createEditorExportSegments).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          durationSeconds: 6,
          inSeconds: 2,
          outSeconds: 5,
          playbackRate: 0.5,
        }),
      ],
      6,
    );
  });

  it("falls back to quick-trim rendering with optional controls", async () => {
    const onProgress = vi.fn();

    await copyTrimmedReplayClipToClipboard({
      muteAudio: true,
      onProgress,
      sourcePath: "C:\\clips\\source.mp4",
      trim: { inSeconds: 2, outSeconds: 5 },
    });
    await copyTrimmedReplayClipToClipboard({
      sourcePath: "C:\\clips\\source.mp4",
      trim: { inSeconds: 0, outSeconds: 1 },
    });

    expect(mocks.renderEditorExportWithFfmpeg).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ muteAudio: true, onProgress }),
    );
    expect(mocks.renderEditorExportWithFfmpeg).toHaveBeenNthCalledWith(2, {
      outputPath: "C:\\temp\\clip.mp4",
      resolution: "1080p",
      segments: [{ segment: true }],
    });
  });
});
