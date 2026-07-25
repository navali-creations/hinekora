import { mkdir, opendir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoragePathKey } from "~/main/utils/storage-path-key";

import { createSavedVideosRetentionPlan } from "../SavedVideos.retention";

let root: string;
let firstRoot: string;
let secondRoot: string;

beforeEach(async () => {
  root = join(
    tmpdir(),
    `hinekora-saved-video-retention-${crypto.randomUUID()}`,
  );
  firstRoot = join(root, "first");
  secondRoot = join(root, "second");
  await Promise.all([
    mkdir(firstRoot, { recursive: true }),
    mkdir(secondRoot, { recursive: true }),
  ]);
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("saved video retention", () => {
  it("selects the oldest positive-size exports across roots", async () => {
    const oldestPath = join(secondRoot, "oldest.mp4");
    const tiedPath = join(firstRoot, "tied.mp4");
    const newestPath = join(firstRoot, "newest.mp4");
    const emptyPath = join(firstRoot, "empty.mp4");
    await Promise.all([
      writeFile(oldestPath, "123456"),
      writeFile(tiedPath, "123456"),
      writeFile(newestPath, "123456"),
      writeFile(emptyPath, ""),
    ]);
    await Promise.all([
      utimes(oldestPath, new Date(1_000), new Date(1_000)),
      utimes(tiedPath, new Date(1_000), new Date(1_000)),
      utimes(newestPath, new Date(3_000), new Date(3_000)),
    ]);

    const plan = await createSavedVideosRetentionPlan({
      limitBytes: 10,
      protectedPaths: [newestPath],
      roots: [firstRoot, secondRoot],
    });

    expect(plan).toMatchObject({
      hasMoreCandidates: false,
      isTruncated: false,
      targetUsageBytes: 9,
      usageBytes: 18,
    });
    expect(plan?.files.map((file) => createStoragePathKey(file.path))).toEqual(
      [oldestPath, tiedPath]
        .map(createStoragePathKey)
        .sort((left, right) => left.localeCompare(right)),
    );
  });

  it("bounds each pass and reports remaining candidates", async () => {
    const paths = await Promise.all(
      ["a.mp4", "b.mp4", "c.mp4"].map(async (name, index) => {
        const path = join(firstRoot, name);
        await writeFile(path, "1234");
        await utimes(path, new Date(index * 1_000), new Date(index * 1_000));
        return path;
      }),
    );

    const plan = await createSavedVideosRetentionPlan({
      batchSize: 1,
      limitBytes: 4,
      maxCandidates: 2,
      openDirectory: opendir,
      roots: [firstRoot],
    });

    expect(plan).toMatchObject({
      hasMoreCandidates: true,
      isTruncated: false,
      targetUsageBytes: 3,
      usageBytes: 12,
    });
    expect(plan?.files.map((file) => file.path)).toEqual(paths.slice(0, 2));
  });

  it("does not select files when usage is unlimited or below the limit", async () => {
    await writeFile(join(firstRoot, "saved.mp4"), "1234");

    await expect(
      createSavedVideosRetentionPlan({
        limitBytes: 0,
        roots: [firstRoot],
      }),
    ).resolves.toMatchObject({ files: [], targetUsageBytes: 0, usageBytes: 4 });
    await expect(
      createSavedVideosRetentionPlan({
        limitBytes: 10,
        maxEntries: 0,
        maxFiles: 0,
        roots: [firstRoot],
      }),
    ).resolves.toMatchObject({
      files: [],
      hasMoreCandidates: true,
      isTruncated: true,
    });
  });

  it("excludes files that are not owned by Hinekora", async () => {
    const ownedPath = join(firstRoot, "owned.mp4");
    const externalPath = join(firstRoot, "external.mp4");
    await Promise.all([
      writeFile(ownedPath, "1234"),
      writeFile(externalPath, "1234"),
    ]);

    const plan = await createSavedVideosRetentionPlan({
      isOwned: (file) => file.path === ownedPath,
      limitBytes: 1,
      roots: [firstRoot],
    });

    expect(plan).toMatchObject({ usageBytes: 4 });
    expect(plan?.files.map((file) => file.path)).toEqual([ownedPath]);
  });

  it("aborts an invalidated scan", async () => {
    await expect(
      createSavedVideosRetentionPlan({
        limitBytes: 1,
        roots: [firstRoot],
        shouldAbort: () => true,
      }),
    ).resolves.toBeNull();
  });
});
