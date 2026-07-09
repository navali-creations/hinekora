import { describe, expect, it, vi } from "vitest";

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
});
