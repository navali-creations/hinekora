import { describe, expect, it, vi } from "vitest";

vi.mock("~/renderer/modules/editor/Editor.page/EditorPage/EditorPage", () => ({
  EditorPage: () => null,
}));

import { validateEditorSearch } from "~/renderer/routes/editor";

describe("editor route search", () => {
  it("accepts bounded project and paired source search params", () => {
    expect(
      validateEditorSearch({
        id: "clip-1",
        kind: "clip",
        projectId: "project-1",
      }),
    ).toEqual({
      id: "clip-1",
      kind: "clip",
      projectId: "project-1",
    });
  });

  it("drops orphan and oversized editor search params", () => {
    expect(validateEditorSearch({ id: "clip-1" })).toEqual({});
    expect(validateEditorSearch({ kind: "clip" })).toEqual({});
    expect(
      validateEditorSearch({
        id: "x".repeat(2_049),
        kind: "clip",
        projectId: "x".repeat(129),
      }),
    ).toEqual({});
  });
});
