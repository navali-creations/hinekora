import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  calculateDiskUsage,
  collectRecordingFiles,
  removeEmptyParentDirectories,
} from "../RecordingStorage.files";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hinekora-recording-files-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("RecordingStorage.files", () => {
  it("calculates disk usage fallbacks", () => {
    expect(calculateDiskUsage(join(root, "missing"))).toEqual({
      freeBytes: 0,
      totalBytes: 0,
    });
    expect(calculateDiskUsage(root).totalBytes).toBeGreaterThan(0);
  });

  it("collects managed recording files and ignores invalid entries", () => {
    const nestedDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const managedPath = join(nestedDirectory, "2026-06-12_10-30-00.mkv");
    const ignoredPath = join(nestedDirectory, "notes.txt");
    const emptyPath = join(nestedDirectory, "2026-06-12_10-31-00.mp4");
    const managedDirectoryPath = join(
      nestedDirectory,
      "2026-06-12_10-32-00.mp4",
    );
    mkdirSync(nestedDirectory, { recursive: true });
    mkdirSync(managedDirectoryPath);
    writeFileSync(managedPath, "run");
    writeFileSync(ignoredPath, "ignore");
    writeFileSync(emptyPath, "");

    expect(collectRecordingFiles(join(root, "missing"))).toEqual([]);
    expect(collectRecordingFiles(managedPath)).toEqual([]);
    expect(collectRecordingFiles(root)).toEqual([
      expect.objectContaining({ path: resolve(managedPath), size: 3 }),
    ]);
  });

  it("removes empty parent directories without crossing the storage root", () => {
    const nestedDirectory = join(root, "Hinekora-2026-06-12_10-30-00", "two");
    const managedPath = join(nestedDirectory, "2026-06-12_10-30-00.mp4");
    const siblingDirectory = join(root, "sibling");
    mkdirSync(nestedDirectory, { recursive: true });
    mkdirSync(siblingDirectory);
    writeFileSync(managedPath, "run");

    removeEmptyParentDirectories(managedPath, root);

    expect(collectRecordingFiles(root)).toEqual([
      expect.objectContaining({ path: resolve(managedPath), size: 3 }),
    ]);
    rmSync(managedPath);

    removeEmptyParentDirectories(managedPath, root);

    expect(existsSync(nestedDirectory)).toBe(false);
    expect(existsSync(siblingDirectory)).toBe(true);
  });
});
