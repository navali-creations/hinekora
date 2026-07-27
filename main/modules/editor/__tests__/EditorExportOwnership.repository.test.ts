import { symlinkSync } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DatabaseService } from "~/main/modules/database";

import { EditorExportOwnershipRepository } from "../EditorExportOwnership.repository";

let database: DatabaseService | null = null;
let root: string | null = null;

afterEach(async () => {
  database?.close();
  database = null;
  if (root) {
    await rm(root, { force: true, recursive: true });
    root = null;
  }
});

describe("EditorExportOwnershipRepository", () => {
  it("round-trips native identities above JavaScript's safe integer range", () => {
    database = new DatabaseService(":memory:");
    const repository = new EditorExportOwnershipRepository(database);
    const inode = 9_570_149_209_367_624;

    repository.upsert({
      deviceId: 123,
      inode,
      modifiedAtMs: 1_000,
      path: "C:\\Exports\\saved.mp4",
      sizeBytes: 456,
    });

    expect(repository.list()).toEqual([
      {
        deviceId: 123,
        inode,
        modifiedAtMs: 1_000,
        path: "C:\\Exports\\saved.mp4",
        sizeBytes: 456,
      },
    ]);
  });

  it("removes stored rows through physical path aliases", async () => {
    root = join(
      tmpdir(),
      `hinekora-editor-export-ownership-${crypto.randomUUID()}`,
    );
    const physicalRoot = join(root, "physical");
    const aliasRoot = join(root, "alias");
    await mkdir(physicalRoot, { recursive: true });
    symlinkSync(
      physicalRoot,
      aliasRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    const aliasedPath = join(aliasRoot, "saved.mp4");
    await writeFile(aliasedPath, "saved");
    const stats = await stat(aliasedPath);
    database = new DatabaseService(":memory:");
    const repository = new EditorExportOwnershipRepository(database);

    repository.upsert({
      deviceId: stats.dev,
      inode: stats.ino,
      modifiedAtMs: stats.mtimeMs,
      path: aliasedPath,
      sizeBytes: stats.size,
    });
    repository.remove(join(physicalRoot, "saved.mp4"));

    expect(repository.list()).toEqual([]);
  });

  it("prunes rows for missing or replaced exports after a complete scan", async () => {
    root = join(
      tmpdir(),
      `hinekora-editor-export-ownership-${crypto.randomUUID()}`,
    );
    await mkdir(root, { recursive: true });
    const keptPath = join(root, "kept.mp4");
    const replacedPath = join(root, "replaced.mp4");
    await Promise.all([
      writeFile(keptPath, "kept"),
      writeFile(replacedPath, "replacement"),
    ]);
    const keptStats = await stat(keptPath);
    const replacedStats = await stat(replacedPath);
    database = new DatabaseService(":memory:");
    const repository = new EditorExportOwnershipRepository(database);

    repository.upsert({
      deviceId: keptStats.dev,
      inode: keptStats.ino,
      modifiedAtMs: keptStats.mtimeMs,
      path: keptPath,
      sizeBytes: keptStats.size,
    });
    repository.upsert({
      deviceId: replacedStats.dev,
      inode: replacedStats.ino,
      modifiedAtMs: replacedStats.mtimeMs,
      path: replacedPath,
      sizeBytes: replacedStats.size + 1,
    });
    repository.upsert({
      deviceId: 0,
      inode: 0,
      modifiedAtMs: 1_000,
      path: join(root, "missing.mp4"),
      sizeBytes: 1,
    });

    expect(
      repository.pruneStale([
        {
          deviceId: keptStats.dev,
          inode: keptStats.ino,
          modifiedAt: keptStats.mtime,
          path: keptPath,
          sizeBytes: keptStats.size,
        },
        {
          deviceId: replacedStats.dev,
          inode: replacedStats.ino,
          modifiedAt: replacedStats.mtime,
          path: replacedPath,
          sizeBytes: replacedStats.size,
        },
      ]),
    ).toBe(2);

    expect(repository.list()).toEqual([
      expect.objectContaining({ path: keptPath }),
    ]);
  });
});
