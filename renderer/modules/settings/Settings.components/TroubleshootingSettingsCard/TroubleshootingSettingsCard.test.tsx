import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TroubleshootingSettingsCard } from "./TroubleshootingSettingsCard";

let container: HTMLDivElement;
let root: Root;
const revealLogFile = vi.fn();

async function renderCard(): Promise<HTMLButtonElement> {
  await act(async () => {
    root.render(<TroubleshootingSettingsCard />);
  });

  const button = container.querySelector<HTMLButtonElement>("button");
  if (!button) {
    throw new Error("Expected troubleshooting button to render");
  }

  return button;
}

describe("TroubleshootingSettingsCard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    revealLogFile.mockResolvedValue({ success: true });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        diagLog: {
          revealLogFile,
        },
      },
    });
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("opens the diagnostic log through preload", async () => {
    const button = await renderCard();

    await act(async () => {
      button.click();
    });

    expect(container.textContent).toContain("Diagnostic Log");
    expect(revealLogFile).toHaveBeenCalledTimes(1);
  });

  it("shows a failure message when the diagnostic log cannot be opened", async () => {
    revealLogFile.mockResolvedValueOnce({
      success: false,
      error: "shell failed",
    });
    const button = await renderCard();

    await act(async () => {
      button.click();
    });

    expect(container.textContent).toContain("Could not open diagnostic log.");
    expect(revealLogFile).toHaveBeenCalledTimes(1);
  });
});
