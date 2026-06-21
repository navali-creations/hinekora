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
  calculateDatabaseSize,
  calculateDiskUsage,
  collectRecordingFiles,
  createProtectedDirectories,
  createProtectedPathSet,
  removeEmptyParentDirectories,
  sumExistingFileSizes,
} from "../RecordingStorage.files";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hinekora-recording-files-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("RecordingStorage.files", () => {
  it("calculates database and disk usage fallbacks", () => {
    const databasePath = join(root, "hinekora.sqlite");
    writeFileSync(databasePath, "db");
    writeFileSync(`${databasePath}-wal`, "wal");
    mkdirSync(join(root, "not-a-file.sqlite"));

    expect(calculateDatabaseSize(":memory:")).toBe(0);
    expect(calculateDatabaseSize(join(root, "missing.sqlite"))).toBe(0);
    expect(calculateDatabaseSize(join(root, "not-a-file.sqlite"))).toBe(0);
    expect(calculateDatabaseSize(databasePath)).toBe(5);
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

  it("normalizes protected paths and sums existing files", () => {
    const managedPath = join(root, "2026-06-12_10-30-00.mp4");
    const emptyPath = join(root, "2026-06-12_10-31-00.mp4");
    const clipDirectoryPath = join(root, "2026-06-12_10-32-00.mp4");
    writeFileSync(managedPath, "run");
    writeFileSync(emptyPath, "");
    mkdirSync(clipDirectoryPath);

    expect(sumExistingFileSizes(new Set([managedPath, emptyPath]))).toBe(3);
    expect(sumExistingFileSizes(new Set([emptyPath, clipDirectoryPath]))).toBe(
      0,
    );
    expect(createProtectedPathSet([managedPath, "", managedPath])).toEqual(
      new Set([resolve(managedPath)]),
    );
    expect(createProtectedPathSet()).toEqual(new Set());
    expect(createProtectedDirectories([clipDirectoryPath, ""])).toEqual([
      resolve(clipDirectoryPath),
    ]);
    expect(createProtectedDirectories()).toEqual([]);
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
