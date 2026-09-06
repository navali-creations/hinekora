import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuraPlacementPropertiesPanelBounds } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";
import { useAuraPlacementPropertiesPanelLayout } from "./useAuraPlacementPropertiesPanelLayout";

function PropertiesPanelLayoutHarness({
  anchorBounds,
}: {
  anchorBounds: AuraPlacementPropertiesPanelBounds;
}) {
  const { panelRef, panelStyle } =
    useAuraPlacementPropertiesPanelLayout(anchorBounds);

  return <details data-testid="panel" ref={panelRef} style={panelStyle} open />;
}

describe("useAuraPlacementPropertiesPanelLayout", () => {
  let container: HTMLDivElement;
  let root: Root;
  let measurePanel: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    measurePanel = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 164, 200));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reuses measured panel dimensions while the anchor moves", async () => {
    await act(async () => {
      root.render(
        <PropertiesPanelLayoutHarness
          anchorBounds={{ height: 60, left: 100, top: 100, width: 60 }}
        />,
      );
    });
    const panel = container.querySelector<HTMLElement>("[data-testid='panel']");
    expect(panel?.style.left).toBe("68px");
    expect(measurePanel).toHaveBeenCalledOnce();

    await act(async () => {
      root.render(
        <PropertiesPanelLayoutHarness
          anchorBounds={{ height: 60, left: 900, top: 100, width: 60 }}
        />,
      );
    });

    expect(panel?.style.left).toBe("-172px");
    expect(measurePanel).toHaveBeenCalledOnce();
  });

  it("remeasures when the viewport changes", async () => {
    await act(async () => {
      root.render(
        <PropertiesPanelLayoutHarness
          anchorBounds={{ height: 60, left: 100, top: 100, width: 60 }}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(measurePanel).toHaveBeenCalledTimes(2);
  });
});
