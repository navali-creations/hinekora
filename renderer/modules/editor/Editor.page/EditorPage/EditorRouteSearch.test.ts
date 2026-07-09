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
        title: "Quick title",
        trimIn: "1.25",
        trimOut: "4.5",
      }),
    ).toEqual({
      id: "clip-1",
      kind: "clip",
      projectId: "project-1",
      title: "Quick title",
      trimIn: 1.25,
      trimOut: 4.5,
    });
  });

  it("drops orphan and oversized editor search params", () => {
    expect(validateEditorSearch({ id: "clip-1" })).toEqual({});
    expect(validateEditorSearch({ kind: "clip" })).toEqual({});
    expect(
      validateEditorSearch({
        id: "clip-1",
        kind: "clip",
        title: "Ignored",
      }),
    ).toEqual({ id: "clip-1", kind: "clip" });
    expect(
      validateEditorSearch({
        id: "x".repeat(2_049),
        kind: "clip",
        projectId: "x".repeat(129),
        title: "x".repeat(121),
        trimIn: "5",
        trimOut: "5.01",
      }),
    ).toEqual({});
    expect(
      validateEditorSearch({
        id: "clip-1",
        kind: "clip",
        title: "Ignored",
        trimIn: "4",
        trimOut: "4.05",
      }),
    ).toEqual({ id: "clip-1", kind: "clip" });
  });
});
