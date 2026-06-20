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

import {
  calculateDatabaseSize,
  calculateDiskUsage,
  collectManagedFiles,
  getExistingFileSize,
  isPathInsideOrEqual,
  removeEmptyParentDirectories,
  resolveDatabaseFilePaths,
} from "./storage-files";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hinekora-storage-utils-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("storage-files utils", () => {
  it("calculates database sidecars, file sizes, and disk fallback values", () => {
    const databasePath = join(root, "hinekora.sqlite");
    const dataPath = join(root, "data.bin");
    const emptyPath = join(root, "empty.bin");
    const directoryPath = join(root, "directory.bin");
    writeFileSync(databasePath, "db");
    writeFileSync(`${databasePath}-wal`, "wal");
    writeFileSync(dataPath, "data");
    writeFileSync(emptyPath, "");
    mkdirSync(directoryPath);

    expect(resolveDatabaseFilePaths(":memory:")).toEqual([]);
    expect(calculateDatabaseSize(":memory:")).toBe(0);
    expect(resolveDatabaseFilePaths(databasePath)).toEqual([
      resolve(databasePath),
      resolve(`${databasePath}-wal`),
      resolve(`${databasePath}-shm`),
    ]);
    expect(calculateDatabaseSize(databasePath)).toBe(5);
    expect(getExistingFileSize(dataPath)).toBe(4);
    expect(getExistingFileSize(emptyPath)).toBe(0);
    expect(getExistingFileSize(directoryPath)).toBe(0);
    expect(getExistingFileSize(join(root, "missing.bin"))).toBe(0);
    expect(calculateDiskUsage(join(root, "missing"))).toEqual({
      freeBytes: 0,
      totalBytes: 0,
    });
  });

  it("collects managed files and removes empty parents under a root", () => {
    const nestedDirectory = join(root, "nested", "two");
    const managedPath = join(nestedDirectory, "managed.mp4");
    const ignoredPath = join(nestedDirectory, "ignored.txt");
    const emptyPath = join(nestedDirectory, "empty.mp4");
    const managedDirectoryPath = join(nestedDirectory, "directory.mp4");
    mkdirSync(managedDirectoryPath, { recursive: true });
    writeFileSync(managedPath, "run");
    writeFileSync(ignoredPath, "ignored");
    writeFileSync(emptyPath, "");

    expect(collectManagedFiles(join(root, "missing"), () => true)).toEqual([]);
    expect(collectManagedFiles(managedPath, () => true)).toEqual([]);
    expect(
      collectManagedFiles(root, (_root, path) => path.endsWith(".mp4")),
    ).toEqual([
      expect.objectContaining({
        path: resolve(managedPath),
        size: 3,
      }),
    ]);

    removeEmptyParentDirectories(managedPath, root);
    expect(existsSync(nestedDirectory)).toBe(true);

    rmSync(managedPath);
    rmSync(emptyPath);
    rmSync(ignoredPath);
    rmSync(managedDirectoryPath, { recursive: true });
    removeEmptyParentDirectories(managedPath, root);
    expect(existsSync(nestedDirectory)).toBe(false);
    expect(existsSync(root)).toBe(true);
  });

  it("checks child paths without accepting sibling traversal", () => {
    const storageRoot = join(root, "Hinekora Recordings");

    expect(isPathInsideOrEqual(storageRoot, storageRoot)).toBe(true);
    expect(
      isPathInsideOrEqual(storageRoot, join(storageRoot, "clip.mp4")),
    ).toBe(true);
    expect(isPathInsideOrEqual(storageRoot, join(root, "outside.mp4"))).toBe(
      false,
    );
  });

  it("ignores filesystem races while collecting managed files", async () => {
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        existsSync: () => true,
        readdirSync: () => [
          {
            isDirectory: () => false,
            isFile: () => false,
            name: "socket.mp4",
          },
          {
            isDirectory: () => false,
            isFile: () => true,
            name: "stat-throws.mp4",
          },
        ],
        statSync: () => {
          throw new Error("stat failed");
        },
      };
    });

    const { collectManagedFiles: mockedCollectManagedFiles } = await import(
      "./storage-files"
    );

    expect(mockedCollectManagedFiles(root, () => true)).toEqual([]);
  });
});
