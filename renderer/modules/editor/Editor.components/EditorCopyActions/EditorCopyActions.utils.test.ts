import { describe, expect, it } from "vitest";

import { createCopyDisabledReason } from "./EditorCopyActions.utils";

describe("EditorCopyActions utils", () => {
  it("creates copy disabled reasons by priority", () => {
    expect(
      createCopyDisabledReason({
        exportStatus: "idle",
        isCopying: false,
        project: null,
        selectedClipId: null,
      }),
    ).toBe("Add a clip to the timeline before copying.");
    expect(
      createCopyDisabledReason({
        exportStatus: "idle",
        isCopying: false,
        project: { id: "project-1" },
        selectedClipId: null,
      }),
    ).toBe("Select a timeline clip before copying.");
    expect(
      createCopyDisabledReason({
        exportStatus: "idle",
        isCopying: true,
        project: { id: "project-1" },
        selectedClipId: "clip-1",
      }),
    ).toBe("Copy is already processing.");
    expect(
      createCopyDisabledReason({
        exportStatus: "exporting",
        isCopying: false,
        project: { id: "project-1" },
        selectedClipId: "clip-1",
      }),
    ).toBe("Wait for the current save to finish.");
    expect(
      createCopyDisabledReason({
        exportStatus: "idle",
        isCopying: false,
        project: { id: "project-1" },
        selectedClipId: "clip-1",
      }),
    ).toBeNull();
  });
});
