import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedEditItem } from "~/main/modules/saved-edits";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routerMocks.navigate,
}));

import { EditorSavedEditCard } from "./EditorSavedEditCard";

const edit: SavedEditItem = {
  clipCount: 2,
  createdAt: "2026-06-18T00:00:00.000Z",
  durationSeconds: 12,
  historyEditCount: 2,
  id: "edit-1",
  sizeBytes: 1024,
  sourceGame: "poe2",
  sourceLeague: "Standard",
  title: "Saved boss edit",
  updatedAt: "2026-06-18T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;

async function renderSavedEditCard() {
  await act(async () => {
    root.render(<EditorSavedEditCard edit={edit} />);
  });
}

describe("EditorSavedEditCard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("opens saved edits", async () => {
    await renderSavedEditCard();

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });

    expect(routerMocks.navigate).toHaveBeenCalledWith({
      search: { projectId: "edit-1" },
      to: "/editor",
    });
  });
});
