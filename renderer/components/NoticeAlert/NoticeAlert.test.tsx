import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoticeAlert } from "./NoticeAlert";

let container: HTMLDivElement;
let root: Root;

describe("NoticeAlert", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("renders the shared information treatment with optional actions", async () => {
    await act(async () => {
      root.render(
        <NoticeAlert actions={<button type="button">Open</button>} title="Info">
          Details
        </NoticeAlert>,
      );
    });

    const alert = container.querySelector('[role="status"]');
    expect(alert?.textContent).toContain("Info");
    expect(alert?.textContent).toContain("Details");
    expect(alert?.className).toContain("border-info");
    expect(alert?.className).toContain("bg-secondary");
    expect(alert?.className).toContain("text-info");
    expect(alert?.className).toContain("grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(alert?.querySelector("svg")?.classList.contains("text-info")).toBe(
      true,
    );
  });

  it("supports the dashboard warning treatment without actions", async () => {
    await act(async () => {
      root.render(
        <NoticeAlert title="Warning" tone="warning">
          Details
        </NoticeAlert>,
      );
    });

    const alert = container.querySelector('[role="status"]');
    expect(alert?.className).toContain("border-warning/40");
    expect(alert?.className).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(
      alert?.querySelector("svg")?.classList.contains("text-warning"),
    ).toBe(true);
  });

  it("exposes an accessible dismissal action", async () => {
    const handleDismiss = vi.fn();
    await act(async () => {
      root.render(
        <NoticeAlert
          dismissLabel="Dismiss export information"
          title="Info"
          onDismiss={handleDismiss}
        >
          Details
        </NoticeAlert>,
      );
    });

    const dismissButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Dismiss export information"]',
    );
    expect(dismissButton?.textContent).toBe("Dismiss");

    await act(async () => {
      dismissButton?.click();
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
