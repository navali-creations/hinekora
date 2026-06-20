import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorNewEditAction } from "./EditorNewEditAction";

let container: HTMLDivElement;
let root: Root;

async function renderNewEditAction(): Promise<HTMLButtonElement> {
  await act(async () => {
    root.render(<EditorNewEditAction />);
  });

  const button = container.querySelector<HTMLButtonElement>("button");
  if (!button) {
    throw new Error("Expected new edit button to render");
  }

  return button;
}

describe("EditorNewEditAction", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        createProject: storeMocks.createProject,
      }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("starts a fresh empty editor project", async () => {
    const button = await renderNewEditAction();

    await act(async () => {
      button.click();
    });

    expect(storeMocks.createProject).toHaveBeenCalledWith({ assetKeys: [] });
  });
});
