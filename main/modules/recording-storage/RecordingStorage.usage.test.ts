import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import { createReplayClip } from "~/main/test/factories/replayClip";

import { RecordingStorageRepository } from "./RecordingStorage.repository";
import { calculateRecordingStorageUsage } from "./RecordingStorage.usage";

let database: DatabaseService;
let root: string;

beforeEach(async () => {
  database = new DatabaseService(":memory:");
  root = await mkdtemp(join(tmpdir(), "hinekora-recording-usage-"));
});

afterEach(async () => {
  database.close();
  await rm(root, { force: true, recursive: true });
});

describe("calculateRecordingStorageUsage", () => {
  it("cancels before reading repository pages", async () => {
    const replayClipsRepository = {
      listStorageEntriesPage: vi.fn(),
    } as unknown as ReplayClipsRepository;
    const recordingRepository = {
      listStorageEntriesPage: vi.fn(),
    } as unknown as RecordingStorageRepository;

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [],
        recordingRepository,
        replayClipsRepository,
        root,
        shouldAbort: () => true,
      }),
    ).resolves.toBeNull();
    expect(replayClipsRepository.listStorageEntriesPage).not.toHaveBeenCalled();
    expect(recordingRepository.listStorageEntriesPage).not.toHaveBeenCalled();
  });

  it.each([
    ["path ownership", 2],
    ["group construction", 3],
    ["group sizing", 4],
    ["file stat hydration", 5],
  ])("cancels during replay clip %s", async (_stage, abortOnCall) => {
    const sharedPath = join(root, "shared.mp4");
    const replayClipsRepository = {
      listStorageEntriesPage: () => [
        {
          createdAt: "2026-07-17T00:00:00.000Z",
          id: "multi-path",
          originalObsPath: sharedPath,
          processedClipPath: join(root, "processed.mp4"),
          sizeBytes: 8,
        },
        {
          createdAt: "2026-07-17T00:00:01.000Z",
          id: "shared-path",
          originalObsPath: null,
          processedClipPath: sharedPath,
          sizeBytes: 5,
        },
      ],
    } as unknown as ReplayClipsRepository;
    const recordingRepository = {
      listStorageEntriesPage: vi.fn(),
    } as unknown as RecordingStorageRepository;
    let abortCheckCount = 0;

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [],
        recordingRepository,
        replayClipsRepository,
        root,
        shouldAbort: () => {
          abortCheckCount += 1;
          return abortCheckCount === abortOnCall;
        },
      }),
    ).resolves.toBeNull();
    expect(recordingRepository.listStorageEntriesPage).not.toHaveBeenCalled();
  });

  it("streams libraries larger than one page without double-counting paths", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    const createdAt = "2026-07-17T00:00:00.000Z";

    database.transaction(() => {
      for (let index = 0; index < 501; index += 1) {
        replayClipsRepository.upsert(
          createReplayClip({
            createdAt,
            id: `clip-${String(index).padStart(3, "0")}`,
            processedClipPath: join(root, `clip-${index}.mp4`),
            sizeBytes: 1,
          }),
        );
        recordingRepository.upsertRunRecording({
          id: `recording-${index}`,
          path: join(root, `recording-${index}.mkv`),
          sourceGame: "poe2",
          sourceLeague: "Standard",
          startedAt: createdAt,
          stoppedAt: createdAt,
          mtimeMs: index,
          sizeBytes: 2,
        });
      }
    });

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [],
        recordingRepository,
        replayClipsRepository,
        root,
      }),
    ).resolves.toEqual({
      clipsSizeBytes: 501,
      recordingsSizeBytes: 1_002,
      exportVideosSizeBytes: 0,
      exportVideosUsageTruncated: false,
      usageBytes: 1_503,
    });
  });

  it("uses persisted clip sizes without touching managed files", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    const primaryPath = join(root, "processed.mp4");
    const originalPath = join(root, "original.mp4");

    replayClipsRepository.upsert(
      createReplayClip({
        id: "clip",
        originalObsPath: originalPath,
        processedClipPath: primaryPath,
        sizeBytes: 42,
      }),
    );

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [],
        recordingRepository,
        replayClipsRepository,
        root,
      }),
    ).resolves.toEqual({
      clipsSizeBytes: 42,
      recordingsSizeBytes: 0,
      exportVideosSizeBytes: 0,
      exportVideosUsageTruncated: false,
      usageBytes: 42,
    });
  });

  it("stats only overlapping non-identical clip path groups", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    const processedPath = join(root, "processed.mp4");
    const sharedPath = join(root, "shared.mp4");
    await writeFile(processedPath, "abc");
    await writeFile(sharedPath, "12345");

    replayClipsRepository.upsert(
      createReplayClip({
        id: "multi-path-clip",
        originalObsPath: sharedPath,
        processedClipPath: processedPath,
        sizeBytes: 8,
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "shared-path-clip",
        processedClipPath: sharedPath,
        sizeBytes: 5,
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "another-shared-path-clip",
        processedClipPath: sharedPath,
        sizeBytes: 4,
      }),
    );
    recordingRepository.upsertRunRecording({
      id: "shared-recording",
      path: sharedPath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-07-17T00:00:00.000Z",
      stoppedAt: "2026-07-17T00:00:00.000Z",
      mtimeMs: 1,
      sizeBytes: 5,
    });

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [],
        recordingRepository,
        replayClipsRepository,
        root,
      }),
    ).resolves.toEqual({
      clipsSizeBytes: 8,
      recordingsSizeBytes: 0,
      exportVideosSizeBytes: 0,
      exportVideosUsageTruncated: false,
      usageBytes: 8,
    });
  });

  it("ignores clips without managed paths and recordings outside the root", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    replayClipsRepository.upsert(
      createReplayClip({
        id: "pathless-clip",
        originalObsPath: null,
        processedClipPath: null,
        sizeBytes: 100,
      }),
    );
    recordingRepository.upsertRunRecording({
      id: "outside-recording",
      path: join(root, "..", "outside.mkv"),
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-07-17T00:00:00.000Z",
      stoppedAt: "2026-07-17T00:00:00.000Z",
      mtimeMs: 1,
      sizeBytes: 100,
    });

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [],
        recordingRepository,
        replayClipsRepository,
        root,
      }),
    ).resolves.toEqual({
      clipsSizeBytes: 0,
      recordingsSizeBytes: 0,
      exportVideosSizeBytes: 0,
      exportVideosUsageTruncated: false,
      usageBytes: 0,
    });
  });

  it("handles pathless rows and already-connected path groups from repository pages", async () => {
    const firstPath = join(root, "first.mp4");
    const secondPath = join(root, "second.mp4");
    const replayClipsRepository = {
      listStorageEntriesPage: () => [
        {
          createdAt: "2026-07-17T00:00:00.000Z",
          id: "pathless",
          originalObsPath: null,
          processedClipPath: null,
          sizeBytes: 100,
        },
        {
          createdAt: "2026-07-17T00:00:01.000Z",
          id: "clip-1",
          originalObsPath: firstPath,
          processedClipPath: secondPath,
          sizeBytes: 8,
        },
        {
          createdAt: "2026-07-17T00:00:02.000Z",
          id: "clip-2",
          originalObsPath: firstPath,
          processedClipPath: secondPath,
          sizeBytes: 5,
        },
      ],
    } as unknown as ReplayClipsRepository;
    const recordingRepository = {
      listStorageEntriesPage: () => [],
    } as unknown as RecordingStorageRepository;

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [],
        recordingRepository,
        replayClipsRepository,
        root,
      }),
    ).resolves.toEqual({
      clipsSizeBytes: 8,
      recordingsSizeBytes: 0,
      exportVideosSizeBytes: 0,
      exportVideosUsageTruncated: false,
      usageBytes: 8,
    });
  });

  it("counts saved edits in bounded batches without scanning nested folders", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    const savedEditsDirectory = join(root, "Saved Edits");
    await mkdir(join(savedEditsDirectory, "nested"), { recursive: true });
    await Promise.all(
      Array.from({ length: 65 }, (_, index) =>
        writeFile(join(savedEditsDirectory, `${index}.mp4`), "x"),
      ),
    );
    await writeFile(join(savedEditsDirectory, "nested", "ignored.mp4"), "xx");

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [savedEditsDirectory],
        recordingRepository,
        replayClipsRepository,
        root,
      }),
    ).resolves.toEqual({
      clipsSizeBytes: 0,
      recordingsSizeBytes: 0,
      exportVideosSizeBytes: 65,
      exportVideosUsageTruncated: false,
      usageBytes: 0,
    });
  });

  it("reports partial export usage when the shared inventory cap is reached", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    const exportsDirectory = join(root, "exports");
    await mkdir(exportsDirectory);
    await Promise.all([
      writeFile(join(exportsDirectory, "one.mp4"), "1"),
      writeFile(join(exportsDirectory, "two.mp4"), "2"),
    ]);

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [exportsDirectory],
        maxExportFiles: 1,
        recordingRepository,
        replayClipsRepository,
        root,
      }),
    ).resolves.toMatchObject({
      exportVideosSizeBytes: 1,
      exportVideosUsageTruncated: true,
    });
  });

  it("surfaces an invalid saved edits directory", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    await writeFile(join(root, "Saved Edits"), "not a directory");

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [join(root, "Saved Edits")],
        recordingRepository,
        replayClipsRepository,
        root,
      }),
    ).rejects.toThrow();
  });

  it.each([
    ["before scanning saved edits", 3, 1],
    ["at a full stat batch", 4, 64],
    ["before the final stat batch", 4, 1],
  ])("cancels %s", async (_stage, abortOnCall, fileCount) => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    const savedEditsDirectory = join(root, "Saved Edits");
    await mkdir(savedEditsDirectory);
    await Promise.all(
      Array.from({ length: fileCount }, (_, index) =>
        writeFile(join(savedEditsDirectory, `${index}.mp4`), "x"),
      ),
    );
    let abortCheckCount = 0;

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [savedEditsDirectory],
        recordingRepository,
        replayClipsRepository,
        root,
        shouldAbort: () => {
          abortCheckCount += 1;
          return abortCheckCount === abortOnCall;
        },
      }),
    ).resolves.toBeNull();
  });

  it("tolerates saved edit stat races and ignores non-files", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    const savedEditsDirectory = join(root, "Saved Edits");
    await mkdir(savedEditsDirectory);
    await writeFile(join(savedEditsDirectory, "race.mp4"), "x");
    const missingError = Object.assign(new Error("missing"), {
      code: "ENOENT",
    });

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [savedEditsDirectory],
        recordingRepository,
        replayClipsRepository,
        root,
        statFile: async () => {
          throw missingError;
        },
      }),
    ).resolves.toMatchObject({ exportVideosSizeBytes: 0 });
    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [savedEditsDirectory],
        recordingRepository,
        replayClipsRepository,
        root,
        statFile: async () => ({ isFile: () => false, size: 1 }),
      }),
    ).resolves.toMatchObject({ exportVideosSizeBytes: 0 });
  });

  it("surfaces saved edit stat failures", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    const savedEditsDirectory = join(root, "Saved Edits");
    await mkdir(savedEditsDirectory);
    await writeFile(join(savedEditsDirectory, "locked.mp4"), "x");

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [savedEditsDirectory],
        recordingRepository,
        replayClipsRepository,
        root,
        statFile: async () => {
          throw Object.assign(new Error("locked"), { code: "EACCES" });
        },
      }),
    ).rejects.toThrow("locked");
  });

  it("can cancel after checking an empty export-root list", async () => {
    const replayClipsRepository = new ReplayClipsRepository(database);
    const recordingRepository = new RecordingStorageRepository(database);
    let abortChecks = 0;

    await expect(
      calculateRecordingStorageUsage({
        exportRoots: [],
        recordingRepository,
        replayClipsRepository,
        root,
        shouldAbort: () => {
          abortChecks += 1;
          return abortChecks === 4;
        },
      }),
    ).resolves.toBeNull();
  });
});
