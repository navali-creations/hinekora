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

vi.mock("../EditorCopyActions/EditorCopyActions", () => ({
  EditorCopyActions: ({ variant }: { variant: string }) => (
    <button type="button">Copy {variant}</button>
  ),
}));
vi.mock("../EditorDeleteAllEditsAction/EditorDeleteAllEditsAction", () => ({
  EditorDeleteAllEditsAction: () => (
    <button type="button">Delete all edits</button>
  ),
}));
vi.mock("../EditorDeleteEditAction/EditorDeleteEditAction", () => ({
  EditorDeleteEditAction: () => <button type="button">Delete edit</button>,
}));
vi.mock("../EditorNewEditAction/EditorNewEditAction", () => ({
  EditorNewEditAction: ({ variant }: { variant: string }) => (
    <button type="button">New edit {variant}</button>
  ),
}));
vi.mock("../EditorProjectRetentionToggle/EditorProjectRetentionToggle", () => ({
  EditorProjectRetentionToggle: () => <label>Auto-prune all but last 5</label>,
}));

import { EditorActionsMenu } from "./EditorActionsMenu";

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

function configureEditorState() {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      clipboardState: { error: null, requestId: null, status: "idle" },
      exportProject: storeMocks.exportProject,
      exportState: { status: "idle" },
      project,
      selectedClipId: "timeline-1",
    }),
  );
}

async function renderActionsMenu() {
  await act(async () => {
    root.render(
      <EditorActionsMenu isHistoryVisible={false} onToggleHistory={vi.fn()} />,
    );
  });
}

describe("EditorActionsMenu save integration", () => {
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

  it("keeps the save dialog open after the dropdown menu closes", async () => {
    await renderActionsMenu();
    const details = container.querySelector("details");
    details?.setAttribute("open", "");
    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save",
    );

    await act(async () => {
      saveButton?.click();
    });

    const dialog = document.body.querySelector("dialog");

    expect(details?.open).toBe(false);
    expect(dialog?.open).toBe(true);
    expect(container.querySelector("dialog")).toBeNull();
  });
});
