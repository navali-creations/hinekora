import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";

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

describe("EditorDeleteEditAction", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("deletes the current saved project", async () => {
    await renderDeleteAction();
    const button = container.querySelector<HTMLButtonElement>("button");

    await act(async () => {
      button?.click();
    });

    expect(storeMocks.deleteProject).toHaveBeenCalledWith("project-1");
  });

  it("is disabled when the current edit is not saved", async () => {
    configureEditorState(false);

    await renderDeleteAction();
    const button = container.querySelector<HTMLButtonElement>("button");

    expect(button?.disabled).toBe(true);
  });
});
