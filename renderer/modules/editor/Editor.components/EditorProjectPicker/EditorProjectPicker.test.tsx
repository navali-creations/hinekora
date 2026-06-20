import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";

const storeMocks = vi.hoisted(() => ({
  loadMoreProjects: vi.fn(),
  openProject: vi.fn(),
  saveProject: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorProjectPicker } from "./EditorProjectPicker";

const asset = createEditorTestAsset();
const project = createEditorTestProject(asset);

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      loadMoreProjects: storeMocks.loadMoreProjects,
      openProject: storeMocks.openProject,
      project,
      saveProject: storeMocks.saveProject,
      workspace: {
        assets: [asset],
        hasMoreProjects: false,
        project,
        projects: [
          {
            clipCount: 1,
            createdAt: project.createdAt,
            durationSeconds: project.durationSeconds,
            id: project.id,
            title: project.title,
            updatedAt: project.updatedAt,
          },
          {
            clipCount: 0,
            createdAt: "2026-06-18T00:01:00.000Z",
            durationSeconds: 0,
            id: "project-2",
            title: "Second edit",
            updatedAt: "2026-06-18T00:01:00.000Z",
          },
        ],
      },
      ...overrides,
    }),
  );
}

async function renderProjectPicker() {
  await act(async () => {
    root.render(<EditorProjectPicker />);
  });
}

describe("EditorProjectPicker", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.saveProject.mockResolvedValue(project);
    configureEditorState();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    });
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("opens a saved project from the selector", async () => {
    await renderProjectPicker();
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Editor project"]',
    );

    await act(async () => {
      if (!select) {
        throw new Error("Expected project selector to render");
      }
      select.value = "project-2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(storeMocks.openProject).toHaveBeenCalledWith("project-2");
  });

  it("shows Default and disables rename for unsaved projects", async () => {
    const unsavedProject = createEditorTestProject(asset, {
      id: "unsaved-project",
    });
    configureEditorState({
      project: unsavedProject,
      workspace: {
        assets: [asset],
        hasMoreProjects: false,
        project: unsavedProject,
        projects: [],
      },
    });

    await renderProjectPicker();
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Editor project"]',
    );
    const renameButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Rename project"]',
    );

    expect(select?.value).toBe("");
    expect(select?.textContent).toContain("Default");
    expect(renameButton?.disabled).toBe(true);
  });

  it("renames the current saved project", async () => {
    await renderProjectPicker();
    const renameButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Rename project"]',
    );

    await act(async () => {
      renameButton?.click();
    });

    const input = container.querySelector<HTMLInputElement>("input");
    const submitButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Rename",
    );

    if (!input) {
      throw new Error("Expected rename input to render");
    }

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(input, "Boss kills");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      submitButton?.click();
    });

    expect(storeMocks.saveProject).toHaveBeenCalledWith({
      ...project,
      title: "Boss kills",
    });
  });

  it("loads more saved projects from the selector", async () => {
    configureEditorState({
      workspace: {
        assets: [asset],
        hasMoreProjects: true,
        project,
        projects: [
          {
            clipCount: 1,
            createdAt: project.createdAt,
            durationSeconds: project.durationSeconds,
            id: project.id,
            title: project.title,
            updatedAt: project.updatedAt,
          },
        ],
      },
    });

    await renderProjectPicker();
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Editor project"]',
    );

    await act(async () => {
      if (!select) {
        throw new Error("Expected project selector to render");
      }
      select.value = "__load-more-projects__";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(storeMocks.loadMoreProjects).toHaveBeenCalledOnce();
    expect(storeMocks.openProject).not.toHaveBeenCalled();
  });
});
