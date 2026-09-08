import { describe, expect, it } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";

import { isTrustedRendererUrl, readPreloadWindowName } from "./preload.utils";

describe("preload capability identity", () => {
  it("accepts packaged files and loopback development servers", () => {
    expect(isTrustedRendererUrl("file:///C:/Hinekora/index.html")).toBe(true);
    expect(isTrustedRendererUrl("http://localhost:5173/#/main")).toBe(true);
    expect(isTrustedRendererUrl("https://127.0.0.1:5173/#/main")).toBe(true);
    expect(isTrustedRendererUrl("http://[::1]:5173/#/main")).toBe(true);
  });

  it("rejects external, data, and malformed renderer URLs", () => {
    expect(isTrustedRendererUrl("https://example.com/#/main")).toBe(false);
    expect(isTrustedRendererUrl("data:text/html,untrusted")).toBe(false);
    expect(isTrustedRendererUrl("not a url")).toBe(false);
  });

  it("reads only exact window-role arguments", () => {
    expect(
      readPreloadWindowName([
        "electron",
        "--hinekora-window-role=aura-overlay",
      ]),
    ).toBe(WindowName.AuraOverlay);
    expect(
      readPreloadWindowName([
        "electron",
        "--hinekora-window-role=aura-overlay-extra",
      ]),
    ).toBeNull();
    expect(readPreloadWindowName(["electron"])).toBeNull();
  });
});
