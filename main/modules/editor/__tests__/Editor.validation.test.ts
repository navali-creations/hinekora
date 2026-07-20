import { describe, expect, it } from "vitest";

import {
  validateEditorCancelExportInput,
  validateEditorCopyToClipboardInput,
  validateEditorCreateProjectInput,
  validateEditorExportInput,
  validateEditorMediaAssetPageQuery,
  validateEditorSaveProjectInput,
  validateEditorWorkspaceQuery,
} from "../Editor.validation";
import {
  createEditorExportClipInput,
  createEditorExportInput,
  createEditorProject,
} from "./Editor.test-factories";

describe("Editor validation", () => {
  it("validates editor export cancellation input", () => {
    expect(
      validateEditorCancelExportInput({
        exportRequestId: "export-request-1",
      }),
    ).toEqual({ exportRequestId: "export-request-1" });
    expect(() => validateEditorCancelExportInput(null)).toThrow(
      "editor cancel export input must be an object",
    );
    expect(() =>
      validateEditorCancelExportInput({ exportRequestId: "" }),
    ).toThrow("export request id is too short");
  });

  it("accepts empty workspace and project input", () => {
    expect(validateEditorWorkspaceQuery(undefined)).toEqual({});
    expect(validateEditorCreateProjectInput(undefined)).toEqual({});
    expect(
      validateEditorWorkspaceQuery({
        projectLimit: 5,
        projectId: "project-1",
        source: null,
      }),
    ).toEqual({ projectLimit: 5, projectId: "project-1" });
    expect(
      validateEditorCreateProjectInput({
        assetKeys: [],
        source: null,
      }),
    ).toEqual({ assetKeys: [] });
    expect(() => validateEditorWorkspaceQuery({ projectId: "" })).toThrow(
      "project id is too short",
    );
    expect(() => validateEditorWorkspaceQuery({ projectLimit: 101 })).toThrow(
      "project limit is too large",
    );
  });

  it("validates editor media asset page queries", () => {
    expect(
      validateEditorMediaAssetPageQuery({
        category: "death-clip",
        createdAfter: "2026-06-28T11:00:00.000Z",
        excludeAssetKeys: ["clip:used"],
        game: "poe2",
        includeAssetKeys: ["clip:target"],
        league: "Standard",
        pageIndex: 1,
        pageSize: 5,
      }),
    ).toEqual({
      category: "death-clip",
      createdAfter: "2026-06-28T11:00:00.000Z",
      excludeAssetKeys: ["clip:used"],
      game: "poe2",
      includeAssetKeys: ["clip:target"],
      league: "Standard",
      pageIndex: 1,
      pageSize: 5,
    });
    expect(
      validateEditorMediaAssetPageQuery({
        category: "recording",
        game: "poe1",
      }),
    ).toEqual({ category: "recording", game: "poe1" });
    expect(() =>
      validateEditorMediaAssetPageQuery({
        category: "saved-edits",
        game: "poe2",
      }),
    ).toThrow("asset category is invalid");
    expect(() =>
      validateEditorMediaAssetPageQuery({
        category: "death-clip",
        game: "poe3",
      }),
    ).toThrow("asset source game is invalid");
    expect(() =>
      validateEditorMediaAssetPageQuery({
        category: "death-clip",
        game: "poe2",
        pageIndex: -1,
      }),
    ).toThrow("page index is too small");
    expect(() =>
      validateEditorMediaAssetPageQuery({
        category: "death-clip",
        game: "poe2",
        pageSize: 51,
      }),
    ).toThrow("page size is too large");
    expect(() =>
      validateEditorMediaAssetPageQuery({
        category: "death-clip",
        game: "poe2",
        league: "",
      }),
    ).toThrow("league is too short");
    expect(() =>
      validateEditorMediaAssetPageQuery({
        category: "death-clip",
        createdAfter: "not a date",
        game: "poe2",
      }),
    ).toThrow("created after is invalid");
    expect(() =>
      validateEditorMediaAssetPageQuery({
        category: "death-clip",
        game: "poe2",
        includeAssetKeys: "clip:one",
      }),
    ).toThrow("include asset keys must be an array");
  });

  it("rejects invalid export input values", () => {
    expect(validateEditorExportInput(createEditorExportInput())).toMatchObject({
      fileName: "source.mp4",
      mode: "new-file",
      overwriteSource: null,
      projectId: "project-1",
      exportRequestId: "export-request-1",
      resolution: "1080p",
    });
    expect(
      validateEditorExportInput({
        ...createEditorExportInput(),
        clips: [
          createEditorExportClipInput({
            durationSeconds: 0.3125,
            outSeconds: 5,
            playbackRate: 16,
          }),
        ],
        durationSeconds: 0.3125,
      }).clips[0],
    ).toMatchObject({ durationSeconds: 0.3125, playbackRate: 16 });
    expect(
      validateEditorExportInput({
        ...createEditorExportInput(),
        muteAudio: true,
      }),
    ).toMatchObject({ muteAudio: true });
    expect(
      validateEditorExportInput({
        ...createEditorExportInput(),
        durationSeconds: 86_400,
      }),
    ).toMatchObject({ durationSeconds: 86_400 });
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        muteAudio: "yes",
      }),
    ).toThrow("mute audio must be a boolean");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        exportRequestId: "",
      }),
    ).toThrow("export request id is too short");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        projectId: "",
      }),
    ).toThrow("project id is too short");
    expect(() => validateEditorExportInput(null)).toThrow(
      "editor export input must be an object",
    );
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        mode: "bad",
      }),
    ).toThrow("export mode is invalid");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        resolution: "4k",
      }),
    ).toThrow("export resolution is invalid");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        clips: "bad",
      }),
    ).toThrow("clips must be an array");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        clips: [],
      }),
    ).toThrow("clips is too short");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        clips: Array.from({ length: 201 }, () => createEditorExportClipInput()),
      }),
    ).toThrow("clips is too large");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        clips: [{ ...createEditorExportClipInput(), outSeconds: 0 }],
      }),
    ).toThrow("clip out point must be after clip in point");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        clips: [
          {
            ...createEditorExportClipInput(),
            playbackRate: 1.1,
          },
        ],
      }),
    ).toThrow("clip speed is invalid");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        clips: [
          createEditorExportClipInput({
            durationSeconds: 3,
            outSeconds: 5,
            playbackRate: 2,
          }),
        ],
      }),
    ).toThrow("clip duration must fit source range");
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        mode: "overwrite",
        overwriteSource: { id: "clip-1", kind: "recording" },
      }),
    ).toThrow("overwrite source must be included in clips");
  });

  it("rejects invalid clipboard input values", () => {
    expect(
      validateEditorCopyToClipboardInput({
        clips: [createEditorExportClipInput()],
        durationSeconds: 5,
        fileName: "clip.mp4",
        muteAudio: true,
        resolution: "1080p",
      }),
    ).toMatchObject({ muteAudio: true });
    expect(
      validateEditorCopyToClipboardInput({
        clips: [createEditorExportClipInput()],
        durationSeconds: 5,
        fileName: "clip.mp4",
        resolution: "1080p",
      }),
    ).not.toHaveProperty("muteAudio");
    expect(() => validateEditorCopyToClipboardInput(null)).toThrow(
      "editor clipboard input must be an object",
    );
    expect(() =>
      validateEditorCopyToClipboardInput({
        clips: [createEditorExportClipInput()],
        durationSeconds: 5,
        fileName: "clip.mp4",
        muteAudio: "yes",
        resolution: "1080p",
      }),
    ).toThrow("mute audio must be a boolean");
    expect(() =>
      validateEditorCopyToClipboardInput({
        clips: [createEditorExportClipInput()],
        durationSeconds: 1,
        fileName: "clip.mp4",
        resolution: "4k",
      }),
    ).toThrow("export resolution is invalid");
  });

  it("validates full editor projects before saving", () => {
    const project = createEditorProject();
    const previousProject = createEditorProject({ id: "previous-project" });
    const asset = project.assets[0];
    const track = project.tracks[0];
    const clip = track?.clips[0];
    if (!asset || !track || !clip) {
      throw new Error(
        "Expected test project to include asset, track, and clip",
      );
    }

    expect(
      validateEditorSaveProjectInput({
        project: { ...project, isAudioMuted: true },
      }).project,
    ).toMatchObject({ isAudioMuted: true });
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: {
            editCount: 1,
            labels: ["Split", "Clear gaps"],
            subtitles: ["asset-1.mp4", null],
            snapshots: [previousProject],
          },
          sourceGame: "poe2",
          sourceLeague: "Runes of Aldur",
        },
      }).project,
    ).toMatchObject({
      history: {
        editCount: 2,
        labels: ["Split", "Clear gaps"],
        subtitles: ["asset-1.mp4", null],
        snapshots: [expect.objectContaining({ id: "previous-project" })],
      },
      sourceGame: "poe2",
      sourceLeague: "Runes of Aldur",
    });
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: {
            editCount: 50,
            labels: ["Trim start"],
            subtitles: ["source.mp4", "orphan.mp4"],
            snapshots: [
              previousProject,
              createEditorProject({ id: "orphan-history" }),
            ],
          },
        },
      }).project.history,
    ).toMatchObject({
      editCount: 1,
      labels: ["Trim start"],
      subtitles: ["source.mp4"],
      snapshots: [expect.objectContaining({ id: "previous-project" })],
    });
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: {
            editCount: 2,
            labels: ["Split", "Move"],
          },
        },
      }).project.history,
    ).toEqual({
      editCount: 2,
      labels: ["Split", "Move"],
    });
    expect(validateEditorSaveProjectInput({ project })).toEqual({ project });
    expect(() =>
      validateEditorSaveProjectInput({
        project: { ...project, isAudioMuted: "yes" },
      }),
    ).toThrow("audio muted must be a boolean");
    expect(() =>
      validateEditorSaveProjectInput({
        project: { ...project, history: { editCount: 1, labels: "bad" } },
      }),
    ).toThrow("project history labels must be an array");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: {
            editCount: 1,
            labels: Array.from({ length: 51 }, (_, index) => `Edit ${index}`),
          },
        },
      }),
    ).toThrow("project history labels is too large");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: {
            editCount: 1,
            labels: ["Split"],
            subtitles: "bad",
          },
        },
      }),
    ).toThrow("project history subtitles must be an array");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: {
            editCount: 1,
            labels: ["Split"],
            subtitles: Array.from(
              { length: 51 },
              (_, index) => `clip-${index}.mp4`,
            ),
          },
        },
      }),
    ).toThrow("project history subtitles is too large");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: { editCount: 1, labels: ["Split"], snapshots: "bad" },
        },
      }),
    ).toThrow("project history snapshots must be an array");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: {
            editCount: 1,
            labels: ["Split"],
            snapshots: Array.from({ length: 51 }, (_, index) =>
              createEditorProject({ id: `history-${index}` }),
            ),
          },
        },
      }),
    ).toThrow("project history snapshots is too large");
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          history: {
            editCount: 50,
            labels: Array.from({ length: 50 }, (_, index) => `Edit ${index}`),
            snapshots: Array.from({ length: 50 }, (_, index) =>
              createEditorProject({ id: `history-${index}` }),
            ),
          },
        },
      }).project.history,
    ).toMatchObject({
      editCount: 50,
      labels: Array.from({ length: 50 }, (_, index) => `Edit ${index}`),
      snapshots: expect.arrayContaining([
        expect.objectContaining({ id: "history-0" }),
        expect.objectContaining({ id: "history-49" }),
      ]),
    });
    expect(
      validateEditorSaveProjectInput({
        project: { ...project, sourceGame: "poe2", sourceLeague: null },
      }).project,
    ).toMatchObject({ sourceGame: "poe2" });
    expect(
      validateEditorSaveProjectInput({
        project: { ...project, sourceGame: null, sourceLeague: "Standard" },
      }).project,
    ).toMatchObject({ sourceLeague: "Standard" });
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          debugPayload: "x".repeat(2 * 1024 * 1024),
        },
      }),
    ).toThrow("editor project save input is too large");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          debugPayload: "é".repeat(1_100_000),
        },
      }),
    ).toThrow("editor project save input is too large");
    expect(() =>
      validateEditorSaveProjectInput({
        project: { ...project, sourceGame: "poe3", sourceLeague: "Standard" },
      }),
    ).toThrow("project source game is invalid");
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [
                {
                  ...clip,
                  sourceInSeconds: 1,
                  sourceOutSeconds: 9,
                },
              ],
            },
          ],
        },
      }).project.tracks[0]?.clips[0],
    ).toMatchObject({ sourceInSeconds: 1, sourceOutSeconds: 9 });
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [
                {
                  ...clip,
                  durationSeconds: 0.625,
                  outSeconds: 10,
                  playbackRate: 16,
                },
              ],
            },
          ],
        },
      }).project.tracks[0]?.clips[0],
    ).toMatchObject({ durationSeconds: 0.625, playbackRate: 16 });
    const legacyClip = { ...clip } as Partial<typeof clip>;
    delete legacyClip.playbackRate;
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [legacyClip],
            },
          ],
        },
      }).project.tracks[0]?.clips[0],
    ).toMatchObject({ playbackRate: 1 });
    const clipWithoutSourceRange = { ...clip };
    delete clipWithoutSourceRange.sourceInSeconds;
    delete clipWithoutSourceRange.sourceOutSeconds;
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [
            {
              ...asset,
              durationSeconds: null,
              mediaUrl: null,
            },
          ],
          tracks: [
            {
              ...track,
              clips: [
                {
                  ...clipWithoutSourceRange,
                  mediaUrl: null,
                },
              ],
            },
          ],
        },
      }).project,
    ).toMatchObject({
      assets: [{ durationSeconds: null, mediaUrl: null }],
      tracks: [{ clips: [{ mediaUrl: null }] }],
    });
    expect(() => validateEditorSaveProjectInput(null)).toThrow(
      "editor project save input must be an object",
    );
    expect(() =>
      validateEditorSaveProjectInput({
        project: { ...project, title: "" },
      }),
    ).toThrow("project title is too short");
    expect(() =>
      validateEditorSaveProjectInput({
        project: { ...project, assets: "bad" },
      }),
    ).toThrow("assets must be an array");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: Array.from({ length: 101 }, () => asset),
        },
      }),
    ).toThrow("assets is too large");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [{ ...asset, status: "unknown" }],
        },
      }),
    ).toThrow("asset status is invalid");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [{ ...asset, category: "unknown" }],
        },
      }),
    ).toThrow("asset category is invalid");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [{ ...asset, kind: "unknown" }],
        },
      }),
    ).toThrow("asset kind is invalid");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [{ ...asset, sourceGame: "unknown" }],
        },
      }),
    ).toThrow("asset source game is invalid");
    expect(
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [{ ...asset, exists: false }],
        },
      }).project.assets[0]?.exists,
    ).toBe(false);
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [{ ...asset, exists: "false" }],
        },
      }),
    ).toThrow("asset exists must be a boolean");
    expect(() =>
      validateEditorSaveProjectInput({
        project: { ...project, tracks: "bad" },
      }),
    ).toThrow("tracks must be an array");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: Array.from({ length: 9 }, () => track),
        },
      }),
    ).toThrow("tracks is too large");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [{ ...track, kind: "audio" }],
        },
      }),
    ).toThrow("track kind is invalid");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [{ ...track, clips: "bad" }],
        },
      }),
    ).toThrow("clips must be an array");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [asset, { ...asset, id: "asset-copy" }],
        },
      }),
    ).toThrow("asset keys must be unique");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [clip, { ...clip }],
            },
          ],
        },
      }),
    ).toThrow("clip ids must be unique");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [
                clip,
                {
                  ...clip,
                  durationSeconds: 5,
                  id: "timeline-overlap",
                  outSeconds: 5,
                  startSeconds: 4,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow("timeline clips must not overlap");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [
                { ...clip, id: "timeline-b" },
                { ...clip, id: "timeline-a" },
              ],
            },
          ],
        },
      }),
    ).toThrow("timeline clips must not overlap");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: Array.from({ length: 201 }, () => clip),
            },
          ],
        },
      }),
    ).toThrow("clips is too large");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [{ ...clip, color: "bad" }],
            },
          ],
        },
      }),
    ).toThrow("clip color is invalid");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [{ ...clip, playbackRate: 1.1 }],
            },
          ],
        },
      }),
    ).toThrow("clip speed is invalid");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [
                {
                  ...clip,
                  outSeconds: 0,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow("clip out point must be after clip in point");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          activeClipId: "missing-clip",
        },
      }),
    ).toThrow("active clip id must match a timeline clip");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          selectedAssetKey: "clip:missing",
        },
      }),
    ).toThrow("selected asset key must exist in project assets");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [],
        },
      }),
    ).toThrow("clip asset must exist in project assets");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [{ ...clip, trackId: "other-track" }],
            },
          ],
        },
      }),
    ).toThrow("clip track id must match parent track");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          tracks: [
            {
              ...track,
              clips: [{ ...clip, durationSeconds: 20 }],
            },
          ],
        },
      }),
    ).toThrow("clip duration must fit source range");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          assets: [{ ...asset, durationSeconds: 5 }],
        },
      }),
    ).toThrow("clip out point must fit asset duration");
    expect(() =>
      validateEditorSaveProjectInput({
        project: {
          ...project,
          durationSeconds: 5,
        },
      }),
    ).toThrow("clip range must fit project duration");
  });
});
