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

  it("disables zoom in when the next zoom level would not change the timeline", () => {
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    const state = resolveEditorTimelineZoomControlState({
      project,
      selectedClipId: project.activeClipId,
      zoom: 1,
    });

    expect(state).toMatchObject({
      hasSelectedClip: true,
      isZoomInAtBoundary: true,
      isZoomInDisabled: true,
      isZoomOutAtBoundary: false,
      isZoomOutDisabled: false,
    });
  });

  it("keeps zoom controls enabled when the visible timeline range would change", () => {
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset, { durationSeconds: 30 });
    const state = resolveEditorTimelineZoomControlState({
      project,
      selectedClipId: project.activeClipId,
      zoom: 1,
    });

    expect(state).toMatchObject({
      isZoomInDisabled: false,
      isZoomOutDisabled: false,
      nextZoomIn: 1.25,
      nextZoomOut: 0.75,
    });
  });
});
