import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  editorCommandShortcutItems,
  editorTimelineShortcutItems,
} from "../../Editor.utils/EditorShortcuts.utils";
import { EditorShortcutsRail } from "./EditorShortcutsRail";

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

async function renderShortcutsRail() {
  await act(async () => {
    root.render(<EditorShortcutsRail onClose={onClose} />);
  });
}

describe("EditorShortcutsRail", () => {
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

  it("renders shortcut rows without the typing notice card", async () => {
    await renderShortcutsRail();

    expect(container.textContent).toContain("Shortcuts");
    expect(container.textContent).toContain("Delete the selected clip");
    expect(container.textContent).toContain("Timeline");
    expect(container.textContent).toContain("Editor");
    expect(container.textContent).not.toContain("ignored while typing");
    expect(
      container
        .querySelector('[aria-label="Shortcut groups"]')
        ?.classList.contains("tabs-xs"),
    ).toBe(true);
    expect(container.querySelectorAll("kbd")).toHaveLength(
      editorTimelineShortcutItems.reduce(
        (total, item) => total + item.keys.length,
        0,
      ),
    );
  });

  it("switches between timeline and editor shortcuts", async () => {
    await renderShortcutsRail();

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Editor")
        ?.click();
    });

    expect(container.textContent).toContain("Open the save modal");
    expect(container.textContent).not.toContain("Split the selected clip");
    expect(container.querySelectorAll("kbd")).toHaveLength(
      editorCommandShortcutItems.reduce(
        (total, item) => total + item.keys.length,
        0,
      ),
    );
  });

  it("closes the shortcuts rail", async () => {
    await renderShortcutsRail();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Close shortcuts panel"]',
        )
        ?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
