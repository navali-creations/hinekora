import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedEditItem } from "~/main/modules/saved-edits";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({
  deleteEdit: vi.fn(),
  revealEditInExplorer: vi.fn(),
  useSavedEditsShallow: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routerMocks.navigate,
}));
vi.mock("~/renderer/store", () => ({
  useSavedEditsShallow: storeMocks.useSavedEditsShallow,
}));

import { SavedEditTableActions } from "./SavedEditTableActions";

let container: HTMLDivElement;
let root: Root;

const edit: SavedEditItem = {
  clipCount: 1,
  createdAt: "2026-06-18T00:00:00.000Z",
  durationSeconds: 12,
  historyEditCount: 1,
  id: "project-1",
  sizeBytes: 1024,
  sourceGame: "poe2",
  sourceLeague: "Standard",
  title: "Saved boss edit",
  updatedAt: "2026-06-18T00:01:00.000Z",
};

describe("SavedEditTableActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
    storeMocks.useSavedEditsShallow.mockImplementation((selector) =>
      selector({
        deleteEdit: storeMocks.deleteEdit,
        revealEditInExplorer: storeMocks.revealEditInExplorer,
      }),
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("opens a saved edit in the editor route", async () => {
    await act(async () => {
      root.render(<SavedEditTableActions edit={edit} />);
    });

    await act(async () => {
      container.querySelector("button")?.click();
    });

    expect(routerMocks.navigate).toHaveBeenCalledWith({
      search: { projectId: "project-1" },
      to: "/editor",
    });
  });

  it("opens the saved edit source in explorer", async () => {
    await act(async () => {
      root.render(<SavedEditTableActions edit={edit} />);
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Open Saved boss edit in explorer"]',
        )
        ?.click();
    });

    expect(storeMocks.revealEditInExplorer).toHaveBeenCalledWith("project-1");
  });

  it("confirms deleting a saved edit", async () => {
    await act(async () => {
      root.render(<SavedEditTableActions edit={edit} />);
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Delete saved edit Saved boss edit"]',
        )
        ?.click();
    });

    expect(document.body.textContent).toContain("Delete edit?");

    await act(async () => {
      Array.from(document.body.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete edit")
        ?.click();
    });

    expect(storeMocks.deleteEdit).toHaveBeenCalledWith("project-1");
  });
});
