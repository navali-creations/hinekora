import { describe, expect, it } from "vitest";

import { createEditorTestProject } from "../../Editor.slice/Editor.slice.test-utils";
import {
  createExportSubtitle,
  createExportTitle,
  isEditorDeleteShortcut,
  isEditorShortcutEditableTarget,
  isEditorShortcutSuppressedTarget,
  shouldHydrateEditorProject,
} from "./EditorPage.utils";

describe("EditorPage utils", () => {
  it("creates export titles for each status", () => {
    expect(createExportTitle("ready")).toBe("Your video is ready");
    expect(createExportTitle("failed")).toBe("Save failed");
    expect(createExportTitle("exporting")).toBe("Saving video");
  });

  it("creates the ready export subtitle from the export result", () => {
    expect(
      createExportSubtitle({
        fileName: "fallback.mp4",
        result: {
          durationSeconds: 65.4,
          fileName: "render.mp4",
          sizeBytes: 1_572_864,
        },
        status: "ready",
      }),
    ).toBe("render.mp4 - 1:05.40 - 1.5 MB");
  });

  it("falls back to the requested file name or failure text", () => {
    expect(
      createExportSubtitle({
        fileName: "rendering.mp4",
        result: null,
        status: "exporting",
      }),
    ).toBe("rendering.mp4");
    expect(
      createExportSubtitle({
        fileName: null,
        result: null,
        status: "failed",
      }),
    ).toBe("Save failed");
  });

  it("hydrates when the requested source is not already on the timeline", () => {
    const project = createEditorTestProject();
    const emptyTimelineProject = {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        clips: [],
      })),
    };

    expect(
      shouldHydrateEditorProject({
        project,
        sourceId: "asset-1",
        sourceKind: "clip",
      }),
    ).toBe(false);
    expect(
      shouldHydrateEditorProject({
        project,
        sourceId: "missing",
        sourceKind: "clip",
      }),
    ).toBe(true);
    expect(
      shouldHydrateEditorProject({
        project: emptyTimelineProject,
        sourceId: "asset-1",
        sourceKind: "clip",
      }),
    ).toBe(true);
    expect(
      shouldHydrateEditorProject({
        project,
        sourceId: undefined,
        sourceKind: undefined,
      }),
    ).toBe(false);
  });

  it("detects delete shortcuts and editable shortcut targets", () => {
    expect(
      isEditorDeleteShortcut(
        new KeyboardEvent("keydown", { code: "Delete", key: "Del" }),
      ),
    ).toBe(true);
    expect(
      isEditorDeleteShortcut(new KeyboardEvent("keydown", { key: "Delete" })),
    ).toBe(true);
    expect(
      isEditorDeleteShortcut(
        new KeyboardEvent("keydown", { key: "Backspace" }),
      ),
    ).toBe(false);

    const button = document.createElement("button");
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.contentEditable = "true";

    expect(isEditorShortcutEditableTarget(button)).toBe(false);
    expect(isEditorShortcutEditableTarget(input)).toBe(true);
    expect(isEditorShortcutEditableTarget(editable)).toBe(true);
    expect(isEditorShortcutSuppressedTarget(input)).toBe(true);
  });

  it("suppresses editor shortcuts inside open dialogs", () => {
    const dialog = document.createElement("dialog");
    const button = document.createElement("button");
    dialog.setAttribute("open", "");
    dialog.append(button);
    document.body.append(dialog);

    expect(isEditorShortcutSuppressedTarget(button)).toBe(true);

    dialog.remove();
  });

  it("suppresses editor shortcuts inside menus", () => {
    const menu = document.createElement("div");
    const button = document.createElement("button");
    menu.setAttribute("role", "menu");
    menu.append(button);
    document.body.append(menu);

    expect(isEditorShortcutSuppressedTarget(button)).toBe(true);

    menu.remove();
  });
});
