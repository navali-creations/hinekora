import { describe, expect, it } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "./Editor.slice.test-utils";
import {
  areEditorMediaAssetPageQueriesEqual,
  canUseEditorMediaAssetPage,
  createEditorCopyToClipboardInput,
  createEditorExportInput,
  createEditorProjectWithHistoryMetadata,
  findTimelineClipAt,
  getEditorProjectHistoryLabels,
  getEditorProjectHistorySnapshots,
  getEditorProjectHistorySubtitles,
  normalizeEditorProjectTimeline,
  refreshProjectAssets,
  resolveAvailableTimelineStart,
} from "./Editor.slice.utils";

describe("Editor slice utilities", () => {
  it("creates editor export and clipboard inputs for sorted clips", () => {
    const asset = createEditorTestAsset();
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 5,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-second",
      startSeconds: 0,
    });
    const project = {
      ...createEditorTestProject(asset),
      activeClipId: firstClip.id,
      isAudioMuted: true,
      tracks: [
        {
          ...createEditorTestProject(asset).tracks[0]!,
          clips: [firstClip, secondClip],
        },
      ],
    };

    expect(
      createEditorExportInput(project, {
        exportRequestId: "request-1",
        fileName: "clip.mp4",
        mode: "overwrite",
        resolution: "720p",
      }),
    ).toMatchObject({
      clips: [
        expect.objectContaining({ startSeconds: 0 }),
        expect.objectContaining({ startSeconds: 5 }),
      ],
      overwriteSource: { id: asset.id, kind: asset.kind },
      muteAudio: true,
    });
    expect(createEditorCopyToClipboardInput(project)).toMatchObject({
      clips: expect.any(Array),
      fileName: expect.any(String),
      muteAudio: true,
    });
  });

  it("rejects export and clipboard inputs with empty or missing media", () => {
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const emptyProject = {
      ...project,
      tracks: [{ ...project.tracks[0]!, clips: [] }],
    };
    const missingVideoProject = {
      ...project,
      tracks: [],
    };
    const missingAssetProject = {
      ...project,
      assets: [],
    };
    const missingOverwriteSourceProject = {
      ...project,
      activeClipId: "missing",
    };

    expect(
      createEditorExportInput(emptyProject, {
        exportRequestId: "request-1",
        fileName: "clip.mp4",
        mode: "new-file",
        resolution: "1080p",
      }),
    ).toBeNull();
    expect(createEditorCopyToClipboardInput(emptyProject)).toBeNull();
    expect(createEditorCopyToClipboardInput(missingVideoProject)).toBeNull();
    expect(
      createEditorExportInput(missingAssetProject, {
        exportRequestId: "request-1",
        fileName: "clip.mp4",
        mode: "new-file",
        resolution: "1080p",
      }),
    ).toBeNull();
    expect(
      createEditorExportInput(missingOverwriteSourceProject, {
        exportRequestId: "request-1",
        fileName: "clip.mp4",
        mode: "overwrite",
        resolution: "1080p",
      }),
    ).toBeNull();
  });

  it("normalizes timeline tracks into sorted non-overlapping ranges", () => {
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const lateClip = createEditorTestTimelineClip(asset, {
      id: "timeline-late",
      startSeconds: 4,
    });
    const earlyClip = createEditorTestTimelineClip(asset, {
      id: "timeline-early",
      startSeconds: 0,
    });
    const overlappingClip = createEditorTestTimelineClip(asset, {
      id: "timeline-overlap",
      startSeconds: 3,
    });

    const normalizedProject = normalizeEditorProjectTimeline({
      ...project,
      durationSeconds: 9,
      tracks: [
        {
          ...project.tracks[0]!,
          clips: [lateClip, overlappingClip, earlyClip],
        },
      ],
    });

    expect(
      normalizedProject.tracks[0]?.clips.map((clip) => ({
        id: clip.id,
        startSeconds: clip.startSeconds,
      })),
    ).toEqual([
      { id: "timeline-early", startSeconds: 0 },
      { id: "timeline-overlap", startSeconds: 5 },
      { id: "timeline-late", startSeconds: 10 },
    ]);
    expect(normalizedProject.durationSeconds).toBe(15);
  });

  it("creates compact editor project history metadata", () => {
    const project = createEditorTestProject();
    const previousProject = createEditorTestProject(undefined, {
      history: { editCount: 1, labels: ["Nested"] },
      id: "previous-project",
    }) as ReturnType<typeof createEditorTestProject> & {
      timelineScrollLeft: number;
      zoom: number;
    };
    previousProject.timelineScrollLeft = 240;
    previousProject.zoom = 2;
    const projectWithHistory = createEditorProjectWithHistoryMetadata(
      project,
      ["  ", "Split", "Mute audio"],
      ["  ", "asset-1.mp4", null],
      [previousProject],
    );

    expect(projectWithHistory).toMatchObject({
      history: {
        editCount: 2,
        labels: ["Split", "Mute audio"],
        subtitles: ["asset-1.mp4", null],
        snapshots: [
          expect.objectContaining({
            id: "previous-project",
          }),
        ],
      },
    });
    expect(projectWithHistory.history?.snapshots?.[0]).not.toHaveProperty(
      "history",
    );
    expect(projectWithHistory.history?.snapshots?.[0]).not.toHaveProperty(
      "timelineScrollLeft",
    );
    expect(projectWithHistory.history?.snapshots?.[0]).not.toHaveProperty(
      "zoom",
    );
    expect(getEditorProjectHistoryLabels(projectWithHistory)).toEqual([
      "Split",
      "Mute audio",
    ]);
    expect(getEditorProjectHistorySubtitles(projectWithHistory)).toEqual([
      "asset-1.mp4",
      null,
    ]);
    expect(getEditorProjectHistorySnapshots(projectWithHistory)).toEqual([
      expect.objectContaining({
        id: "previous-project",
      }),
    ]);
    const projectWithOrphanSnapshot = createEditorProjectWithHistoryMetadata(
      project,
      ["Split"],
      [],
      [previousProject, createEditorTestProject(undefined, { id: "orphan" })],
    );
    expect(projectWithOrphanSnapshot.history).toMatchObject({
      editCount: 1,
      labels: ["Split"],
      snapshots: [expect.objectContaining({ id: "previous-project" })],
    });
    expect(projectWithOrphanSnapshot.history?.snapshots).toHaveLength(1);
    expect(
      createEditorProjectWithHistoryMetadata(project, ["Split"], [], []),
    ).toEqual({
      ...project,
      history: {
        editCount: 1,
        labels: ["Split"],
      },
    });
    expect(createEditorProjectWithHistoryMetadata(project, [])).toBe(project);
  });

  it("compares media asset page queries for rail paging", () => {
    const firstPageQuery = {
      category: "death-clip" as const,
      game: "poe2" as const,
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
    };
    const secondPageQuery = {
      ...firstPageQuery,
      pageIndex: 1,
    };

    expect(
      areEditorMediaAssetPageQueriesEqual(firstPageQuery, {
        ...firstPageQuery,
      }),
    ).toBe(true);
    expect(
      areEditorMediaAssetPageQueriesEqual(firstPageQuery, {
        ...firstPageQuery,
        excludeAssetKeys: ["clip:used"],
      }),
    ).toBe(false);
    expect(
      areEditorMediaAssetPageQueriesEqual(firstPageQuery, {
        ...firstPageQuery,
        createdAfter: "2026-06-28T11:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      areEditorMediaAssetPageQueriesEqual(firstPageQuery, {
        ...firstPageQuery,
        league: "Runes of Aldur",
      }),
    ).toBe(false);
    expect(canUseEditorMediaAssetPage(secondPageQuery, firstPageQuery)).toBe(
      false,
    );
    expect(
      areEditorMediaAssetPageQueriesEqual(
        {
          category: "death-clip",
          game: "poe2",
        },
        {
          category: "death-clip",
          game: "poe2",
          pageIndex: 0,
          pageSize: 5,
        },
      ),
    ).toBe(true);
    expect(
      areEditorMediaAssetPageQueriesEqual(
        {
          category: "death-clip",
          game: "poe2",
          pageIndex: 0,
          pageSize: 5,
        },
        {
          category: "death-clip",
          game: "poe2",
        },
      ),
    ).toBe(true);
    expect(
      canUseEditorMediaAssetPage(
        {
          category: "death-clip",
          game: "poe2",
        },
        {
          category: "death-clip",
          game: "poe2",
          pageIndex: 0,
          pageSize: 5,
        },
      ),
    ).toBe(true);
    expect(
      canUseEditorMediaAssetPage(
        {
          category: "death-clip",
          game: "poe2",
          pageIndex: 0,
          pageSize: 5,
        },
        {
          category: "death-clip",
          game: "poe2",
        },
      ),
    ).toBe(true);
  });

  it("covers editor slice utility edge cases", () => {
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const refreshedProject = refreshProjectAssets(project, []);

    expect(refreshedProject.tracks[0]?.clips[0]).toBe(
      project.tracks[0]?.clips[0],
    );
    expect(
      resolveAvailableTimelineStart({
        clips: [
          createEditorTestTimelineClip(asset, {
            durationSeconds: 1,
            startSeconds: 5,
          }),
        ],
        desiredStartSeconds: 0,
        durationSeconds: 1,
      }),
    ).toBe(0);
    expect(
      resolveAvailableTimelineStart({
        clips: [
          createEditorTestTimelineClip(asset, {
            durationSeconds: 5,
            startSeconds: 0,
          }),
          createEditorTestTimelineClip(asset, {
            durationSeconds: 1,
            id: "timeline-later",
            startSeconds: 10,
          }),
        ],
        desiredStartSeconds: -1,
        durationSeconds: 1,
      }),
    ).toBe(5);
    expect(findTimelineClipAt(null, 0)).toBeNull();
    expect(findTimelineClipAt(project, 10)).toBe(project.tracks[0]?.clips[0]);
    expect(findTimelineClipAt(project, 11)).toBeNull();
  });
});
