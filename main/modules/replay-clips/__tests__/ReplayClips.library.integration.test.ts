import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import { ReplayClipsRepository } from "../ReplayClips.repository";
import {
  repository,
  root,
  service,
  setupReplayClipsServiceTestHarness,
} from "./ReplayClips.service.test-harness";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  getPath: vi.fn(),
  isProtocolHandled: vi.fn(),
  netFetch: vi.fn(),
  openPath: vi.fn(),
  protocolHandle: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: electronMocks.getPath },
  BrowserWindow: { getAllWindows: electronMocks.getAllWindows },
  net: { fetch: electronMocks.netFetch },
  protocol: {
    handle: electronMocks.protocolHandle,
    isProtocolHandled: electronMocks.isProtocolHandled,
  },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

setupReplayClipsServiceTestHarness(electronMocks);

describe("Replay clip library integration", () => {
  it("lists paged replay details for the editor media rail", async () => {
    const path = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(path, "clip-data");
    const presentClip = createReplayClip({
      id: "clip-1",
      kind: "death",
      originalObsPath: path,
      processedClipPath: path,
      sizeBytes: 9,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      createdAt: "2026-06-12T10:00:00.000Z",
    });
    repository.upsert(presentClip);
    const missingMediaClip = createReplayClip({
      id: "missing-media",
      kind: "death",
      originalObsPath: join(root, "missing.mp4"),
      processedClipPath: null,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      createdAt: "2026-06-12T11:00:00.000Z",
    });
    repository.upsert(missingMediaClip);
    const staleSizeClip = createReplayClip({
      id: "stale-size",
      kind: "death",
      originalObsPath: join(root, "stale-size.mp4"),
      processedClipPath: null,
      sizeBytes: 4096,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      createdAt: "2026-06-12T12:00:00.000Z",
    });
    repository.upsert(staleSizeClip);

    const editorPage = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 10,
    });

    expect(editorPage).toEqual({
      items: [
        {
          clip: expect.objectContaining({ id: "clip-1", sizeBytes: 9 }),
          durationSeconds: null,
          mediaUrl: expect.stringMatching(
            /^hinekora-media:\/\/replay-clip\/clip-1\?v=/,
          ),
        },
      ],
      totalCount: 1,
    });
    expect(
      (
        await service.listEditorReplayDetailPage({
          game: "poe2",
          kind: "death",
          league: "Standard",
          pageIndex: 0,
          pageSize: 10,
        })
      ).items,
    ).toHaveLength(1);
    expect(
      await service.listEditorReplayDetailPage({
        createdAfter: "2026-06-12T10:30:00.000Z",
        excludeIds: [presentClip.id],
        includeIds: [presentClip.id, missingMediaClip.id],
        kind: "death",
        pageIndex: 0,
        pageSize: 10,
      }),
    ).toEqual({ items: [], totalCount: 0 });
    expect(repository.get("missing-media")?.sizeBytes).toBe(0);
    expect(repository.get("clip-1")?.sizeBytes).toBe(9);
    expect(repository.get("stale-size")?.sizeBytes).toBe(0);
  });

  it("fills editor replay pages by replacing stale rows", async () => {
    for (let index = 0; index < 6; index += 1) {
      repository.upsert(
        createReplayClip({
          id: `stale-${index}`,
          kind: "death",
          processedClipPath: join(root, `stale-${index}.mp4`),
          sizeBytes: 4096,
          createdAt: `2026-06-12T12:0${5 - index}:00.000Z`,
        }),
      );
    }
    const availableAlphaPath = join(root, "2026-06-12_10-01-00-death-10s.mp4");
    const availableBetaPath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availableAlphaPath, "alpha");
    writeFileSync(availableBetaPath, "beta");
    repository.upsert(
      createReplayClip({
        id: "available-alpha",
        kind: "death",
        processedClipPath: availableAlphaPath,
        sizeBytes: 5,
        createdAt: "2026-06-12T10:01:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "available-beta",
        kind: "death",
        processedClipPath: availableBetaPath,
        sizeBytes: 4,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );
    const listLibraryItemsSpy = vi.spyOn(
      ReplayClipsRepository.prototype,
      "listLibraryItems",
    );

    const page = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 5,
    });
    const nextPage = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 1,
      pageSize: 5,
    });

    expect(page.items.map((detail) => detail.clip.id)).toEqual([
      "available-alpha",
      "available-beta",
    ]);
    expect(page.totalCount).toBe(2);
    expect(nextPage.items).toEqual([]);
    expect(nextPage.totalCount).toBe(2);
    expect(listLibraryItemsSpy).toHaveBeenCalledTimes(2);
    expect(listLibraryItemsSpy).toHaveBeenNthCalledWith(1, {
      filter: {
        kind: "death",
        mediaPathOnly: true,
        positiveMediaOnly: true,
      },
      offset: 0,
      pageIndex: 0,
      pageSize: 100,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
    expect(listLibraryItemsSpy).toHaveBeenNthCalledWith(2, {
      filter: {
        kind: "death",
        mediaPathOnly: true,
        positiveMediaOnly: true,
      },
      offset: 5,
      pageIndex: 0,
      pageSize: 100,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
    expect(repository.get("stale-0")?.sizeBytes).toBe(0);
    expect(repository.get("stale-4")?.sizeBytes).toBe(0);
    expect(repository.get("stale-5")?.sizeBytes).toBe(0);
  });

  it("stops editor replay pages at the requested page size", async () => {
    const availablePath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "available-page-size",
        kind: "death",
        processedClipPath: availablePath,
        sizeBytes: 9,
      }),
    );

    const page = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 1,
    });

    expect(page.items.map((detail) => detail.clip.id)).toEqual([
      "available-page-size",
    ]);
    expect(page.totalCount).toBe(1);
  });

  it("skips already collected editor candidates after repairing a full page", async () => {
    repository.upsert(
      createReplayClip({
        id: "stale-front",
        kind: "death",
        processedClipPath: join(root, "stale-front.mp4"),
        sizeBytes: 4096,
        createdAt: "2026-06-12T12:00:00.000Z",
      }),
    );
    const availablePath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "available-after-repair",
        kind: "death",
        processedClipPath: availablePath,
        sizeBytes: 9,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );

    const page = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 2,
    });

    expect(page.items.map((detail) => detail.clip.id)).toEqual([
      "available-after-repair",
    ]);
    expect(page.totalCount).toBe(1);
    expect(repository.get("stale-front")?.sizeBytes).toBe(0);
  });

  it("keeps editor replay pages from landing empty after many stale rows", async () => {
    for (let index = 0; index < 55; index += 1) {
      repository.upsert(
        createReplayClip({
          id: `stale-bulk-${index}`,
          kind: "death",
          processedClipPath: join(root, `stale-bulk-${index}.mp4`),
          sizeBytes: 4096,
          createdAt: new Date(
            Date.parse("2026-06-12T12:00:00.000Z") - index * 1_000,
          ).toISOString(),
        }),
      );
    }
    const availablePath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "available-after-stale",
        kind: "death",
        processedClipPath: availablePath,
        sizeBytes: 9,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );

    const page = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 5,
    });

    expect(page.items.map((detail) => detail.clip.id)).toEqual([
      "available-after-stale",
    ]);
    expect(page.totalCount).toBe(1);
    expect(repository.get("stale-bulk-0")?.sizeBytes).toBe(0);
    expect(repository.get("stale-bulk-54")?.sizeBytes).toBe(0);
  });

  it("advances editor replay repair in bounded validation windows", async () => {
    for (let index = 0; index < 501; index += 1) {
      repository.upsert(
        createReplayClip({
          id: `stale-window-${index}`,
          kind: "death",
          processedClipPath: join(root, `stale-window-${index}.mp4`),
          sizeBytes: 4096,
          createdAt: new Date(
            Date.parse("2026-06-12T12:00:00.000Z") - index * 1_000,
          ).toISOString(),
        }),
      );
    }
    const availablePath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "available-after-validation-window",
        kind: "death",
        processedClipPath: availablePath,
        sizeBytes: 9,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );

    const firstPage = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 7,
    });
    const repairedPage = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 7,
    });

    expect(firstPage.items).toEqual([]);
    expect(firstPage.totalCount).toBe(402);
    expect(repairedPage.items).toEqual([]);
    expect(repairedPage.totalCount).toBe(302);
    expect(repository.get("stale-window-0")?.sizeBytes).toBe(0);
    expect(repository.get("stale-window-199")?.sizeBytes).toBe(0);
    expect(repository.get("stale-window-200")?.sizeBytes).toBe(4096);
  });

  it("does not scan from the first editor replay page for high page indexes", async () => {
    for (let index = 0; index < 10; index += 1) {
      repository.upsert(
        createReplayClip({
          id: `positive-candidate-${index}`,
          kind: "death",
          processedClipPath: join(root, `positive-candidate-${index}.mp4`),
          sizeBytes: 4096,
          createdAt: new Date(
            Date.parse("2026-06-12T12:00:00.000Z") - index * 1_000,
          ).toISOString(),
        }),
      );
    }
    const listLibraryItemsSpy = vi.spyOn(
      ReplayClipsRepository.prototype,
      "listLibraryItems",
    );

    const page = await service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 1000,
      pageSize: 5,
    });

    expect(page).toEqual({ items: [], totalCount: 10 });
    expect(listLibraryItemsSpy).toHaveBeenCalledTimes(1);
    expect(listLibraryItemsSpy).toHaveBeenCalledWith({
      filter: {
        kind: "death",
        mediaPathOnly: true,
        positiveMediaOnly: true,
      },
      offset: 5000,
      pageIndex: 0,
      pageSize: 100,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
  });

  it("delegates clip library filtering to the repository", async () => {
    repository.upsert(
      createReplayClip({ id: "death-clip", kind: "death", sourceGame: "poe2" }),
    );
    repository.upsert(
      createReplayClip({
        id: "manual-clip",
        kind: "manual",
        sourceGame: "poe2",
      }),
    );

    await expect(
      service.list({ game: "poe2", kind: "manual" }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "manual-clip", kind: "manual" }),
    ]);
  });

  it("returns paged clip library data sorted in the main process", async () => {
    const smallPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    const largePath = join(root, "2026-06-12_10-31-00-death-10s.mp4");
    writeFileSync(smallPath, "small");
    writeFileSync(largePath, "larger-clip");
    repository.upsert(
      createReplayClip({
        id: "small",
        kind: "death",
        sourceGame: "poe2",
        sourceLeague: "Standard",
        processedClipPath: smallPath,
        createdAt: "2026-06-12T10:30:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "large",
        kind: "death",
        sourceGame: "poe2",
        sourceLeague: "Hardcore",
        processedClipPath: largePath,
        createdAt: "2026-06-12T10:31:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "manual",
        kind: "manual",
        sourceGame: "poe2",
        sourceLeague: "Standard",
      }),
    );

    await expect(
      service.listLibrary({
        game: "poe2",
        kind: "death",
        pageIndex: 0,
        pageSize: 1,
        sortBy: "sizeBytes",
        sortDirection: "desc",
      }),
    ).resolves.toMatchObject({
      availableLeagues: ["Hardcore", "Standard"],
      pageCount: 2,
      pageIndex: 0,
      pageSize: 1,
      totalCount: 2,
      items: [expect.objectContaining({ id: "large", sizeBytes: 11 })],
    });
  });

  it("refreshes stale clip library sizes when media files are missing", async () => {
    const missingPath = join(root, "2026-06-12_10-32-00-death-10s.mp4");
    repository.upsert(
      createReplayClip({
        id: "stale-size",
        kind: "death",
        processedClipPath: missingPath,
        sizeBytes: 4096,
      }),
    );

    const page = await service.listLibrary({ kind: "death" });

    expect(page.items).toEqual([
      expect.objectContaining({ id: "stale-size", sizeBytes: 0 }),
    ]);
    expect(repository.get("stale-size")?.sizeBytes).toBe(0);
  });

  it("refreshes clip size from available media paths while ignoring stale alternates", async () => {
    const availablePath = join(root, "2026-06-12_10-33-00-death-10s.mp4");
    const missingPath = join(root, "2026-06-12_10-34-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "partially-stale-size",
        kind: "death",
        originalObsPath: missingPath,
        processedClipPath: availablePath,
        sizeBytes: 0,
      }),
    );

    const page = await service.listLibrary({ kind: "death" });

    expect(page.items).toEqual([
      expect.objectContaining({
        id: "partially-stale-size",
        sizeBytes: 9,
      }),
    ]);
    expect(repository.get("partially-stale-size")?.sizeBytes).toBe(9);
  });

  it("does not count directories as replay clip media", async () => {
    const directoryPath = join(root, "2026-06-12_10-35-00.mp4");
    mkdirSync(directoryPath);
    repository.upsert(
      createReplayClip({
        id: "directory-media",
        processedClipPath: directoryPath,
        sizeBytes: 4096,
      }),
    );

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({ id: "directory-media", sizeBytes: 0 }),
    ]);
    expect(repository.get("directory-media")?.sizeBytes).toBe(0);
  });

  it("repairs unusable editor media candidates asynchronously", async () => {
    const directoryPath = join(root, "2026-06-12_10-40-00.mp4");
    const emptyPath = join(root, "2026-06-12_10-41-00.mp4");
    const missingPath = join(root, "2026-06-12_10-42-00.mp4");
    mkdirSync(directoryPath);
    writeFileSync(emptyPath, "");
    for (const [id, path] of [
      ["directory", directoryPath],
      ["empty", emptyPath],
      ["missing", missingPath],
    ] as const) {
      repository.upsert(
        createReplayClip({ id, processedClipPath: path, sizeBytes: 4096 }),
      );
    }

    await expect(
      service.listEditorReplayDetailPage({
        kind: "death",
        pageIndex: 0,
        pageSize: 10,
      }),
    ).resolves.toEqual({ items: [], totalCount: 0 });
    expect(repository.get("directory")?.sizeBytes).toBe(0);
    expect(repository.get("empty")?.sizeBytes).toBe(0);
    expect(repository.get("missing")?.sizeBytes).toBe(0);
  });

  it("sorts clip library rows by display fields and applies query defaults", async () => {
    const alphaPath = join(root, "alpha-death.mp4");
    const betaPath = join(root, "beta-death.mp4");
    const missingPath = join(root, "missing-death.mp4");
    writeFileSync(alphaPath, "alpha");
    writeFileSync(betaPath, "beta");
    repository.upsert(
      createReplayClip({
        id: "alpha",
        kind: "death",
        sourceGame: "poe1",
        sourceLeague: "Alpha",
        processedClipPath: alphaPath,
        durationSeconds: 1,
        targetDurationSeconds: 30,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "beta",
        kind: "death",
        sourceGame: "poe1",
        sourceLeague: "Beta",
        processedClipPath: betaPath,
        targetDurationSeconds: 5,
        createdAt: "2026-06-12T10:01:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "missing-path",
        kind: "death",
        sourceGame: "poe1",
        sourceLeague: "Beta",
        processedClipPath: missingPath,
        targetDurationSeconds: 20,
        createdAt: "2026-06-12T10:02:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "no-path",
        kind: "death",
        sourceGame: "poe1",
        sourceLeague: "Gamma",
        processedClipPath: null,
        originalObsPath: null,
        targetDurationSeconds: 10,
        createdAt: "2026-06-12T10:03:00.000Z",
      }),
    );

    await expect(service.listLibrary()).resolves.toMatchObject({
      pageIndex: 0,
      pageSize: 20,
      sortBy: "createdAt",
      sortDirection: "desc",
      totalCount: 4,
    });
    expect(
      (
        await service.listLibrary({ sortBy: "name", sortDirection: "asc" })
      ).items.map((clip) => clip.id),
    ).toEqual(["no-path", "alpha", "beta", "missing-path"]);
    expect(
      (
        await service.listLibrary({
          sortBy: "sourceLeague",
          sortDirection: "asc",
        })
      ).items.map((clip) => clip.id),
    ).toEqual(["alpha", "missing-path", "beta", "no-path"]);
    expect(
      (
        await service.listLibrary({
          sortBy: "targetDurationSeconds",
          sortDirection: "asc",
        })
      ).items.map((clip) => clip.id),
    ).toEqual(["alpha", "beta", "no-path", "missing-path"]);
    expect(
      (
        await service.listLibrary({
          sortBy: "createdAt",
          sortDirection: "asc",
        })
      ).items.map((clip) => clip.id),
    ).toEqual(["alpha", "beta", "missing-path", "no-path"]);
    expect(
      (await service.listLibrary({ league: "Alpha" })).items.map(
        (clip) => clip.id,
      ),
    ).toEqual(["alpha"]);
  });
});
