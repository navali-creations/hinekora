import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EditorHelpAction } from "./EditorHelpAction";

let container: HTMLDivElement;
let root: Root;

async function renderHelpAction() {
  await act(async () => {
    root.render(<EditorHelpAction />);
  });
}

describe("EditorHelpAction", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("opens editor help with editor option descriptions", async () => {
    await renderHelpAction();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Editor help"]')
        ?.click();
    });

    expect(document.body.textContent).toContain("Editor help");
    expect(document.body.textContent).toContain("Split");
    expect(document.body.textContent).toContain("History");
    expect(
      document.body
        .querySelector('[aria-label="Editor help sections"]')
        ?.classList.contains("tabs-xs"),
    ).toBe(true);
    expect(
      Array.from(document.body.querySelectorAll("button")).some(
        (button) => button.textContent === "Shortcuts",
      ),
    ).toBe(false);

    await act(async () => {
      Array.from(document.body.querySelectorAll("button"))
        .find((button) => button.textContent === "History")
        ?.click();
    });

    expect(document.body.textContent).toContain("history entries");

    await act(async () => {
      Array.from(document.body.querySelectorAll("button"))
        .find((button) => button.textContent === "Saving")
        ?.click();
    });

    expect(document.body.textContent).toContain("Processing");
    expect(document.body.textContent).toContain("Save video");

    await act(async () => {
      Array.from(document.body.querySelectorAll("button"))
        .find((button) => button.textContent === "More")
        ?.click();
    });

    expect(document.body.textContent).toContain("Auto-prune all but last 5");
    expect(document.body.textContent).toContain("Copy to clipboard");
  });
});
