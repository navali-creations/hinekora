import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async () => {
  return {
    ...(await vi.importActual("node:fs/promises")),
    rm: vi.fn(),
  };
});

import * as FileClipboard from "./file-clipboard";
import { copyRenderedFileToClipboard } from "./rendered-file-clipboard";

describe("copyRenderedFileToClipboard", () => {
  it("returns a safe result when output path creation fails", async () => {
    const cleanup = vi.fn();
    const createOutputPath = vi
      .fn()
      .mockRejectedValue(new Error("temp path failed"));
    const onRenderFailed = vi.fn();
    const onRenderReady = vi.fn();
    const render = vi.fn();
    const copyFileToClipboard = vi.spyOn(FileClipboard, "copyFileToClipboard");

    await expect(
      copyRenderedFileToClipboard({
        cleanup,
        createOutputPath,
        onRenderFailed,
        onRenderReady,
        render,
      }),
    ).resolves.toEqual({ ok: false, error: "temp path failed" });

    expect(cleanup).not.toHaveBeenCalled();
    expect(copyFileToClipboard).not.toHaveBeenCalled();
    expect(onRenderFailed).not.toHaveBeenCalled();
    expect(onRenderReady).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it("invokes cleanup with a failed copy result and ignores cleanup errors", async () => {
    const outputPath = "C:/tmp/test-output.mp4";
    const createOutputPath = vi.fn().mockResolvedValue(outputPath);
    const onRenderFailed = vi.fn();
    const onCopyFailed = vi.fn();
    const onRenderReady = vi.fn();
    const onCleanupError = vi.fn();
    const onCopySucceeded = vi.fn();
    const render = vi.fn().mockResolvedValue(undefined);
    const _copyFileToClipboard = vi
      .spyOn(FileClipboard, "copyFileToClipboard")
      .mockResolvedValue({ ok: true, error: null });
    const cleanup = vi.fn().mockRejectedValue(new Error("cleanup failed"));

    const result = await copyRenderedFileToClipboard({
      createOutputPath,
      onRenderFailed,
      onCopyFailed,
      onRenderReady,
      onCleanupError,
      onCopySucceeded,
      render,
      cleanup,
    });

    expect(result).toEqual({ ok: true, error: null });
    expect(onRenderReady).toHaveBeenCalledWith(outputPath);
    expect(onCopyFailed).not.toHaveBeenCalled();
    expect(onCopySucceeded).toHaveBeenCalledWith(outputPath);
    expect(onRenderFailed).not.toHaveBeenCalled();
    expect(onCleanupError).toHaveBeenCalledWith(expect.any(Error), outputPath);
    expect(cleanup).toHaveBeenCalledWith(outputPath);
  });

  it("ignores cleanup failures when removing rendered files", async () => {
    const outputPath = "C:/tmp/rendered-output.mp4";
    const createOutputPath = vi.fn().mockResolvedValue(outputPath);
    const onRenderFailed = vi.fn();
    const onRenderReady = vi.fn();
    const render = vi.fn().mockImplementation(async () => {
      throw new Error("render failed");
    });
    const nodeFsPromises = (await import(
      "node:fs/promises"
    )) as typeof import("node:fs/promises");
    const rm = vi.mocked(nodeFsPromises.rm);
    rm.mockRejectedValueOnce(new Error("cleanup failed"));

    vi.spyOn(FileClipboard, "copyFileToClipboard");

    const result = await copyRenderedFileToClipboard({
      createOutputPath,
      onRenderFailed,
      onRenderReady,
      render,
      cleanup: () => Promise.resolve(),
    });

    expect(result).toEqual({ ok: false, error: "render failed" });
    expect(onRenderFailed).toHaveBeenCalledWith(expect.any(Error), outputPath);
    expect(onRenderReady).toHaveBeenCalledWith(outputPath);
    expect(rm).toHaveBeenCalledWith(
      outputPath,
      expect.objectContaining({ force: true }),
    );
    expect(rm).toHaveBeenCalled();
  });
});
