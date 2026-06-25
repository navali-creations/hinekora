import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";
import {
  getEditorConfirmationDialog,
  getEditorDialogButton,
  installEditorDialogMocks,
} from "../EditorDeleteConfirmationModal/EditorDeleteConfirmationModal.test-utils";

const storeMocks = vi.hoisted(() => ({
  deleteAllProjects: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorDeleteAllEditsAction } from "./EditorDeleteAllEditsAction";

const asset = createEditorTestAsset();
const project = createEditorTestProject(asset, {
  id: "project-1",
  title: "Saved edit",
});

let container: HTMLDivElement;
let root: Root;

function configureEditorState(hasSavedProjects = true) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      deleteAllProjects: storeMocks.deleteAllProjects,
      workspace: {
        assets: [asset],
        hasMoreProjects: false,
        project,
        projects: hasSavedProjects
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

async function renderDeleteAllAction() {
  await act(async () => {
    root.render(<EditorDeleteAllEditsAction />);
  });
}

function getDeleteAllButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>("button");
  if (!button) {
    throw new Error("Expected delete all edits button to render");
  }

  return button;
}

describe("EditorDeleteAllEditsAction", () => {
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

  it("confirms before deleting all saved editor projects", async () => {
    await renderDeleteAllAction();

    await act(async () => {
      getDeleteAllButton().click();
    });

    expect(storeMocks.deleteAllProjects).not.toHaveBeenCalled();
    expect(getEditorConfirmationDialog().open).toBe(true);
    expect(getEditorConfirmationDialog().textContent).toContain(
      "Delete all edits?",
    );

    await act(async () => {
      getEditorDialogButton("Delete all edits").click();
    });

    expect(storeMocks.deleteAllProjects).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector("dialog")).toBeNull();
  });

  it("keeps saved editor projects when deletion is cancelled", async () => {
    await renderDeleteAllAction();

    await act(async () => {
      getDeleteAllButton().click();
    });
    await act(async () => {
      getEditorDialogButton("Cancel").click();
    });

    expect(storeMocks.deleteAllProjects).not.toHaveBeenCalled();
    expect(document.body.querySelector("dialog")).toBeNull();
  });

  it("is disabled when there are no saved edits", async () => {
    configureEditorState(false);

    await renderDeleteAllAction();

    expect(getDeleteAllButton().disabled).toBe(true);
  });
});
