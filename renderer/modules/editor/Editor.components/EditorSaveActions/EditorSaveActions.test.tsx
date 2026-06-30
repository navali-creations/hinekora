import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/main/modules/editor";

const storeMocks = vi.hoisted(() => ({
  exportProject: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { editorShortcutEventNames } from "../../Editor.utils/EditorShortcuts.utils";
import { EditorSaveActions } from "./EditorSaveActions";

const project: EditorProject = {
  activeClipId: "timeline-1",
  assets: [
    {
      assetKey: "clip:asset-1",
      category: "death-clip",
      createdAt: "2026-06-18T00:00:00.000Z",
      durationSeconds: 10,
      exists: true,
      id: "asset-1",
      kind: "clip",
      mediaUrl: "hinekora-media://replay-clip/asset-1",
      name: "asset-1.mp4",
      sizeBytes: 1024,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      status: "ready",
      subtitle: "Death clip - Standard",
    },
  ],
  createdAt: "2026-06-18T00:00:00.000Z",
  durationSeconds: 10,
  id: "project-1",
  selectedAssetKey: "clip:asset-1",
  title: "asset-1.mp4 edit",
  tracks: [],
  updatedAt: "2026-06-18T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      exportProject: storeMocks.exportProject,
      exportState: { status: "idle" },
      project,
      selectedClipId: "timeline-1",
      ...overrides,
    }),
  );
}

async function renderSaveActions(variant?: "button" | "menu") {
  await act(async () => {
    root.render(
      variant ? <EditorSaveActions variant={variant} /> : <EditorSaveActions />,
    );
  });
}

describe("EditorSaveActions", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
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

  it("is disabled when no timeline clip is selected", async () => {
    configureEditorState({ selectedClipId: null });
    await renderSaveActions();

    const button = container.querySelector("button");

    expect(button?.disabled).toBe(true);
    expect(
      container.querySelector("[data-tip]")?.getAttribute("data-tip"),
    ).toBe("Select a timeline clip before saving.");
  });

  it("renders disabled menu save as a flat tooltip row", async () => {
    configureEditorState({ selectedClipId: null });
    await renderSaveActions("menu");

    const tooltip = container.querySelector(
      '[data-tip="Select a timeline clip before saving."]',
    );
    const disabledRow = tooltip?.querySelector('[aria-disabled="true"]');
    const saveButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Save",
    );

    expect(disabledRow?.textContent).toContain("Save");
    expect(disabledRow?.className).toContain("text-base-content/45");
    expect(saveButtons).toHaveLength(0);
  });

  it("submits a new 1080p export with the selected clip name", async () => {
    await renderSaveActions();
    const saveButton = container.querySelector("button");

    await act(async () => {
      saveButton?.click();
    });
    const submitButton = Array.from(
      document.body.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Save video"));

    await act(async () => {
      submitButton?.click();
    });

    expect(storeMocks.exportProject).toHaveBeenCalledWith({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
  });

  it("portals the save dialog outside the menu row", async () => {
    await renderSaveActions("menu");
    const saveButton = container.querySelector("button");

    await act(async () => {
      saveButton?.click();
    });

    const dialog = document.body.querySelector("dialog");

    expect(dialog?.open).toBe(true);
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("shows the save shortcut in the menu row", async () => {
    await renderSaveActions("menu");

    expect(container.textContent).toContain("Save");
    expect(container.textContent).toContain("Ctrl");
    expect(container.textContent).toContain("S");
  });

  it("renders a filename suffix while editing the base file name", async () => {
    await renderSaveActions();
    const saveButton = container.querySelector("button");

    await act(async () => {
      saveButton?.click();
    });

    expect(document.body.querySelector<HTMLInputElement>("input")?.value).toBe(
      "asset-1",
    );
    expect(document.body.textContent).toContain(".mp4");
  });

  it("opens the save dialog from the editor shortcut event", async () => {
    await renderSaveActions();

    await act(async () => {
      window.dispatchEvent(new Event(editorShortcutEventNames.openSaveDialog));
    });

    expect(document.body.querySelector("dialog")?.open).toBe(true);
  });
});
