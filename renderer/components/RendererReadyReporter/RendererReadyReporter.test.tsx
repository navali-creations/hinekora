import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RendererReadyReporter } from "./RendererReadyReporter";

describe("RendererReadyReporter", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "electron");
  });

  it("reports a committed main renderer", async () => {
    const rendererReady = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: { mainWindow: { rendererReady } },
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<RendererReadyReporter />);
      await Promise.resolve();
    });

    expect(rendererReady).toHaveBeenCalledOnce();
    await act(async () => {
      root.unmount();
    });
  });

  it("contains a rejected readiness signal", async () => {
    const rendererReady = vi.fn().mockRejectedValue(new Error("unavailable"));
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: { mainWindow: { rendererReady } },
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<RendererReadyReporter />);
      await Promise.resolve();
    });

    expect(rendererReady).toHaveBeenCalledOnce();
    await act(async () => {
      root.unmount();
    });
  });
});
