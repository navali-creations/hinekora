import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManagedRecorderSettingsToggle } from "./ManagedRecorderSettingsToggle";

let container: HTMLDivElement;
let root: Root;

async function renderToggle(onChange = vi.fn()): Promise<void> {
  await act(async () => {
    root.render(
      <ManagedRecorderSettingsToggle
        ariaLabel="Start recording automatically"
        checked={false}
        helpText="Starts recording when the selected game is running"
        label="Start recording automatically"
        onChange={onChange}
      />,
    );
  });
}

describe("ManagedRecorderSettingsToggle", () => {
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

  it("toggles from the checkbox", async () => {
    const onChange = vi.fn();
    await renderToggle(onChange);

    const checkbox = container.querySelector<HTMLInputElement>(
      'input[aria-label="Start recording automatically"]',
    );
    expect(checkbox).not.toBeNull();

    await act(async () => {
      checkbox?.click();
    });

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when the tooltip help icon is clicked", async () => {
    const onChange = vi.fn();
    await renderToggle(onChange);

    const helpButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Starts recording when the selected game is running"]',
    );
    expect(helpButton).not.toBeNull();

    await act(async () => {
      helpButton?.click();
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
