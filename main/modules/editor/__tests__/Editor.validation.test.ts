import { describe, expect, it } from "vitest";

import {
  validateEditorCopyToClipboardInput,
  validateEditorCreateProjectInput,
  validateEditorExportInput,
  validateEditorSaveProjectInput,
  validateEditorWorkspaceQuery,
} from "../Editor.validation";
import {
  createEditorExportClipInput,
  createEditorExportInput,
  createEditorProject,
} from "./Editor.test-factories";

describe("Editor validation", () => {
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

  it("rejects invalid export input values", () => {
    expect(validateEditorExportInput(createEditorExportInput())).toMatchObject({
      fileName: "source.mp4",
      mode: "new-file",
      overwriteSource: null,
      exportRequestId: "export-request-1",
      resolution: "1080p",
    });
    expect(() =>
      validateEditorExportInput({
        ...createEditorExportInput(),
        exportRequestId: "",
      }),
    ).toThrow("export request id is too short");
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
        mode: "overwrite",
        overwriteSource: { id: "clip-1", kind: "recording" },
      }),
    ).toThrow("overwrite source must be included in clips");
  });

  it("rejects invalid clipboard input values", () => {
    expect(() => validateEditorCopyToClipboardInput(null)).toThrow(
      "editor clipboard input must be an object",
    );
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
    const asset = project.assets[0];
    const track = project.tracks[0];
    const clip = track?.clips[0];
    if (!asset || !track || !clip) {
      throw new Error(
        "Expected test project to include asset, track, and clip",
      );
    }

    expect(validateEditorSaveProjectInput({ project })).toEqual({ project });
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
