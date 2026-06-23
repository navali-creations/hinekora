import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  copyProjectToClipboard: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorCopyActions } from "./EditorCopyActions";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      clipboardState: { error: null, requestId: null, status: "idle" },
      copyProjectToClipboard: storeMocks.copyProjectToClipboard,
      exportState: { status: "idle" },
      project: { id: "project-1" },
      selectedClipId: "timeline-1",
      ...overrides,
    }),
  );
}

async function renderCopyActions(variant?: "button" | "menu") {
  await act(async () => {
    root.render(
      variant ? <EditorCopyActions variant={variant} /> : <EditorCopyActions />,
    );
  });
}

describe("EditorCopyActions", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.copyProjectToClipboard.mockResolvedValue({
      error: null,
      ok: true,
    });
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("is disabled when no timeline clip is selected", async () => {
    configureEditorState({ selectedClipId: null });
    await renderCopyActions();

    const button = container.querySelector("button");

    expect(button?.disabled).toBe(true);
    expect(
      container.querySelector("[data-tip]")?.getAttribute("data-tip"),
    ).toBe("Select a timeline clip before copying.");
  });

  it("renders disabled menu copy as a flat tooltip row", async () => {
    configureEditorState({ selectedClipId: null });
    await renderCopyActions("menu");

    const tooltip = container.querySelector(
      '[data-tip="Select a timeline clip before copying."]',
    );
    const disabledRow = tooltip?.querySelector('[aria-disabled="true"]');

    expect(disabledRow?.textContent).toContain("Copy to clipboard");
    expect(disabledRow?.className).toContain("text-base-content/45");
    expect(container.querySelector("button")).toBeNull();
  });

  it("copies the current edit", async () => {
    await renderCopyActions();
    const button = container.querySelector("button");

    await act(async () => {
      button?.click();
      await Promise.resolve();
    });

    expect(storeMocks.copyProjectToClipboard).toHaveBeenCalledTimes(1);
  });

  it("shows copied state from the editor clipboard status", async () => {
    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copied" },
    });
    await renderCopyActions();
    const button = container.querySelector("button");

    expect(button?.textContent).toContain("Copied to clipboard");
  });
});
