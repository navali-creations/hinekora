import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import {
  calculateDatabaseSize,
  calculateDiskUsage,
  calculatePathSize,
  collectDeleteFiles,
  collectRecordingFiles,
  collectTemporaryFiles,
  getExistingFileSize,
  parseResolution,
  removeEmptyParentDirectories,
  resolveDatabaseFilePaths,
  resolveManagedMediaPath,
  sumFileSizes,
} from "../Storage.files";

let root: string;
let storageRoot: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hinekora-storage-files-"));
  storageRoot = join(root, "Hinekora Recordings");
  mkdirSync(storageRoot, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Storage.files", () => {
  it("collects managed media, temporary files, and delete candidates", () => {
    const fullRecordingDirectory = join(storageRoot, "Full Recordings");
    const nestedDirectory = join(storageRoot, "scratch");
    const managedPath = join(fullRecordingDirectory, "2026-06-12_10-30-00.mp4");
    const emptyManagedPath = join(
      fullRecordingDirectory,
      "2026-06-12_10-31-00.mp4",
    );
    const managedDirectoryPath = join(
      fullRecordingDirectory,
      "2026-06-12_10-32-00.mp4",
    );
    const missingManagedPath = join(
      fullRecordingDirectory,
      "2026-06-12_10-33-00.mp4",
    );
    const temporaryPath = join(nestedDirectory, "leftover.tmp");
    mkdirSync(fullRecordingDirectory, { recursive: true });
    mkdirSync(nestedDirectory, { recursive: true });
    mkdirSync(managedDirectoryPath);
    writeFileSync(managedPath, "run");
    writeFileSync(emptyManagedPath, "");
    writeFileSync(temporaryPath, "temporary");

    expect(collectRecordingFiles(join(root, "missing"))).toEqual([]);
    expect(collectRecordingFiles(managedPath)).toEqual([]);
    expect(collectRecordingFiles(storageRoot)).toEqual([
      { path: resolve(managedPath), size: 3 },
    ]);
    expect(collectTemporaryFiles(join(root, "missing"), new Set())).toEqual([]);
    expect(collectTemporaryFiles(managedPath, new Set())).toEqual([]);
    expect(
      collectTemporaryFiles(storageRoot, new Set([resolve(managedPath)])),
    ).toEqual([{ path: resolve(temporaryPath), size: 9 }]);
    expect(resolveManagedMediaPath(null, storageRoot)).toBeNull();
    expect(
      resolveManagedMediaPath(join(root, "outside.mp4"), storageRoot),
    ).toBe(null);
    expect(
      resolveManagedMediaPath(join(storageRoot, "missing.mp4"), storageRoot),
    ).toBeNull();
    expect(resolveManagedMediaPath(missingManagedPath, storageRoot)).toBeNull();
    expect(
      resolveManagedMediaPath(managedDirectoryPath, storageRoot),
    ).toBeNull();
    expect(
      collectDeleteFiles(
        [
          createReplayClip({
            originalObsPath: managedPath,
            processedClipPath: managedPath,
          }),
        ],
        [{ path: managedPath }, { path: join(root, "outside.mp4") }],
        storageRoot,
      ),
    ).toEqual([{ path: resolve(managedPath), size: 3 }]);
    expect(
      collectDeleteFiles(
        [],
        [{ path: join(root, "outside.mp4") }, { path: emptyManagedPath }],
        storageRoot,
      ),
    ).toEqual([]);
  });

  it("calculates sizes, database sidecars, and resolutions", () => {
    const fullRecordingDirectory = join(storageRoot, "Full Recordings");
    const managedPath = join(fullRecordingDirectory, "2026-06-12_10-30-00.mp4");
    const databasePath = join(root, "hinekora.sqlite");
    mkdirSync(fullRecordingDirectory, { recursive: true });
    writeFileSync(managedPath, "run");
    writeFileSync(databasePath, "db");
    writeFileSync(`${databasePath}-wal`, "wal");

    expect(calculateDatabaseSize(":memory:")).toBe(0);
    expect(resolveDatabaseFilePaths(":memory:")).toEqual([]);
    expect(calculateDatabaseSize(databasePath)).toBe(5);
    expect(resolveDatabaseFilePaths(databasePath)).toEqual([
      resolve(databasePath),
      resolve(`${databasePath}-wal`),
      resolve(`${databasePath}-shm`),
    ]);
    expect(calculateDiskUsage(join(root, "missing"))).toEqual({
      freeBytes: 0,
      totalBytes: 0,
    });
    expect(getExistingFileSize(join(root, "missing.mp4"))).toBe(0);
    expect(calculatePathSize(join(root, "missing"))).toBe(0);
    expect(calculatePathSize(managedPath)).toBe(3);
    expect(calculatePathSize(storageRoot)).toBe(3);
    expect(sumFileSizes([{ path: managedPath, size: 3 }])).toBe(3);
    expect(parseResolution(null)).toBeNull();
    expect(parseResolution("native")).toBeNull();
    expect(parseResolution("00x10")).toBeNull();
    expect(parseResolution("2560 x 1440")).toEqual({
      width: 2560,
      height: 1440,
    });
  });

  it("removes empty parent directories under the storage root", () => {
    const sessionDirectory = join(storageRoot, "Hinekora-2026-06-12_10-30-00");
    const managedPath = join(sessionDirectory, "2026-06-12_10-30-00.mp4");
    mkdirSync(sessionDirectory, { recursive: true });
    writeFileSync(managedPath, "run");

    removeEmptyParentDirectories(managedPath, storageRoot);
    expect(existsSync(sessionDirectory)).toBe(true);

    rmSync(managedPath);

    removeEmptyParentDirectories(managedPath, storageRoot);

    expect(existsSync(sessionDirectory)).toBe(false);
    expect(existsSync(storageRoot)).toBe(true);
  });

  it("handles defensive filesystem races while measuring storage", async () => {
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();
      const nonFileEntry = {
        isDirectory: () => false,
        isFile: () => false,
        name: "socket.mp4",
      };

      return {
        ...actual,
        existsSync: () => true,
        readdirSync: (path: string) => {
          if (path.includes("readdir-throws")) {
            throw new Error("readdir failed");
          }

          return [nonFileEntry];
        },
        statSync: (path: string) => {
          if (path.includes("stat-throws")) {
            throw new Error("stat failed");
          }
          if (path.includes("not-file-or-dir")) {
            return {
              isDirectory: () => false,
              isFile: () => false,
              size: 0,
            };
          }

          return {
            isDirectory: () => true,
            isFile: () => false,
            size: 0,
          };
        },
      };
    });

    const {
      calculatePathSize: mockedCalculatePathSize,
      collectTemporaryFiles: mockedCollectTemporaryFiles,
      resolveManagedMediaPath: mockedResolveManagedMediaPath,
    } = await import("../Storage.files");

    expect(
      mockedResolveManagedMediaPath(
        join(storageRoot, "Full Recordings", "stat-throws.mp4"),
        storageRoot,
      ),
    ).toBeNull();
    expect(mockedCalculatePathSize("not-file-or-dir")).toBe(0);
    expect(mockedCalculatePathSize("readdir-throws")).toBe(0);
    expect(mockedCalculatePathSize("directory-with-non-file")).toBe(0);
    expect(mockedCollectTemporaryFiles(storageRoot, new Set())).toEqual([]);
  });
});
