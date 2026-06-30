import { describe, expect, it } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";
import {
  createZoomTooltip,
  resolveEditorTimelineZoomControlState,
} from "./EditorTimelineZoomControls.utils";

describe("EditorTimelineZoomControls utils", () => {
  it("creates zoom tooltip labels", () => {
    expect(
      createZoomTooltip({
        boundaryLabel: "Cannot zoom out further",
        hasSelectedClip: false,
        isAtBoundary: false,
        label: "Zoom out timeline",
      }),
    ).toBe("Select a timeline clip before zooming");
    expect(
      createZoomTooltip({
        boundaryLabel: "Cannot zoom out further",
        hasSelectedClip: true,
        isAtBoundary: true,
        label: "Zoom out timeline",
      }),
    ).toBe("Cannot zoom out further");
    expect(
      createZoomTooltip({
        boundaryLabel: "Cannot zoom out further",
        hasSelectedClip: true,
        isAtBoundary: false,
        label: "Zoom out timeline",
      }),
    ).toBe("Zoom out timeline");
  });

  it("disables zoom controls without a selected project clip", () => {
    const state = resolveEditorTimelineZoomControlState({
      isTimelineFitToEdit: false,
      project: null,
      selectedClipId: null,
      zoom: 1,
    });

    expect(state).toMatchObject({
      hasSelectedClip: false,
      isZoomInDisabled: true,
      isZoomOutDisabled: true,
    });
  });

  it("keeps zoom in available for short clips because the content can stretch", () => {
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    const state = resolveEditorTimelineZoomControlState({
      isTimelineFitToEdit: false,
      project,
      selectedClipId: project.activeClipId,
      zoom: 1,
    });

    expect(state).toMatchObject({
      hasSelectedClip: true,
      isZoomInAtBoundary: false,
      isZoomInDisabled: false,
      isZoomOutAtBoundary: true,
      isZoomOutDisabled: true,
    });
  });

  it("disables zoom in at the maximum zoom boundary", () => {
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    const state = resolveEditorTimelineZoomControlState({
      isTimelineFitToEdit: false,
      project,
      selectedClipId: project.activeClipId,
      zoom: 4,
    });

    expect(state).toMatchObject({
      hasSelectedClip: true,
      isZoomInAtBoundary: true,
      isZoomInDisabled: true,
      isZoomOutDisabled: false,
    });
  });

  it("keeps zoom controls enabled after zooming in from the fit view", () => {
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset, { durationSeconds: 30 });
    const state = resolveEditorTimelineZoomControlState({
      isTimelineFitToEdit: false,
      project,
      selectedClipId: project.activeClipId,
      zoom: 1.25,
    });

    expect(state).toMatchObject({
      isZoomInDisabled: false,
      isZoomOutDisabled: false,
      nextZoomIn: 1.5,
      nextZoomOut: 1,
    });
  });

  it("keeps zoom out available from fitted view at minimum zoom", () => {
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    const state = resolveEditorTimelineZoomControlState({
      isTimelineFitToEdit: true,
      project,
      selectedClipId: project.activeClipId,
      zoom: 1,
    });

    expect(state).toMatchObject({
      isZoomOutAtBoundary: false,
      isZoomOutDisabled: false,
      nextZoomOut: 1,
    });
  });
});
