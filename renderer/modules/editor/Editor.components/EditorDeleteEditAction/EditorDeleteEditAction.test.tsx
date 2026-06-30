import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";
import { editorShortcutEventNames } from "../../Editor.utils/EditorShortcuts.utils";
import {
  getEditorConfirmationDialog,
  getEditorDialogButton,
  installEditorDialogMocks,
} from "../EditorDeleteConfirmationModal/EditorDeleteConfirmationModal.test-utils";

const storeMocks = vi.hoisted(() => ({
  deleteProject: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorDeleteEditAction } from "./EditorDeleteEditAction";

const asset = createEditorTestAsset();
const project = createEditorTestProject(asset, {
  id: "project-1",
  title: "Saved edit",
});

let container: HTMLDivElement;
let root: Root;

function configureEditorState(isSavedProject = true) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      deleteProject: storeMocks.deleteProject,
      project,
      workspace: {
        assets: [asset],
        project,
        projects: isSavedProject
          ? [
              {
                clipCount: 1,
                createdAt: project.createdAt,
                durationSeconds: project.durationSeconds,
                id: project.id,
                title: project.title,
                updatedAt: project.updatedAt,
              },
            ]
          : [],
      },
    }),
  );
}

async function renderDeleteAction() {
  await act(async () => {
    root.render(<EditorDeleteEditAction />);
  });
}

function getDeleteButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>("button");
  if (!button) {
    throw new Error("Expected delete edit button to render");
  }

  return button;
}

describe("EditorDeleteEditAction", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    installEditorDialogMocks();
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("confirms before deleting the current saved project", async () => {
    await renderDeleteAction();

    await act(async () => {
      getDeleteButton().click();
    });

    expect(storeMocks.deleteProject).not.toHaveBeenCalled();
    expect(getEditorConfirmationDialog().open).toBe(true);
    expect(getEditorConfirmationDialog().textContent).toContain("Delete edit?");

    await act(async () => {
      getEditorDialogButton("Delete edit").click();
    });

    expect(storeMocks.deleteProject).toHaveBeenCalledWith("project-1");
    expect(document.body.querySelector("dialog")).toBeNull();
  });

  it("keeps the saved project when deletion is cancelled", async () => {
    await renderDeleteAction();

    await act(async () => {
      getDeleteButton().click();
    });
    await act(async () => {
      getEditorDialogButton("Cancel").click();
    });

    expect(storeMocks.deleteProject).not.toHaveBeenCalled();
    expect(document.body.querySelector("dialog")).toBeNull();
  });

  it("is disabled when the current edit is not saved", async () => {
    configureEditorState(false);

    await renderDeleteAction();

    expect(getDeleteButton().disabled).toBe(true);
  });

  it("shows the delete edit shortcut", async () => {
    await renderDeleteAction();

    expect(container.textContent).toContain("Delete edit");
    expect(container.textContent).toContain("Ctrl");
    expect(container.textContent).toContain("D");
  });

  it("opens the delete confirmation from the editor shortcut event", async () => {
    await renderDeleteAction();

    await act(async () => {
      window.dispatchEvent(
        new Event(editorShortcutEventNames.openDeleteEditDialog),
      );
    });

    expect(getEditorConfirmationDialog().open).toBe(true);
  });
});
