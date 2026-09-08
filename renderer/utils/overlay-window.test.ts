import { describe, expect, it } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";

import { getOverlayRendererRoute } from "./overlay-window";

describe("overlay renderer routes", () => {
  it("matches exact overlay hash routes", () => {
    expect(getOverlayRendererRoute("#/aura-overlay")).toEqual({
      name: WindowName.AuraOverlay,
      routeClassName: "is-aura-overlay-route",
    });
    expect(getOverlayRendererRoute("#recorder-overlay?mode=compact")).toEqual({
      name: WindowName.RecorderOverlay,
      routeClassName: null,
    });
  });

  it("does not classify overlay names embedded in other routes", () => {
    expect(getOverlayRendererRoute("#/dashboard?next=aura-overlay")).toBeNull();
    expect(getOverlayRendererRoute("#/aura-overlay-copy")).toBeNull();
    expect(getOverlayRendererRoute("#/aura-overlay/nested")).toBeNull();
    expect(getOverlayRendererRoute("#/toString")).toBeNull();
  });
});
