import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReplayStatusOverlayEvent } from "~/main/modules/replay-status-overlay/ReplayStatusOverlay.dto";

import { ReplayStatusOverlayPage } from "./ReplayStatusOverlay.page";

describe("ReplayStatusOverlayPage", () => {
  let container: HTMLDivElement;
  let listener: ((status: ReplayStatusOverlayEvent) => void) | null;
  let root: Root | null;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    listener = null;
    unsubscribe.mockReset();
    window.location.hash = "#/replay-status-overlay?clipId=manual-1";
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        replayStatusOverlay: {
          onStatusChanged: (
            callback: (status: ReplayStatusOverlayEvent) => void,
          ) => {
            listener = callback;
            return unsubscribe;
          },
        },
      },
    });
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.replaceChildren();
  });

  it("shows processing and replaces it for each reused-window replay", async () => {
    await act(async () => {
      root?.render(<ReplayStatusOverlayPage />);
    });

    const initialNotification = container.querySelector('[role="status"]');
    expect(initialNotification?.textContent).toContain("Processing replay");
    expect(initialNotification?.getAttribute("data-status")).toBe("processing");

    await act(async () => {
      listener?.({
        clipId: "another-replay",
        dismissing: false,
        status: "saved",
      });
    });
    const replacementNotification = container.querySelector('[role="status"]');
    expect(replacementNotification).not.toBe(initialNotification);
    expect(replacementNotification?.textContent).toContain("Replay saved");
    expect(replacementNotification?.textContent).toContain(
      "You can edit it later.",
    );

    await act(async () => {
      listener?.({
        clipId: "another-replay",
        dismissing: true,
        status: "saved",
      });
    });
    expect(
      container
        .querySelector('[role="status"]')
        ?.getAttribute("data-dismissing"),
    ).toBe("true");
  });

  it("shows a failure state and removes its listener on unmount", async () => {
    await act(async () => {
      root?.render(<ReplayStatusOverlayPage />);
    });

    await act(async () => {
      listener?.({
        clipId: "manual-1",
        dismissing: false,
        status: "failed",
      });
    });

    expect(container.textContent).toContain("Replay save failed");
    expect(container.querySelector('[data-status="failed"]')).not.toBeNull();

    await act(async () => {
      root?.unmount();
      root = null;
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("renders nothing and does not subscribe for an invalid route id", async () => {
    window.location.hash = "#/replay-status-overlay?clipId=";

    await act(async () => {
      root?.render(<ReplayStatusOverlayPage />);
    });

    expect(container.childElementCount).toBe(0);
    expect(listener).toBeNull();
  });
});
