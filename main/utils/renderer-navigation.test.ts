import { describe, expect, it, vi } from "vitest";

import {
  isCurrentRendererDocument,
  isExpectedRendererLoadInterruption,
} from "./renderer-navigation";

describe("renderer-navigation", () => {
  it("allows only an exact reload of the current renderer document", () => {
    const webContents = {
      getURL: vi.fn(() => "http://localhost:5173/#/dashboard"),
    };

    expect(
      isCurrentRendererDocument(
        webContents,
        "http://localhost:5173/#/dashboard",
      ),
    ).toBe(true);
    expect(
      isCurrentRendererDocument(
        webContents,
        "http://localhost:5173/#/settings",
      ),
    ).toBe(false);
  });

  it("recognizes Electron's expected aborted-load signal", () => {
    expect(isExpectedRendererLoadInterruption(-3, "ERR_ABORTED")).toBe(true);
    expect(isExpectedRendererLoadInterruption(-105, "ERR_ABORTED")).toBe(true);
    expect(isExpectedRendererLoadInterruption(-105, "NAME_NOT_RESOLVED")).toBe(
      false,
    );
  });
});
