import { describe, expect, it } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";
import {
  createEditorFileNameDraft,
  createEditorOutputFileName,
  createSaveDisabledReason,
  stripMp4Extension,
} from "./EditorSaveActions.utils";

describe("EditorSaveActions utils", () => {
  it("creates save disabled reasons by priority", () => {
    expect(
      createSaveDisabledReason({
        isExporting: false,
        project: null,
        selectedClipId: null,
      }),
    ).toBe("Add a clip to the timeline before saving.");
    expect(
      createSaveDisabledReason({
        isExporting: false,
        project: { id: "project-1" },
        selectedClipId: null,
      }),
    ).toBe("Select a timeline clip before saving.");
    expect(
      createSaveDisabledReason({
        isExporting: true,
        project: { id: "project-1" },
        selectedClipId: "clip-1",
      }),
    ).toBe("Wait for the current save to finish.");
    expect(
      createSaveDisabledReason({
        isExporting: false,
        project: { id: "project-1" },
        selectedClipId: "clip-1",
      }),
    ).toBeNull();
  });

  it("normalizes editor save file names", () => {
    expect(
      createEditorFileNameDraft(
        createEditorTestProject(
          createEditorTestAsset({ name: "Boss kill.mp4" }),
        ),
      ),
    ).toBe("Boss kill");
    expect(createEditorOutputFileName(" boss-kill ")).toBe("boss-kill.mp4");
    expect(createEditorOutputFileName("boss-kill.MP4")).toBe("boss-kill.MP4");
    expect(stripMp4Extension("boss-kill.mp4")).toBe("boss-kill");
    expect(stripMp4Extension("boss-kill.MP4")).toBe("boss-kill");
  });
});
