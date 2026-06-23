import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorClipboardStatus } from "./EditorClipboardStatus";

let container: HTMLDivElement;
let root: Root;

function configureClipboardState(
  status: "copied" | "copying" | "failed" | "idle",
) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      clipboardState: { error: null, requestId: "copy-1", status },
    }),
  );
}

async function renderClipboardStatus() {
  await act(async () => {
    root.render(<EditorClipboardStatus />);
  });
}

describe("EditorClipboardStatus", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureClipboardState("idle");
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("stays hidden while idle", async () => {
    await renderClipboardStatus();

    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("shows clipboard progress, completion, and failure", async () => {
    configureClipboardState("copying");
    await renderClipboardStatus();

    expect(container.textContent).toContain("Processing");

    configureClipboardState("copied");
    await renderClipboardStatus();

    expect(container.textContent).toContain("Copied");

    configureClipboardState("failed");
    await renderClipboardStatus();

    expect(container.textContent).toContain("Copy failed");
  });
});
