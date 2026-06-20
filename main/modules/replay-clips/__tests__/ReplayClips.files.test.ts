import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import {
  resolveReplayClipFilePath,
  sanitizeReplayClipStoragePaths,
} from "../ReplayClips.files";

let root: string;
let outsideRoot: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hinekora-replay-root-"));
  outsideRoot = mkdtempSync(join(tmpdir(), "hinekora-replay-outside-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
  rmSync(outsideRoot, { force: true, recursive: true });
});

describe("Replay clip file policy", () => {
  it("accepts existing flat managed recording files", () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");

    expect(
      resolveReplayClipFilePath(path, {
        storageRoot: root,
        requireExistingFile: true,
        requireNonEmptyFile: true,
      }),
    ).toBe(resolve(path));
  });

  it("accepts legacy managed session recording files", () => {
    const directory = join(root, "Hinekora-2026-06-12_10-30-00");
    const path = join(directory, "recording.mkv");
    mkdirSync(directory);
    writeFileSync(path, "video");

    expect(
      resolveReplayClipFilePath(path, {
        storageRoot: root,
        requireExistingFile: true,
      }),
    ).toBe(resolve(path));
  });

  it("rejects outside paths even when the file exists", () => {
    const path = join(outsideRoot, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");

    expect(
      resolveReplayClipFilePath(path, {
        storageRoot: root,
        requireExistingFile: true,
      }),
    ).toBeNull();
  });

  it("rejects arbitrary files inside the recording root", () => {
    const path = join(root, "boss-fight.mp4");
    writeFileSync(path, "video");

    expect(
      resolveReplayClipFilePath(path, {
        storageRoot: root,
        requireExistingFile: true,
      }),
    ).toBeNull();
  });

  it("rejects empty files when media streaming requires content", () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "");

    expect(
      resolveReplayClipFilePath(path, {
        storageRoot: root,
        requireExistingFile: true,
        requireNonEmptyFile: true,
      }),
    ).toBeNull();
    expect(
      resolveReplayClipFilePath(path, {
        storageRoot: root,
        requireExistingFile: true,
      }),
    ).toBe(resolve(path));
  });

  it("rejects missing files and directories when an existing file is required", () => {
    const missingPath = join(root, "2026-06-12_10-31-00.mp4");
    const directoryPath = join(root, "Hinekora-2026-06-12_10-30-00");
    const managedDirectoryPath = join(root, "2026-06-12_10-30-00.mp4");
    mkdirSync(directoryPath);
    mkdirSync(managedDirectoryPath);

    expect(
      resolveReplayClipFilePath(missingPath, {
        storageRoot: root,
        requireExistingFile: true,
      }),
    ).toBeNull();
    expect(
      resolveReplayClipFilePath(directoryPath, {
        storageRoot: root,
        requireExistingFile: true,
      }),
    ).toBeNull();
    expect(
      resolveReplayClipFilePath(managedDirectoryPath, {
        storageRoot: root,
        requireExistingFile: true,
      }),
    ).toBeNull();
  });

  it("returns null if file metadata cannot be read", async () => {
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        existsSync: () => true,
        statSync: () => {
          throw new Error("stat failed");
        },
      };
    });
    try {
      const { resolveReplayClipFilePath: resolveWithFailingStat } =
        await import("../ReplayClips.files");

      expect(
        resolveWithFailingStat(join(root, "2026-06-12_10-30-00.mp4"), {
          storageRoot: root,
          requireExistingFile: true,
        }),
      ).toBeNull();
    } finally {
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });

  it("strips unsafe imported clip paths and marks pathless ready clips failed", () => {
    const unsafePath = join(outsideRoot, "2026-06-12_10-30-00.mp4");

    expect(
      sanitizeReplayClipStoragePaths(
        createReplayClip({
          originalObsPath: unsafePath,
          processedClipPath: unsafePath,
        }),
        root,
      ),
    ).toMatchObject({
      status: "failed",
      originalObsPath: null,
      processedClipPath: null,
      error: "Clip file path is outside managed recording storage",
    });
  });

  it("keeps clip status when at least one imported path remains usable", () => {
    const safePath = join(root, "2026-06-12_10-30-00.mp4");
    const unsafePath = join(outsideRoot, "2026-06-12_10-30-00.mp4");

    expect(
      sanitizeReplayClipStoragePaths(
        createReplayClip({
          originalObsPath: unsafePath,
          processedClipPath: safePath,
          status: "ready",
        }),
        root,
      ),
    ).toMatchObject({
      status: "ready",
      originalObsPath: null,
      processedClipPath: resolve(safePath),
      error: null,
    });
  });
});
