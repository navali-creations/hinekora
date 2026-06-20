import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { copyFileToClipboard } from "./file-clipboard";

let root: string | null = null;

function createTempVideo(): string {
  root = mkdtempSync(join(tmpdir(), "hinekora-file-clipboard-"));
  const path = join(root, "clip.mp4");
  writeFileSync(path, "video");

  return path;
}

afterEach(() => {
  if (root) {
    rmSync(root, { force: true, recursive: true });
    root = null;
  }
});

describe("copyFileToClipboard", () => {
  it("returns an error when the file does not exist", async () => {
    await expect(
      copyFileToClipboard("missing.mp4", {
        exists: () => false,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Video file is not available",
    });
  });

  it("uses Windows file-drop clipboard semantics for video files", async () => {
    const path = createTempVideo();
    const spawnSync = vi.fn(() => ({
      output: [],
      pid: 1,
      signal: null,
      status: 0,
      stderr: "",
      stdout: "",
    }));

    await expect(
      copyFileToClipboard(path, {
        platform: "win32",
        spawnSync,
      }),
    ).resolves.toEqual({ ok: true, error: null });
    expect(spawnSync).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        "-STA",
        "-Command",
        expect.stringContaining("SetFileDropList"),
      ]),
      expect.objectContaining({
        env: expect.objectContaining({
          HINEKORA_CLIPBOARD_FILE_B64: Buffer.from(
            resolve(path),
            "utf8",
          ).toString("base64"),
        }),
        windowsHide: true,
      }),
    );
  });

  it("returns a generic error when Windows clipboard setup fails", async () => {
    const path = createTempVideo();
    const spawnSync = vi.fn(() => ({
      output: [],
      pid: 1,
      signal: null,
      status: 1,
      stderr: "path specific failure",
      stdout: "",
    }));

    await expect(
      copyFileToClipboard(path, {
        platform: "win32",
        spawnSync,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Could not copy file to clipboard",
    });
  });

  it("sanitizes Windows clipboard diagnostics", async () => {
    const path = createTempVideo();
    const resolvedPath = resolve(path);
    const alternatePath = resolvedPath.includes("\\")
      ? resolvedPath.replace(/\\/g, "/")
      : resolvedPath.replace(/\//g, "\\");
    const spawnSync = vi.fn(() => ({
      error: new Error("spawn failed"),
      output: [],
      pid: 1,
      signal: "SIGTERM" as const,
      status: null,
      stderr: `failed for ${resolvedPath}`,
      stdout: `alternate ${alternatePath}`,
    }));

    await expect(
      copyFileToClipboard(path, {
        platform: "win32",
        spawnSync,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Could not copy file to clipboard",
    });
  });

  it("falls back to copying the path text on non-Windows platforms", async () => {
    const path = createTempVideo();
    const writeText = vi.fn();

    await expect(
      copyFileToClipboard(path, {
        platform: "linux",
        writeText,
      }),
    ).resolves.toEqual({ ok: true, error: null });
    expect(writeText).toHaveBeenCalledWith(resolve(path));
  });

  it("uses the Electron clipboard fallback and handles fallback failures", async () => {
    const path = createTempVideo();
    const electronClipboardWriteText = vi.fn();
    vi.doMock("electron", () => ({
      clipboard: {
        writeText: electronClipboardWriteText,
      },
    }));

    await expect(
      copyFileToClipboard(path, {
        platform: "linux",
      }),
    ).resolves.toEqual({ ok: true, error: null });
    expect(electronClipboardWriteText).toHaveBeenCalledWith(resolve(path));
    await expect(
      copyFileToClipboard(path, {
        platform: "linux",
        writeText: () => {
          throw new Error("clipboard failed");
        },
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Could not copy file to clipboard",
    });
    await expect(
      copyFileToClipboard(path, {
        platform: "linux",
        writeText: () => {
          throw "bad clipboard";
        },
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Could not copy file to clipboard",
    });
  });
});
