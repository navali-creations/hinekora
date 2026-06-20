import { describe, expect, it } from "vitest";

import { createSaveDisabledReason } from "./EditorSaveActions.utils";

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
    ).toBe("Wait for the current export to finish.");
    expect(
      createSaveDisabledReason({
        isExporting: false,
        project: { id: "project-1" },
        selectedClipId: "clip-1",
      }),
    ).toBeNull();
  });
});
