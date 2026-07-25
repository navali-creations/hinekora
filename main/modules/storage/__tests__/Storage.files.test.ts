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
  collectStorageRootInventory,
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
  it("collects managed media, temporary files, and delete candidates", async () => {
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

    await expect(
      collectStorageRootInventory(join(root, "missing"), new Set()),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [],
      temporaryFiles: [],
    });
    await expect(
      collectStorageRootInventory(managedPath, new Set()),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [],
      temporaryFiles: [],
    });
    await expect(
      collectStorageRootInventory(storageRoot, new Set([resolve(managedPath)])),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [{ path: resolve(managedPath), size: 3 }],
      temporaryFiles: [{ path: resolve(temporaryPath), size: 9 }],
    });
    await expect(
      collectStorageRootInventory(
        storageRoot,
        new Set([resolve(temporaryPath)]),
      ),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [{ path: resolve(managedPath), size: 3 }],
      temporaryFiles: [],
    });
    await expect(
      collectStorageRootInventory(storageRoot, new Set(), [nestedDirectory]),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [{ path: resolve(managedPath), size: 3 }],
      temporaryFiles: [],
    });
    await expect(
      collectStorageRootInventory(storageRoot, new Set(), [storageRoot]),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [],
      temporaryFiles: [],
    });
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
    ).toEqual([{ path: resolve(emptyManagedPath), size: 0 }]);
  });

  it("calculates sizes, database sidecars, and resolutions", async () => {
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
    await expect(calculatePathSize(join(root, "missing"))).resolves.toBe(0);
    await expect(calculatePathSize(managedPath)).resolves.toBe(3);
    await expect(calculatePathSize(storageRoot)).resolves.toBe(3);
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

  it("batches large directories and cancels at asynchronous scan boundaries", async () => {
    const batchRoot = join(root, "batch");
    mkdirSync(batchRoot);
    for (let index = 0; index < 65; index += 1) {
      writeFileSync(join(batchRoot, `${index}.tmp`), "x");
    }

    await expect(
      collectStorageRootInventory(batchRoot, new Set()),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [],
      temporaryFiles: expect.arrayContaining([
        expect.objectContaining({ size: 1 }),
      ]),
    });

    const abortOnCheck = (targetCheck: number) => {
      let checkCount = 0;
      return () => {
        checkCount += 1;
        return checkCount === targetCheck;
      };
    };
    await expect(
      calculatePathSize(batchRoot, abortOnCheck(2)),
    ).resolves.toBeNull();
    await expect(
      collectStorageRootInventory(batchRoot, new Set(), [], abortOnCheck(2)),
    ).resolves.toBeNull();
    await expect(
      collectStorageRootInventory(batchRoot, new Set(), [], abortOnCheck(66)),
    ).resolves.toBeNull();

    const oneFileRoot = join(root, "one-file");
    mkdirSync(oneFileRoot);
    writeFileSync(join(oneFileRoot, "one.tmp"), "x");
    await expect(
      collectStorageRootInventory(oneFileRoot, new Set(), [], abortOnCheck(3)),
    ).resolves.toBeNull();
    await expect(
      collectStorageRootInventory(oneFileRoot, new Set(), [], abortOnCheck(4)),
    ).resolves.toBeNull();
    await expect(
      collectStorageRootInventory(oneFileRoot, new Set(), [], abortOnCheck(5)),
    ).resolves.toBeNull();
  });

  it("bounds recording-root inventory by entries and files", async () => {
    const boundedRoot = join(root, "bounded");
    mkdirSync(boundedRoot);
    for (let index = 0; index < 65; index += 1) {
      writeFileSync(join(boundedRoot, `${index}.tmp`), "x");
    }

    await expect(
      collectStorageRootInventory(boundedRoot, new Set(), [], () => false, {
        maxFiles: 1,
      }),
    ).resolves.toMatchObject({
      isTruncated: true,
      temporaryFiles: [{ path: join(boundedRoot, "0.tmp"), size: 1 }],
    });
    await expect(
      collectStorageRootInventory(boundedRoot, new Set(), [], () => false, {
        maxFiles: 64,
      }),
    ).resolves.toMatchObject({
      isTruncated: true,
      temporaryFiles: expect.arrayContaining([
        { path: join(boundedRoot, "0.tmp"), size: 1 },
      ]),
    });
    await expect(
      collectStorageRootInventory(boundedRoot, new Set(), [], () => false, {
        maxEntries: 0,
      }),
    ).resolves.toMatchObject({
      isTruncated: true,
      temporaryFiles: [],
    });
  });

  it("aborts at entry-limit and final scan boundaries", async () => {
    const boundedRoot = join(root, "abort-bounded");
    const emptyRoot = join(root, "abort-empty");
    mkdirSync(boundedRoot);
    mkdirSync(emptyRoot);
    writeFileSync(join(boundedRoot, "one.tmp"), "x");
    let entryAbortChecks = 0;
    await expect(
      collectStorageRootInventory(
        boundedRoot,
        new Set(),
        [],
        () => {
          entryAbortChecks += 1;
          return entryAbortChecks >= 3;
        },
        { maxEntries: 0 },
      ),
    ).resolves.toBeNull();

    let finalAbortChecks = 0;
    await expect(
      collectStorageRootInventory(emptyRoot, new Set(), [], () => {
        finalAbortChecks += 1;
        return finalAbortChecks >= 4;
      }),
    ).resolves.toBeNull();
  });

  it("handles defensive filesystem races while measuring storage", async () => {
    writeFileSync(join(storageRoot, "stat-throws.tmp"), "x");
    writeFileSync(join(storageRoot, "not-file-stat.tmp"), "x");
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        existsSync: () => true,
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
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();
      return {
        ...actual,
        opendir: async (path: string) => {
          if (path.includes("readdir-throws")) {
            throw new Error("readdir failed");
          }
          if (path.includes("non-file-entry")) {
            return {
              async *[Symbol.asyncIterator]() {
                yield {
                  isDirectory: () => false,
                  isFile: () => false,
                  name: "ignored",
                };
              },
              path,
            } as Awaited<ReturnType<typeof actual.opendir>>;
          }
          return actual.opendir(path);
        },
        stat: async (path: string) => {
          if (path.includes("stat-throws")) {
            throw new Error("stat failed");
          }
          if (path.includes("not-file-stat")) {
            return {
              isDirectory: () => false,
              isFile: () => false,
              size: 1,
            };
          }
          if (path.includes("not-file-or-dir")) {
            return {
              isDirectory: () => false,
              isFile: () => false,
              size: 0,
            };
          }
          if (path.includes("readdir-throws")) {
            return {
              isDirectory: () => true,
              isFile: () => false,
              size: 0,
            };
          }
          return actual.stat(path);
        },
      };
    });

    const {
      calculatePathSize: mockedCalculatePathSize,
      collectStorageRootInventory: mockedCollectStorageRootInventory,
      getStorageDeviceId: mockedGetStorageDeviceId,
      resolveManagedMediaPath: mockedResolveManagedMediaPath,
    } = await import("../Storage.files");

    expect(
      mockedResolveManagedMediaPath(
        join(storageRoot, "Full Recordings", "stat-throws.mp4"),
        storageRoot,
      ),
    ).toBeNull();
    await expect(mockedCalculatePathSize("not-file-or-dir")).resolves.toBe(0);
    await expect(mockedCalculatePathSize("readdir-throws")).resolves.toBe(0);
    await expect(
      mockedCalculatePathSize(storageRoot, () => true),
    ).resolves.toBeNull();
    expect(mockedGetStorageDeviceId(null)).toBeNull();
    expect(mockedGetStorageDeviceId("stat-throws")).toBeNull();
    await expect(
      mockedCollectStorageRootInventory("readdir-throws", new Set()),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [],
      temporaryFiles: [],
    });
    await expect(
      mockedCollectStorageRootInventory("non-file-entry", new Set()),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [],
      temporaryFiles: [],
    });
    await expect(
      mockedCollectStorageRootInventory(storageRoot, new Set()),
    ).resolves.toEqual({
      isTruncated: false,
      recordingFiles: [],
      temporaryFiles: [],
    });
  });
});
